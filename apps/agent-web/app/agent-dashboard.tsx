'use client';

import { useState, useEffect } from 'react';
import { gql } from '@apollo/client';
import { useQuery, useMutation, useSubscription } from '@apollo/client/react';
import Link from 'next/link';
import { Lock, Mail, Stethoscope, ArrowRight, ShieldCheck, Trash2, Clock, Check, CheckCheck, AlertCircle } from 'lucide-react';

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
  query GetMessages($roomId: String!) {
    getMessages(chatRoomId: $roomId) {
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

// ... (skipping unchanged parts is not possible with replace_file_content if they are in the target range, but I'll use separate calls or ensure I target correctly)
// Wait, I should probably do two replace calls for cleanliness or one large block if contiguous.
// They are not contiguous. SEND_MESSAGE is at line 31, Subscription logic at 150.
// I will use multi_replace checks.


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

export default function AgentDashboard() {
    const { data, loading, refetch } = useQuery(GET_CHATS);
    const [deleteChat] = useMutation(DELETE_CHAT);
    const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);

    const handleDelete = async (e: React.MouseEvent, chatId: string) => {
        e.stopPropagation(); // Prevent selecting the chat
        if (!confirm('Are you sure you want to delete this chat forever?')) return;

        try {
            await deleteChat({ variables: { id: chatId } });
            refetch();
            if (selectedRoomId === chatId) setSelectedRoomId(null);
        } catch (err) {
            console.error('Failed to delete chat:', err);
            alert('Failed to delete chat');
        }
    };

    return (
        <div className="flex h-screen bg-gray-100">
            {/* Sidebar */}
            <div className="w-1/3 bg-white border-r flex flex-col">
                <div className="p-4 border-b font-bold text-lg text-black flex justify-between items-center">
                    Agent Dashboard
                    <button onClick={() => refetch()} className="p-1 text-blue-600 hover:bg-blue-50 rounded">
                        <ArrowRight className="w-4 h-4 rotate-180" /> {/* Reuse icon as refresh for now or just text */}
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto">
                    {loading ? <p className="p-4 text-black">Loading chats...</p> : (
                        data?.getChats.map((chat: any) => (
                            <div
                                key={chat.id}
                                onClick={() => setSelectedRoomId(chat.id)}
                                className={`p-4 border-b cursor-pointer hover:bg-gray-50 flex justify-between items-center group ${selectedRoomId === chat.id ? 'bg-blue-50' : ''}`}
                            >
                                <div>
                                    <div className="font-semibold text-black">{chat.customerEmail || 'Anonymous'}</div>
                                    <div className="text-xs text-gray-500">{new Date(chat.updatedAt).toLocaleString()}</div>
                                    <div className="text-xs text-gray-400">{chat.status}</div>
                                </div>
                                <button
                                    onClick={(e) => handleDelete(e, chat.id)}
                                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded opacity-0 group-hover:opacity-100 transition-all"
                                    title="Delete Interaction"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Main Chat Area */}
            <div className="flex-1 flex flex-col">
                {selectedRoomId ? (
                    <ChatWindow roomId={selectedRoomId} agentId="agent-1" />
                ) : (
                    <div className="m-auto text-gray-400">Select a chat to start messaging</div>
                )}
            </div>
        </div>
    );
}

import { jwtDecode } from 'jwt-decode';
import { getToken } from '../lib/auth';

function ChatWindow({ roomId, agentId }: { roomId: string, agentId: string }) { // agentId prop deprecated, using token
    const { data, loading, subscribeToMore } = useQuery(GET_MESSAGES, {
        variables: { roomId },
    });
    const [sendMessage] = useMutation(SEND_MESSAGE);
    const [input, setInput] = useState('');
    const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);

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
        const unsubscribe = subscribeToMore({
            document: MESSAGE_SUB,
            variables: { roomId },
            updateQuery: (prev, { subscriptionData }) => {
                if (!subscriptionData.data || !prev || !prev.getMessages) return prev;
                const newMessage = subscriptionData.data.messageReceived;

                // Prevent duplicates
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

    const handleSend = async () => {
        if (!input.trim()) return;
        await sendMessage({
            variables: {
                input: {
                    chatRoomId: roomId,
                    content: input,
                    // senderId inferred
                },
            },
        });
        setInput('');
    };

    if (loading) return <p className="p-4 text-black">Loading messages...</p>;

    return (
        <div className="flex flex-col h-full">
            <div className="p-4 border-b bg-white font-bold text-black flex justify-between">
                <span>Chat Room</span>
                <span className="text-xs text-gray-500 font-normal">{roomId}</span>
            </div>
            <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
                {data?.getMessages.map((msg: any) => {
                    const isMe = currentUserEmail && msg.senderId === currentUserEmail;
                    return (
                        <div key={msg.id} className={`mb-2 flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[70%] p-2 rounded ${isMe ? 'bg-blue-600 text-white' : 'bg-white border text-black'}`}>
                                <div className="text-sm">{msg.content}</div>
                                <div className="text-[10px] opacity-70 mt-1 flex justify-between items-center gap-2">
                                    <span>{msg.senderId}</span>
                                    {isMe && (
                                        <div className="flex items-center">
                                            {msg.status === 'PENDING' && <Clock size={12} className="text-white/70" />}
                                            {msg.status === 'SENT' && <Check size={12} className="text-white/70" />}
                                            {msg.status === 'DELIVERED' && <CheckCheck size={12} className="text-white/70" />}
                                            {msg.status === 'READ' && <CheckCheck size={12} className="text-blue-200" />}
                                            {msg.status === 'FAILED' && <AlertCircle size={12} className="text-red-300" />}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
            <div className="p-4 bg-white border-t flex gap-2">
                <input
                    className="flex-1 border p-2 rounded text-black focus:outline-none focus:ring-1 focus:ring-blue-500"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                    placeholder="Type a reply..."
                />
                <button onClick={handleSend} className="bg-blue-600 text-white px-4 rounded hover:bg-blue-700">Send</button>
            </div>
        </div>
    );
}
