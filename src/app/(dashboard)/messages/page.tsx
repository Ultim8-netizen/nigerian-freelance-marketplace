'use client';

import React, { useState, useEffect } from 'react';
import {
  MessageSquare, Search, Send, Info,
  CheckCheck, Check,
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

export default function MessagesPage() {
  const [conversations, setConversations] = useState<ConversationWithData[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [messageInput, setMessageInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string>('');

  const supabase = createClient();

  useEffect(() => {
    const init = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        setCurrentUserId(user.id);

        // Fetch conversations
        const { data: convData, error: convError } = await supabase
          .from('conversations')
          .select('*')
          .or(`participant_1.eq.${user.id},participant_2.eq.${user.id}`)
          .order('last_message_at', { ascending: false });

        if (convError) throw convError;
        if (!convData) return;

        // Enrich conversations with messages and user data
        const enrichedConversations = await Promise.all(
          (convData as Conversation[]).map(async (conv) => {
            const otherUserId = conv.participant_1 === user.id 
              ? conv.participant_2 
              : conv.participant_1;

            // Fetch other user profile
            const { data: userProfile } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', otherUserId)
              .single();

            // Fetch messages with sender info
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
        }
      } catch (error) {
        console.error('Error loading conversations:', error);
      } finally {
        setLoading(false);
      }
    };

    init();
  }, [supabase]);

  const selected = conversations.find(c => c.id === selectedId);
  const filtered = conversations.filter(c =>
    c.otherUser?.full_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSendMessage = async () => {
    if (!messageInput.trim() || !selected || !currentUserId) return;

    try {
      // Only set fields that are NOT marked as never in MessageInsert
      const newMessage: MessageInsert = {
        conversation_id: selected.id,
        sender_id: currentUserId,
        message_text: messageInput,
      };

      const { error: insertError } = await supabase
        .from('messages')
        .insert(newMessage);

      if (insertError) throw insertError;

      // Update conversation - only update last_message_at
      const { error: updateError } = await supabase
        .from('conversations')
        .update({
          last_message_at: new Date().toISOString(),
        })
        .eq('id', selected.id);

      if (updateError) throw updateError;

      // Refresh messages
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
        .eq('conversation_id', selected.id)
        .order('created_at', { ascending: true });

      setConversations(prev =>
        prev.map(c =>
          c.id === selected.id 
            ? { ...c, messages: (messages || []) as MessageWithSender[] } 
            : c
        )
      );

      setMessageInput('');
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  const formatTime = (date: string | null) => {
    if (!date) return 'No messages';
    
    const d = new Date(date);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (mins < 1) return 'now';
    if (mins < 60) return `${mins}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
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
        {/* Header */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Messages</h1>

          {/* Search */}
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

        {/* Conversations List */}
        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 dark:text-gray-500 p-4">
              <MessageSquare size={32} className="mb-2 opacity-50" />
              <p className="text-sm">No conversations found</p>
            </div>
          ) : (
            <div className="space-y-2 p-2">
              {filtered.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => setSelectedId(conv.id)}
                  className={`w-full p-3 rounded-lg transition-all duration-200 text-left group ${
                    selectedId === conv.id
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-900 dark:text-white'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {/* Avatar */}
                    <div className="shrink-0">
                      {conv.otherUser?.profile_image_url ? (
                        <Image
                          src={conv.otherUser.profile_image_url}
                          alt={conv.otherUser.full_name}
                          width={48}
                          height={48}
                          className="rounded-full"
                        />
                      ) : (
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold ${
                          selectedId === conv.id
                            ? 'bg-white/20 text-white'
                            : 'bg-gray-200 dark:bg-gray-600 text-gray-900 dark:text-white'
                        }`}>
                          {conv.otherUser?.full_name.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <p className={`font-semibold text-sm ${selectedId === conv.id ? 'text-white' : ''}`}>
                        {conv.otherUser?.full_name}
                      </p>
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
              ))}
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
                {selected.otherUser.profile_image_url ? (
                  <Image
                    src={selected.otherUser.profile_image_url}
                    alt={selected.otherUser.full_name}
                    width={48}
                    height={48}
                    className="rounded-full"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-blue-500 text-white flex items-center justify-center text-lg font-bold">
                    {selected.otherUser.full_name.charAt(0).toUpperCase()}
                  </div>
                )}
                <div>
                  <h2 className="font-semibold text-gray-900 dark:text-white">{selected.otherUser.full_name}</h2>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Active</p>
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
                  <p className="text-sm">Send a message to begin chatting with {selected.otherUser.full_name}</p>
                </div>
              ) : (
                selected.messages.map((msg) => (
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
                ))
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