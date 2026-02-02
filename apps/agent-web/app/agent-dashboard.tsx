'use client';

import React, { useState, useEffect, useRef } from 'react';
import { gql } from '@apollo/client';
import { useQuery, useMutation, useSubscription } from '@apollo/client/react';
import {
    Search, MoreVertical, Phone, Video,
    Paperclip, Mic, Smile, Send,
    Check, CheckCheck, Clock, AlertCircle, Trash2
} from 'lucide-react';
import { jwtDecode } from 'jwt-decode';
import { getToken } from '../lib/auth';

const GET_CHATS = gql`
  query GetChats {
    getChats {
      id
      customerEmail
      status
      updatedAt
    }
  }
`;

const GET_MESSAGES = gql`
  query GetMessages($roomId: String!, $limit: Int, $cursor: String) {
    getMessages(chatRoomId: $roomId, limit: $limit, cursor: $cursor) {
      id
      senderId
      content
      status
      createdAt
    }
  }
`;

const SEND_MESSAGE = gql`
  mutation SendMessage($input: SendMessageInput!) {
    sendMessage(input: $input) {
      id
      status
      createdAt
    }
  }
`;

const MESSAGE_SUB = gql`
  subscription OnMessageReceived($roomId: String!) {
    messageReceived(chatRoomId: $roomId) {
      id
      senderId
      content
      createdAt
    }
  }
`;

const DELETE_CHAT = gql`
  mutation DeleteChat($id: String!) {
    deleteChatRoom(id: $id)
  }
`;

// Helper to generate initials
const getInitials = (email: string) => {
    return email ? email.substring(0, 2).toUpperCase() : '??';
};

// Helper for random soft background color based on string
const getAvatarColor = (str: string) => {
    const colors = ['bg-red-100 text-red-600', 'bg-green-100 text-green-600', 'bg-blue-100 text-blue-600', 'bg-yellow-100 text-yellow-600', 'bg-purple-100 text-purple-600', 'bg-pink-100 text-pink-600'];
    let hash = 0;
    if (!str) return colors[0];
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
};

