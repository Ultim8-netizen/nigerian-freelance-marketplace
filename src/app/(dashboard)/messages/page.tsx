// src/app/(dashboard)/messages/page.tsx
'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  MessageSquare, Search, Send, Info,
  CheckCheck, Check, Shield,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import type { Profile, Conversation, Message, MessageInsert } from '@/types';
import Image from 'next/image';

// Extended types for component state
interface MessageWithSender extends Message {
  sender: Profile | null;
}

interface ConversationWithData extends Conversation {
  messages: MessageWithSender[];
  otherUser: Profile | null;
}

// ─── Admin masking helpers ────────────────────────────────────────────────────

const isAdmin = (user: Profile | null): boolean =>
  user?.user_type === 'admin';

const getDisplayName = (user: Profile | null): string =>
  isAdmin(user) ? 'F9' : (user?.full_name ?? '');

const getInitial = (user: Profile | null): string =>
  isAdmin(user) ? '' : (user?.full_name?.charAt(0).toUpperCase() ?? '');

// ─── Sub-components ───────────────────────────────────────────────────────────

function F9ShieldAvatar({ size = 48 }: { size?: number }) {
  return (
    <div
      style={{ width: size, height: size }}
      className="rounded-full bg-blue-600 flex items-center justify-center shrink-0"
    >
      <Shield size={Math.round(size * 0.5)} className="text-white" />
    </div>
  );
}

