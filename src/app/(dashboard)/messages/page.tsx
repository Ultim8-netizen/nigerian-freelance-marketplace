import React, { useState } from 'react';
import {
  MessageSquare, Search, Plus, Send, Phone, Video, Info,
  Smile, Paperclip, MoreVertical, CheckCheck, Check,
} from 'lucide-react';

interface Message {
  id: string;
  sender: 'user' | 'other';
  text: string;
  timestamp: Date;
  read: boolean;
  avatar?: string;
}

interface Conversation {
  id: string;
  name: string;
  avatar: string;
  lastMessage: string;
  timestamp: Date;
  unread: number;
  status: 'online' | 'offline' | 'away';
  messages: Message[];
}

const defaultConversations: Conversation[] = [
  {
    id: '1',
    name: 'Sarah Johnson',
    avatar: '👩‍💼',
    lastMessage: 'Thanks for the quick turnaround!',
    timestamp: new Date(Date.now() - 300000),
    unread: 2,
    status: 'online',
    messages: [
      { id: '1', sender: 'other', text: 'Hi! I have a project for you', timestamp: new Date(Date.now() - 3600000), read: true },
      { id: '2', sender: 'user', text: 'Great! Tell me more about it', timestamp: new Date(Date.now() - 3000000), read: true },
      { id: '3', sender: 'other', text: 'Thanks for the quick turnaround!', timestamp: new Date(Date.now() - 300000), read: false },
    ]
  },
  {
    id: '2',
    name: 'Alex Chen',
    avatar: '👨‍💻',
    lastMessage: 'Looking forward to the deliverables',
    timestamp: new Date(Date.now() - 7200000),
    unread: 0,
    status: 'offline',
    messages: [
      { id: '1', sender: 'other', text: 'Can you start this week?', timestamp: new Date(Date.now() - 7200000), read: true },
    ]
  },
  {
    id: '3',
    name: 'Emma Rodriguez',
    avatar: '👩‍🎨',
    lastMessage: 'The design looks perfect!',
    timestamp: new Date(Date.now() - 86400000),
    unread: 0,
    status: 'online',
    messages: []
  }
];