export default function AgentDashboard() {
    const { data, loading, refetch } = useQuery(GET_CHATS);
    const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
    const [deleteChatRoom] = useMutation(DELETE_CHAT);

    const handleDeleteChat = async (id: string) => {
        try {
            await deleteChatRoom({
                variables: { id },
                refetchQueries: [{ query: GET_CHATS }],
            });
            if (selectedRoomId === id) {
                setSelectedRoomId(null);
            }
        } catch (error) {
            console.error('Error deleting chat:', error);
            alert('Failed to delete chat');
        }
    };

    return (
        <div className="flex h-screen bg-slate-50 overflow-hidden">
            {/* Sidebar */}
            <div className="w-[400px] bg-white border-r border-slate-200 flex flex-col shadow-sm z-10">
                {/* Sidebar Header */}
                <div className="h-16 bg-slate-100 flex items-center justify-between px-4 border-b border-slate-200">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-teal-600 flex items-center justify-center text-white font-semibold">
                            AG
                        </div>
                        <h1 className="font-semibold text-slate-700">Agent Console</h1>
                    </div>
                </div>

                {/* Search Bar */}
                <div className="p-3 bg-white border-b border-slate-100">
                    <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Search className="h-4 w-4 text-slate-400" />
                        </div>
                        <input
                            type="text"
                            className="block w-full pl-10 pr-3 py-2 border border-slate-200 rounded-lg leading-5 bg-slate-50 text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-1 focus:ring-teal-500 focus:border-teal-500 sm:text-sm transition duration-150 ease-in-out"
                            placeholder="Search or start new chat"
                        />
                    </div>
                </div>

                {/* Chat List */}
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center h-full text-slate-400">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600 mb-2"></div>
                            <span className="text-sm">Loading conversations...</span>
                        </div>
                    ) : (
                        data?.getChats.map((chat: any) => (
                            <div
                                key={chat.id}
                                onClick={() => setSelectedRoomId(chat.id)}
                                className={`group flex items-center px-4 py-3 cursor-pointer border-b border-slate-50 hover:bg-slate-50 transition-colors ${selectedRoomId === chat.id ? 'bg-slate-100' : ''}`}
                            >
                                <div className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center font-medium text-sm mr-4 ${getAvatarColor(chat.customerEmail)}`}>
                                    {getInitials(chat.customerEmail)}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex justify-between items-baseline mb-1">
                                        <h3 className="text-sm font-semibold text-slate-900 truncate">
                                            {chat.customerEmail || 'Anonymous Patient'}
                                        </h3>
                                        <span className="text-xs text-slate-400">
                                            {new Date(chat.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <p className="text-sm text-slate-500 truncate pr-2">
                                            {/* Mocking last message for now as it's not in the list query efficiently yet */}
                                            {chat.status}
                                        </p>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (window.confirm('Are you sure you want to delete this chat?')) {
                                                    handleDeleteChat(chat.id);
                                                }
                                            }}
                                            className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors opacity-0 group-hover:opacity-100"
                                            title="Delete Chat"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Chat Area */}
            <div className="flex-1 flex flex-col relative bg-[#efeae2] before:content-[''] before:absolute before:inset-0 before:opacity-10 before:pointer-events-none before:bg-[url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')]">

                <div className="flex-1 flex flex-col h-full bg-[#f0f2f5]/50 relative z-10">
                    {selectedRoomId ? (
                        <ChatWindow roomId={selectedRoomId} agentId="agent-1" />
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center bg-[#f0f2f5] border-b-8 border-teal-600 text-center p-10">
                            <div className="w-64 h-64 bg-slate-200 rounded-full flex items-center justify-center mb-8 opacity-50">
                                <Search className="h-32 w-32 text-slate-400" />
                            </div>
                            <h2 className="text-3xl font-light text-slate-700 mb-4">CRMCare <span className="font-semibold text-teal-600">Connect</span></h2>
                            <p className="text-slate-500 max-w-md">
                                Select a patient conversation from the sidebar to start reviewing medical inquiries securely.
                            </p>
                            <div className="mt-8 flex items-center text-slate-400 text-sm">
                                Encrypted connection active
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}


function ChatWindow({ roomId }: { roomId: string, agentId: string }) {
    const { data, loading, subscribeToMore } = useQuery(GET_MESSAGES, {
        variables: { roomId },
    });
    const [sendMessage] = useMutation(SEND_MESSAGE);
    const [input, setInput] = useState('');
    const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        const token = getToken();
        if (token) {
            try {
                const decoded: any = jwtDecode(token);
                setCurrentUserEmail(decoded.email);
            } catch (e) {
                console.error("Failed to decode token", e);
            }
        }
    }, []);

    useEffect(() => {
        scrollToBottom();
    }, [data?.getMessages]);

    useEffect(() => {
        const unsubscribe = subscribeToMore({
            document: MESSAGE_SUB,
            variables: { roomId },
            updateQuery: (prev, { subscriptionData }) => {
                if (!subscriptionData.data || !prev || !prev.getMessages) return prev;
                const newMessage = subscriptionData.data.messageReceived;
                if (prev.getMessages.some((m: any) => m.id === newMessage.id)) return prev;
                return {
                    ...prev,
                    getMessages: [...prev.getMessages, newMessage],
                };
            },
        });
        return () => unsubscribe();
    }, [roomId, subscribeToMore]);

    const handleSend = async () => {
        if (!input.trim()) return;
        await sendMessage({
            variables: {
                input: {
                    chatRoomId: roomId,
                    content: input,
                },
            },
        });
        setInput('');
    };

    if (loading) return <div className="flex-1 flex items-center justify-center p-4 text-slate-500">Retrieving secure history...</div>;

    // Sort messages by date
    const sortedMessages = data?.getMessages ? [...data.getMessages].sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) : [];

    return (
        <div className="flex flex-col h-full z-10 bg-[#efeae2] bg-opacity-95">
            {/* Header */}
            <div className="h-16 px-4 py-2 bg-[#f0f2f5] border-b border-slate-300 flex justify-between items-center shrink-0 shadow-sm z-20">
                <div className="flex items-center cursor-pointer">
                    <div className="w-10 h-10 rounded-full bg-slate-300 flex items-center justify-center mr-3 overflow-hidden">
                        <div className="text-slate-500 font-bold text-lg">
                            {roomId.substring(0, 1).toUpperCase()}
                        </div>
                    </div>
                    <div className="flex flex-col justify-center">
                        <span className="font-semibold text-slate-800 text-md truncate max-w-[200px]">Patient {roomId}</span>
                        <span className="text-xs text-teal-600 truncate">Online</span>
                    </div>
                </div>
                <div className="flex items-center space-x-4 text-slate-500">
                    <div className="p-2 hover:bg-slate-200 rounded-full cursor-pointer transition">
                        <Search className="w-5 h-5" />
                    </div>
                    <div className="p-2 hover:bg-slate-200 rounded-full cursor-pointer transition">
                        <Phone className="w-5 h-5" />
                    </div>
                    <div className="p-2 hover:bg-slate-200 rounded-full cursor-pointer transition">
                        <MoreVertical className="w-5 h-5" />
                    </div>
                </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 custom-scrollbar">
                {sortedMessages.map((msg: any) => {
                    const isMe = currentUserEmail && msg.senderId === currentUserEmail;
                    return (
                        <div key={msg.id} className={`flex w-full ${isMe ? 'justify-end' : 'justify-start'}`}>
                            <div className={`relative max-w-[65%] sm:max-w-[75%] px-3 py-2 text-sm shadow-sm
                                ${isMe
                                    ? 'bg-teal-100 text-slate-900 rounded-lg rounded-tr-none'
                                    : 'bg-white text-slate-900 rounded-lg rounded-tl-none'
                                }
                            `}>
                                <div className="break-words leading-relaxed text-[15px]">
                                    {msg.content}
                                </div>
                                <div className={`flex items-center justify-end gap-1 mt-1 text-[11px] ${isMe ? 'text-teal-700/70' : 'text-slate-400'}`}>
                                    <span>
                                        {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                    {isMe && (
                                        <span className="ml-1">
                                            {msg.status === 'READ' ? <CheckCheck size={14} className="text-blue-500" /> :
                                                msg.status === 'DELIVERED' ? <CheckCheck size={14} className="text-slate-400" /> :
                                                    <Check size={14} className="text-slate-400" />}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="min-h-[62px] px-4 py-2 bg-[#f0f2f5] flex items-center gap-2 border-t border-slate-200">
                <button className="p-2 text-slate-500 hover:bg-slate-200 rounded-full transition">
                    <Smile className="w-6 h-6" />
                </button>
                <button className="p-2 text-slate-500 hover:bg-slate-200 rounded-full transition">
                    <Paperclip className="w-6 h-6" />
                </button>
                <div className="flex-1 bg-white rounded-lg flex items-center border border-slate-200 focus-within:ring-2 focus-within:ring-teal-500 focus-within:border-transparent transition-all px-4 py-2">
                    <input
                        className="flex-1 bg-transparent border-none outline-none text-slate-800 placeholder-slate-400 text-sm"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                        placeholder="Type a message..."
                    />
                </div>
                {input.trim() ? (
                    <button
                        onClick={handleSend}
                        className="p-3 bg-teal-600 hover:bg-teal-700 text-white rounded-full transition shadow-sm flex items-center justify-center"
                    >
                        <Send className="w-5 h-5 ml-0.5" />
                    </button>
                ) : (
                    <button className="p-3 text-slate-500 hover:bg-slate-200 rounded-full transition">
                        <Mic className="w-6 h-6" />
                    </button>
                )}
            </div>
        </div>
    );
}
