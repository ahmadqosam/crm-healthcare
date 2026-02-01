'use client';

import React, { useState, useEffect, useRef } from 'react';
import { gql } from '@apollo/client';
import { useQuery, useMutation, useSubscription } from '@apollo/client/react';
import { Paperclip, FileText, Clock, Check, CheckCheck, AlertCircle, Lock } from 'lucide-react';

const CREATE_CHAT = gql`
  mutation CreateChatRoom {
    createChatRoom {
      id
      customerEmail
    }
  }
`;

const GET_MESSAGES = gql`
  query GetMessages($roomId: String!) {
    getMessages(chatRoomId: $roomId) {
      id
      senderId
      content
      attachmentUrl
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
      attachmentUrl
      status
      createdAt
    }
  }
`;

export default function CustomerChatApp() {
    const [roomId, setRoomId] = useState<string | null>(null);
    const [message, setMessage] = useState('');
    const [createChat, { loading: creating, error: createError }] = useMutation(CREATE_CHAT);

    useEffect(() => {
        // Auto-create/join chat room on mount
        const initChat = async () => {
            try {
                const res = await createChat();
                if (res.data?.createChatRoom) {
                    setRoomId(res.data.createChatRoom.id);
                }
            } catch (err) {
                console.error("Failed to initialize chat:", err);
            }
        };
        initChat();
    }, [createChat]);

    if (creating) {
        return (
            <div className="flex h-screen items-center justify-center bg-gray-50">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p className="text-gray-600">Initializing secure chat session...</p>
                </div>
            </div>
        );
    }

    if (createError) {
        return (
            <div className="flex h-screen items-center justify-center bg-gray-50">
                <div className="text-center text-red-600 max-w-md p-6 bg-white rounded shadow">
                    <p className="font-bold mb-2">Error starting chat</p>
                    <p className="text-sm">{createError.message}</p>
                    <button
                        onClick={() => window.location.reload()}
                        className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                    >
                        Retry
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-screen w-full bg-gray-50">
            {!roomId ? (
                <div className="m-auto text-gray-500">Preparing chat room...</div>
            ) : (
                <ChatRoom roomId={roomId} />
            )}
        </div>
    );
}

import { jwtDecode } from 'jwt-decode';
import { getToken } from '../lib/auth';

// ... (existing helper functions or component start)

function ChatRoom({ roomId }: { roomId: string }) {
    const { data, loading, subscribeToMore } = useQuery(GET_MESSAGES, {
        variables: { roomId },
    });
    const [sendMessage] = useMutation(SEND_MESSAGE);
    const [input, setInput] = useState('');
    const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

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

    // Setup Subscription
    useEffect(() => {
        const unsubscribe = subscribeToMore({
            document: MESSAGE_SUB,
            variables: { roomId },
            updateQuery: (prev, { subscriptionData }) => {
                if (!subscriptionData.data || !prev || !prev.getMessages) return prev;
                const newMessage = subscriptionData.data.messageReceived;

                // Prevent duplicates (e.g. if we already have it from mutation or double subscription)
                if (prev.getMessages.some((m: any) => m.id === newMessage.id)) {
                    return prev;
                }

                return {
                    ...prev,
                    getMessages: [...prev.getMessages, newMessage],
                };
            },
        });
        return () => unsubscribe();
    }, [roomId, subscribeToMore]);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        const formData = new FormData();
        formData.append('file', file);

        try {
            const res = await fetch('http://localhost:3000/upload', {
                method: 'POST',
                body: formData,
            });
            const data = await res.json();
            if (data.url) {
                await handleSend(data.url, file.type);
            }
        } catch (err) {
            console.error("Upload failed", err);
            alert("Failed to upload file");
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleSend = async (attachmentUrl?: string, fileType?: string, contentOverride?: string) => {
        const contentToSend = contentOverride !== undefined ? contentOverride : input;

        if (!contentToSend.trim() && !attachmentUrl) return;

        try {
            await sendMessage({
                variables: {
                    input: {
                        chatRoomId: roomId,
                        content: contentToSend || (attachmentUrl ? 'Sent an attachment' : ''),
                        attachmentUrl: attachmentUrl,
                    },
                },
            });
            if (contentOverride === undefined) setInput('');
        } catch (err) {
            console.error("Error sending message:", err);
        }
    };

    if (loading) return <p>Loading chat...</p>;

    return (
        <div className="flex flex-col h-full bg-[#efeae2] relative before:content-[''] before:absolute before:inset-0 before:opacity-5 before:pointer-events-none before:bg-[url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')]">
            {/* Header */}
            <div className="bg-white px-4 py-3 border-b flex justify-between items-center shadow-sm z-10 sticky top-0">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-teal-600 flex items-center justify-center text-white">
                        <span className="font-semibold text-sm">CS</span>
                    </div>
                    <div>
                        <h2 className="font-semibold text-slate-800 leading-tight">Medical Support</h2>
                        <div className="flex items-center gap-1.5">
                            <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                            </span>
                            <span className="text-xs text-slate-500">Online & Secure</span>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-[10px] uppercase font-bold text-teal-600 bg-teal-50 px-2 py-1 rounded-full border border-teal-100 flex items-center gap-1">
                        <Lock size={10} /> Encrypted
                    </span>
                </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 z-0 custom-scrollbar">
                {data?.getMessages.map((msg: any) => {
                    const isMe = currentUserEmail && msg.senderId === currentUserEmail;
                    const hasAttachment = !!msg.attachmentUrl;
                    const isPdf = hasAttachment && msg.attachmentUrl.toLowerCase().endsWith('.pdf');

                    return (
                        <div key={msg.id} className={`flex w-full ${isMe ? 'justify-end' : 'justify-start'}`}>
                            <div className={`relative max-w-[80%] px-3 py-2 text-sm shadow-sm
                                ${isMe
                                    ? 'bg-teal-100 text-slate-900 rounded-lg rounded-tr-none'
                                    : 'bg-white text-slate-900 rounded-lg rounded-tl-none'
                                }
                            `}>
                                {msg.content && <p className="mb-1 whitespace-pre-wrap leading-relaxed">{msg.content}</p>}

                                {hasAttachment && (
                                    <div className="mt-2 mb-1">
                                        {isPdf ? (
                                            <a href={msg.attachmentUrl} target="_blank" rel="noopener noreferrer" className={`flex items-center gap-2 p-3 rounded-md border ${isMe ? 'bg-teal-50 border-teal-200' : 'bg-slate-50 border-slate-200'} transition-colors`}>
                                                <div className="bg-red-500 text-white p-1.5 rounded">
                                                    <FileText size={16} />
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="font-medium text-xs truncate max-w-[150px]">Document.pdf</span>
                                                    <span className="text-[10px] opacity-70">Tap to view</span>
                                                </div>
                                            </a>
                                        ) : (
                                            <div className="rounded-lg overflow-hidden border border-black/10">
                                                <img src={msg.attachmentUrl} alt="Attachment" className="max-w-full h-auto object-cover" style={{ maxHeight: '200px' }} />
                                            </div>
                                        )}
                                    </div>
                                )}

                                <div className={`flex items-center justify-end gap-1 mt-1 text-[11px] ${isMe ? 'text-teal-800/60' : 'text-slate-400'}`}>
                                    <span>{new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                    {isMe && (
                                        <span className="ml-0.5">
                                            {msg.status === 'PENDING' && <Clock size={12} />}
                                            {msg.status === 'SENT' && <Check size={12} />}
                                            {msg.status === 'DELIVERED' && <CheckCheck size={12} />}
                                            {msg.status === 'READ' && <CheckCheck size={12} className="text-blue-500" />}
                                            {msg.status === 'FAILED' && <AlertCircle size={12} className="text-red-500" />}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    )
                })}
                {data?.getMessages.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full text-slate-400 opacity-60">
                        <div className="bg-slate-200 p-4 rounded-full mb-2">
                            <Lock className="w-6 h-6 text-slate-400" />
                        </div>
                        <p className="text-sm">Messages are end-to-end encrypted.</p>
                        <p className="text-xs">Start the consultation by saying hello.</p>
                    </div>
                )}
            </div>

            {/* Input Area */}
            <div className="p-3 bg-white border-t border-slate-200 z-10">
                <div className="flex items-end gap-2 max-w-4xl mx-auto">
                    <input
                        type="file"
                        ref={fileInputRef}
                        className="hidden"
                        accept="image/*,application/pdf"
                        onChange={handleFileUpload}
                    />
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        className="p-2.5 text-slate-500 hover:bg-slate-100 rounded-full transition-colors mb-0.5"
                        title="Attach file"
                        disabled={isUploading}
                    >
                        {isUploading ? <div className="animate-spin h-5 w-5 border-2 border-teal-500 border-t-transparent rounded-full" /> : <Paperclip size={22} />}
                    </button>

                    <div className="flex-1 bg-slate-100 rounded-2xl flex items-center border border-transparent focus-within:bg-white focus-within:border-teal-500 focus-within:ring-1 focus-within:ring-teal-500 transition-all">
                        <input
                            className="flex-1 bg-transparent border-none px-4 py-3 focus:outline-none text-slate-800 placeholder-slate-400 max-h-32 min-h-[44px]"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                            placeholder="Type your health concern..."
                        />
                    </div>

                    <button
                        onClick={() => handleSend()}
                        disabled={!input.trim() && !isUploading}
                        className={`p-3 rounded-full transition-all flex items-center justify-center mb-0.5 shadow-sm
                            ${input.trim()
                                ? 'bg-teal-600 hover:bg-teal-700 text-white transform hover:scale-105'
                                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                            }
                        `}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 ml-0.5"> {/* Send Icon */}
                            <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
                        </svg>
                    </button>
                </div>
            </div>
        </div>
    );
}