export default function MessagesPage() {
  const [conversations, setConversations] = useState<Conversation[]>(defaultConversations);
  const [selectedId, setSelectedId] = useState<string>(conversations[0].id);
  const [searchQuery, setSearchQuery] = useState('');
  const [messageInput, setMessageInput] = useState('');
  const [showInfo, setShowInfo] = useState(false);

  const selected = conversations.find(c => c.id === selectedId);
  const filtered = conversations.filter(c =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSendMessage = () => {
    if (!messageInput.trim() || !selected) return;

    const updatedConversations = conversations.map(c => {
      if (c.id === selectedId) {
        return {
          ...c,
          messages: [
            ...c.messages,
            {
              id: Date.now().toString(),
              sender: 'user' as const,
              text: messageInput,
              timestamp: new Date(),
              read: true
            }
          ],
          lastMessage: messageInput,
          timestamp: new Date()
        };
      }
      return c;
    });

    setConversations(updatedConversations);
    setMessageInput('');
  };

  const formatTime = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (mins < 1) return 'now';
    if (mins < 60) return `${mins}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="h-screen bg-linear-to-br from-gray-50 via-white to-blue-50 dark:from-gray-900 dark:via-gray-800 dark:to-blue-950 flex overflow-hidden">
      {/* Sidebar */}
      <div className="w-80 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col shadow-sm">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold bg-linear-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">Messages</h1>
            <button className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
              <Plus size={20} className="text-gray-600 dark:text-gray-300" />
            </button>
          </div>

          {/* Search */}
          <div className="relative">
            <Search size={18} className="absolute left-3 top-3 text-gray-400" />
            <input
              type="text"
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
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
                      ? 'bg-linear-to-r from-blue-500 to-purple-500 text-white shadow-md'
                      : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-900 dark:text-white'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="relative shrink-0">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center text-xl ${
                        selectedId === conv.id ? 'bg-white/20' : 'bg-gray-200 dark:bg-gray-600'
                      }`}>
                        {conv.avatar}
                      </div>
                      <div className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 ${
                        conv.status === 'online'
                          ? 'bg-green-500 border-white dark:border-gray-800'
                          : conv.status === 'away'
                          ? 'bg-yellow-500 border-white dark:border-gray-800'
                          : 'bg-gray-400 border-white dark:border-gray-800'
                      }`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <p className={`font-semibold text-sm ${selectedId === conv.id ? 'text-white' : ''}`}>
                          {conv.name}
                        </p>
                        <span className={`text-xs ${selectedId === conv.id ? 'text-blue-100' : 'text-gray-500 dark:text-gray-400'}`}>
                          {formatTime(conv.timestamp)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <p className={`text-sm truncate ${
                          selectedId === conv.id
                            ? 'text-blue-100'
                            : 'text-gray-600 dark:text-gray-400'
                        }`}>
                          {conv.lastMessage}
                        </p>
                        {conv.unread > 0 && (
                          <span className={`shrink-0 text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center ${
                            selectedId === conv.id
                              ? 'bg-white text-blue-600'
                              : 'bg-blue-600 text-white'
                          }`}>
                            {conv.unread}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {selected ? (
          <>
            {/* Chat Header */}
            <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between shadow-sm">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-12 h-12 rounded-full flex items-center justify-center text-2xl bg-gray-100 dark:bg-gray-700">
                    {selected.avatar}
                  </div>
                  <div className={`absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-white dark:border-gray-800 ${
                    selected.status === 'online'
                      ? 'bg-green-500'
                      : selected.status === 'away'
                      ? 'bg-yellow-500'
                      : 'bg-gray-400'
                  }`} />
                </div>
                <div>
                  <h2 className="font-semibold text-gray-900 dark:text-white">{selected.name}</h2>
                  <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">
                    {selected.status === 'online' ? 'Active now' : selected.status === 'away' ? 'Away' : 'Offline'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors text-gray-600 dark:text-gray-300">
                  <Phone size={20} />
                </button>
                <button className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors text-gray-600 dark:text-gray-300">
                  <Video size={20} />
                </button>
                <button
                  onClick={() => setShowInfo(!showInfo)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors text-gray-600 dark:text-gray-300"
                >
                  <Info size={20} />
                </button>
                <button className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors text-gray-600 dark:text-gray-300">
                  <MoreVertical size={20} />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {selected.messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-gray-400 dark:text-gray-500">
                  <div className="w-20 h-20 bg-linear-to-br from-blue-100 to-purple-100 dark:from-blue-900/30 dark:to-purple-900/30 rounded-full flex items-center justify-center mb-4">
                    <MessageSquare size={40} className="text-blue-600 dark:text-blue-400" />
                  </div>
                  <p className="font-semibold mb-2">Start a conversation</p>
                  <p className="text-sm">Send a message to begin chatting with {selected.name}</p>
                </div>
              ) : (
                selected.messages.map((msg,) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}
                  >
                    <div className={`max-w-xs lg:max-w-md px-4 py-3 rounded-2xl ${
                      msg.sender === 'user'
                        ? 'bg-linear-to-r from-blue-600 to-purple-600 text-white rounded-br-sm'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white rounded-bl-sm'
                    }`}>
                      <p className="text-sm shrink-0">{msg.text}</p>
                      <div className={`flex items-center justify-end gap-1 mt-1 text-xs ${
                        msg.sender === 'user'
                          ? 'text-blue-100'
                          : 'text-gray-500 dark:text-gray-400'
                      }`}>
                        <span>{msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        {msg.sender === 'user' && (
                          msg.read ? <CheckCheck size={14} /> : <Check size={14} />
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Input Area */}
            <div className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 p-4">
              <div className="flex items-end gap-3">
                <button className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors text-gray-600 dark:text-gray-300 shrink-0">
                  <Paperclip size={20} />
                </button>
                <input
                  type="text"
                  placeholder="Type a message..."
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                  className="flex-1 px-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                />
                <button className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors text-gray-600 dark:text-gray-300 shrink-0">
                  <Smile size={20} />
                </button>
                <button
                  onClick={handleSendMessage}
                  disabled={!messageInput.trim()}
                  className="p-2 bg-linear-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-all text-white shrink-0 shadow-md hover:shadow-lg"
                >
                  <Send size={20} />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center">
            <div className="w-24 h-24 bg-linear-to-br from-blue-100 to-purple-100 dark:from-blue-900/30 dark:to-purple-900/30 rounded-full flex items-center justify-center mb-6">
              <MessageSquare size={48} className="text-blue-600 dark:text-blue-400" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">No conversation selected</h2>
            <p className="text-gray-600 dark:text-gray-400 max-w-md">Select a conversation from the list or start a new one to begin messaging</p>
          </div>
        )}
      </div>
    </div>
  );
}