function ConversationAvatar({
  user,
  isSelected,
}: {
  user: Profile | null;
  isSelected: boolean;
}) {
  if (isAdmin(user)) return <F9ShieldAvatar size={48} />;

  if (user?.profile_image_url) {
    return (
      <Image
        src={user.profile_image_url}
        alt={user.full_name}
        width={48}
        height={48}
        className="rounded-full"
      />
    );
  }

  return (
    <div
      className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold ${
        isSelected
          ? 'bg-white/20 text-white'
          : 'bg-gray-200 dark:bg-gray-600 text-gray-900 dark:text-white'
      }`}
    >
      {getInitial(user)}
    </div>
  );
}

function ChatHeaderAvatar({ user }: { user: Profile | null }) {
  if (isAdmin(user)) return <F9ShieldAvatar size={48} />;

  if (user?.profile_image_url) {
    return (
      <Image
        src={user.profile_image_url}
        alt={user.full_name}
        width={48}
        height={48}
        className="rounded-full"
      />
    );
  }

  return (
    <div className="w-12 h-12 rounded-full bg-blue-500 text-white flex items-center justify-center text-lg font-bold">
      {getInitial(user)}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MessagesPage() {
  // FIX (Bug 2): createClient() must not be called on every render — it returns
  // a new object reference each time, which makes any useEffect that lists
  // `supabase` as a dependency re-run on every render, creating an infinite
  // fetch loop. useState initialiser runs exactly once.
  const [supabase] = useState(() => createClient());

  const [conversations, setConversations] = useState<ConversationWithData[]>([]);
  const [selectedId, setSelectedId]       = useState<string | null>(null);
  const [searchQuery, setSearchQuery]     = useState('');
  const [messageInput, setMessageInput]   = useState('');
  const [loading, setLoading]             = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string>('');

  // Tracks the set of conversation IDs this user belongs to.
  // Used inside the Realtime callback — a ref avoids making `conversations`
  // a dependency of the Realtime useEffect, which would tear down and
  // re-create the channel every time any message is received.
  const convIdsRef = useRef<Set<string>>(new Set());

  // Tracks the currently open conversation ID inside the Realtime callback
  // so newly arriving messages can be marked read immediately if the
  // conversation is already visible — without making selectedId a dep.
  const selectedIdRef = useRef<string | null>(null);

  // Scroll anchor at the end of the messages list.
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // ── Init ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        setCurrentUserId(user.id);

        const { data: convData, error: convError } = await supabase
          .from('conversations')
          .select('*')
          .or(`participant_1.eq.${user.id},participant_2.eq.${user.id}`)
          .order('last_message_at', { ascending: false });

        if (convError) throw convError;
        if (!convData) return;

        const enrichedConversations = await Promise.all(
          (convData as Conversation[]).map(async (conv) => {
            const otherUserId = conv.participant_1 === user.id
              ? conv.participant_2
              : conv.participant_1;

            const { data: userProfile } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', otherUserId)
              .single();

            const { data: messages } = await supabase
              .from('messages')
              .select(`
                id,
                conversation_id,
                sender_id,
                message_text,
                attachments,
                is_read,
                read_at,
                created_at,
                sender:sender_id(*)
              `)
              .eq('conversation_id', conv.id)
              .order('created_at', { ascending: true });

            return {
              ...conv,
              messages: (messages || []) as MessageWithSender[],
              otherUser: userProfile,
            } as ConversationWithData;
          })
        );

        setConversations(enrichedConversations);
        if (enrichedConversations.length > 0) {
          setSelectedId(enrichedConversations[0].id);
          selectedIdRef.current = enrichedConversations[0].id;
        }
      } catch (error) {
        console.error('Error loading conversations:', error);
      } finally {
        setLoading(false);
      }
    };

    void init();
  }, [supabase]);

  // Keep convIdsRef current whenever the conversation list changes so the
  // Realtime callback always filters correctly without being re-subscribed.
  useEffect(() => {
    convIdsRef.current = new Set(conversations.map(c => c.id));
  }, [conversations]);

  // Keep selectedIdRef current so the Realtime callback can check which
  // conversation is open without selectedId being in the effect dep array.
  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  // ── Realtime: incoming messages ────────────────────────────────────────────
  // Gap 3 FIX: Subscribe to message INSERTs once after the user is known.
  // Channel is not recreated when conversations state updates because we use
  // refs for the data the callback needs (convIdsRef, selectedIdRef).
  useEffect(() => {
    if (!currentUserId) return;

    const channel = supabase
      .channel('f9-messages-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        async (payload) => {
          const incoming = payload.new as Message;
          const convId   = incoming.conversation_id;

          // Ignore events for conversations this user is not part of.
          if (!convId || !convIdsRef.current.has(convId)) return;

          // Realtime payloads don't include join data — fetch sender profile.
          const { data: senderProfile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', incoming.sender_id)
            .single();

          const withSender: MessageWithSender = {
            ...incoming,
            sender: (senderProfile as Profile) ?? null,
          };

          // Gap 4 FIX (live arrival): if this conversation is currently open
          // and the message is from the other party, mark it read immediately
          // so the sender's receipt icon updates without requiring a re-click.
          if (
            incoming.sender_id !== currentUserId &&
            convId === selectedIdRef.current
          ) {
            void supabase
              .from('messages')
              .update({ is_read: true, read_at: new Date().toISOString() })
              .eq('id', incoming.id);

            withSender.is_read = true;
            withSender.read_at = new Date().toISOString();
          }

          setConversations(prev =>
            prev.map(c => {
              if (c.id !== convId) return c;
              // Dedup guard — protects against double-append if optimistic
              // updates are added in future without removing this path.
              if (c.messages.some(m => m.id === incoming.id)) return c;
              return { ...c, messages: [...c.messages, withSender] };
            })
          );
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [supabase, currentUserId]);

  // ── Auto-scroll ────────────────────────────────────────────────────────────
  // Gap 5 FIX: scroll to bottom whenever the message count in the selected
  // conversation changes (new message received or sent).
  const selected = conversations.find(c => c.id === selectedId);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [selected?.messages.length]);

  // ── Select conversation + mark as read ─────────────────────────────────────
  // Gap 4 FIX (on open): mark all unread messages from the other party as read
  // when the user clicks into a conversation. Optimistically patches local
  // state so the sender's CheckCheck appears without waiting for a DB round-trip.
  const handleSelectConversation = useCallback(async (id: string) => {
    setSelectedId(id);
    selectedIdRef.current = id;

    if (!currentUserId) return;

    // Fire-and-forget — non-critical path; local patch is the UX signal.
    void supabase
      .from('messages')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('conversation_id', id)
      .neq('sender_id', currentUserId)
      .eq('is_read', false);

    setConversations(prev =>
      prev.map(c => {
        if (c.id !== id) return c;
        return {
          ...c,
          messages: c.messages.map(m =>
            m.sender_id !== currentUserId && !m.is_read
              ? { ...m, is_read: true, read_at: new Date().toISOString() }
              : m
          ),
        };
      })
    );
  }, [supabase, currentUserId]);

  // ── Send message ───────────────────────────────────────────────────────────
  // No manual re-fetch after insert — the Realtime subscription above receives
  // the INSERT event and appends the message (including sender profile) for
  // both the sender and recipient. Input is cleared immediately on submit;
  // restored on error so the user's text is not lost.
  const handleSendMessage = async () => {
    if (!messageInput.trim() || !selected || !currentUserId) return;

    const text = messageInput.trim();
    setMessageInput('');

    try {
      const newMessage: MessageInsert = {
        conversation_id: selected.id,
        sender_id:       currentUserId,
        message_text:    text,
      };

      const { error: insertError } = await supabase
        .from('messages')
        .insert(newMessage);

      if (insertError) throw insertError;

      // Keep last_message_at current so the sidebar sort order stays correct.
      void supabase
        .from('conversations')
        .update({ last_message_at: new Date().toISOString() })
        .eq('id', selected.id);

    } catch (error) {
      console.error('Error sending message:', error);
      setMessageInput(text); // restore text on failure
    }
  };

  const filtered = conversations.filter(c =>
    getDisplayName(c.otherUser).toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatTime = (date: string | null) => {
    if (!date) return 'No messages';
    const d    = new Date(date);
    const now  = new Date();
    const diff = now.getTime() - d.getTime();
    const mins  = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days  = Math.floor(diff / 86400000);
    if (mins  < 1)  return 'now';
    if (mins  < 60) return `${mins}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days  < 7)  return `${days}d ago`;
    return d.toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-white dark:bg-gray-900">
        <p className="text-gray-500 dark:text-gray-400">Loading conversations...</p>
      </div>
    );
  }

  return (
    <div className="h-screen bg-white dark:bg-gray-900 flex overflow-hidden">
      {/* Sidebar */}
      <div className="w-80 bg-gray-50 dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Messages</h1>
          <div className="relative">
            <Search size={18} className="absolute left-3 top-3 text-gray-400 dark:text-gray-500" />
            <input
              type="text"
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white dark:bg-gray-700 rounded-lg text-sm border border-gray-200 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 text-gray-900 dark:text-white"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 dark:text-gray-500 p-4">
              <MessageSquare size={32} className="mb-2 opacity-50" />
              <p className="text-sm">No conversations found</p>
            </div>
          ) : (
            <div className="space-y-2 p-2">
              {filtered.map((conv) => {
                const displayName = getDisplayName(conv.otherUser);
                const adminConv   = isAdmin(conv.otherUser);

                return (
                  <button
                    key={conv.id}
                    onClick={() => handleSelectConversation(conv.id)}
                    className={`w-full p-3 rounded-lg transition-all duration-200 text-left group ${
                      selectedId === conv.id
                        ? 'bg-blue-600 text-white shadow-md'
                        : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-900 dark:text-white'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="shrink-0">
                        <ConversationAvatar
                          user={conv.otherUser}
                          isSelected={selectedId === conv.id}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className={`font-semibold text-sm ${selectedId === conv.id ? 'text-white' : ''}`}>
                            {displayName}
                          </p>
                          {adminConv && (
                            <Shield
                              size={12}
                              className={selectedId === conv.id ? 'text-blue-200' : 'text-blue-600 dark:text-blue-400'}
                            />
                          )}
                        </div>
                        <p className={`text-sm truncate ${
                          selectedId === conv.id
                            ? 'text-blue-100'
                            : 'text-gray-600 dark:text-gray-400'
                        }`}>
                          {conv.messages[conv.messages.length - 1]?.message_text || 'No messages'}
                        </p>
                        <span className={`text-xs ${selectedId === conv.id ? 'text-blue-100' : 'text-gray-500 dark:text-gray-400'}`}>
                          {formatTime(conv.last_message_at)}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col bg-white dark:bg-gray-900">
        {selected && selected.otherUser ? (
          <>
            {/* Chat Header */}
            <div className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <ChatHeaderAvatar user={selected.otherUser} />
                <div>
                  <div className="flex items-center gap-1.5">
                    <h2 className="font-semibold text-gray-900 dark:text-white">
                      {getDisplayName(selected.otherUser)}
                    </h2>
                    {isAdmin(selected.otherUser) && (
                      <Shield size={14} className="text-blue-600 dark:text-blue-400" />
                    )}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {isAdmin(selected.otherUser) ? 'F9 Platform' : 'Active'}
                  </p>
                </div>
              </div>
              <button className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors text-gray-600 dark:text-gray-300">
                <Info size={20} />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-white dark:bg-gray-900">
              {selected.messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-gray-400 dark:text-gray-500">
                  <MessageSquare size={40} className="mb-4 opacity-50" />
                  <p className="font-semibold mb-2">Start a conversation</p>
                  <p className="text-sm">
                    Send a message to begin chatting with {getDisplayName(selected.otherUser)}
                  </p>
                </div>
              ) : (
                <>
                  {selected.messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex ${msg.sender_id === currentUserId ? 'justify-end' : 'justify-start'}`}
                    >
                      <div className={`max-w-xs lg:max-w-md px-4 py-3 rounded-2xl ${
                        msg.sender_id === currentUserId
                          ? 'bg-blue-600 text-white rounded-br-sm'
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white rounded-bl-sm'
                      }`}>
                        <p className="text-sm">{msg.message_text}</p>
                        <div className={`flex items-center justify-end gap-1 mt-1 text-xs ${
                          msg.sender_id === currentUserId
                            ? 'text-blue-100'
                            : 'text-gray-500 dark:text-gray-400'
                        }`}>
                          <span>
                            {msg.created_at
                              ? new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                              : 'N/A'
                            }
                          </span>
                          {msg.sender_id === currentUserId && (
                            msg.is_read ? <CheckCheck size={14} /> : <Check size={14} />
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  {/* Scroll anchor — scrollIntoView targets this on message count change */}
                  <div ref={messagesEndRef} />
                </>
              )}
            </div>

            {/* Input Area */}
            <div className="bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 p-4">
              <div className="flex items-end gap-3">
                <input
                  type="text"
                  placeholder="Type a message..."
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                  className="flex-1 px-4 py-2 bg-white dark:bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 border border-gray-200 dark:border-gray-600"
                />
                <button
                  onClick={handleSendMessage}
                  disabled={!messageInput.trim()}
                  className="p-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-all text-white shadow-md hover:shadow-lg"
                >
                  <Send size={20} />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center">
            <MessageSquare size={48} className="text-blue-600 dark:text-blue-400 mb-6" />
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">No conversation selected</h2>
            <p className="text-gray-600 dark:text-gray-400 max-w-md">Select a conversation from the list to start messaging</p>
          </div>
        )}
      </div>
    </div>
  );
}