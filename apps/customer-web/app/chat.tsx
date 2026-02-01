'use client';

import { useState, useEffect, useRef } from 'react';
import { gql } from '@apollo/client';
import { useQuery, useMutation, useSubscription } from '@apollo/client/react';
import { Paperclip, FileText, Clock, Check, CheckCheck, AlertCircle } from 'lucide-react';

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
        <div className="flex flex-col h-full">
            <div className="bg-white p-4 border-b flex justify-between items-center rounded-t shadow-sm">
                <h2 className="font-semibold text-gray-800">Support Chat</h2>
                <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">Secure</span>
            </div>
            <div className="flex-1 overflow-y-auto mb-4 border-x border-b p-4 bg-white shadow-sm flex flex-col gap-3">
                {data?.getMessages.map((msg: any) => {
                    const isMe = currentUserEmail && msg.senderId === currentUserEmail;
                    const hasAttachment = !!msg.attachmentUrl;
                    const isPdf = hasAttachment && msg.attachmentUrl.toLowerCase().endsWith('.pdf');

                    return (
                        <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                            <div className={`max-w-[80%] p-3 rounded-lg ${isMe ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-800'}`}>
                                {msg.content && <p className="mb-1">{msg.content}</p>}
                                {hasAttachment && (
                                    <div className="mt-2">
                                        {isPdf ? (
                                            <a href={msg.attachmentUrl} target="_blank" rel="noopener noreferrer" className={`flex items-center gap-2 p-2 rounded ${isMe ? 'bg-blue-700 hover:bg-blue-800' : 'bg-white hover:bg-gray-50'} transition-colors`}>
                                                <FileText size={20} />
                                                <span className="underline text-sm">View PDF</span>
                                            </a>
                                        ) : (
                                            <img src={msg.attachmentUrl} alt="Attachment" className="max-w-full rounded-md border border-gray-200" style={{ maxHeight: '200px' }} />
                                        )}
                                    </div>
                                )}
                            </div>
                            <div className="flex items-center gap-1 mt-1">
                                <span className="text-[10px] text-gray-400">{new Date(msg.createdAt).toLocaleTimeString()}</span>
                                {isMe && (
                                    <>
                                        {msg.status === 'PENDING' && <Clock size={12} className="text-gray-400" />}
                                        {msg.status === 'SENT' && <Check size={12} className="text-gray-400" />}
                                        {msg.status === 'DELIVERED' && <CheckCheck size={12} className="text-gray-400" />}
                                        {msg.status === 'READ' && <CheckCheck size={12} className="text-blue-500" />}
                                        {msg.status === 'FAILED' && (
                                            <div className="flex items-center gap-1">
                                                <AlertCircle size={12} className="text-red-500" />
                                                <button
                                                    onClick={() => handleSend(msg.attachmentUrl, undefined, msg.content)}
                                                    className="text-[10px] text-red-500 underline hover:text-red-600"
                                                >
                                                    Retry
                                                </button>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>
                    )
                })}
                {data?.getMessages.length === 0 && (
                    <div className="text-center text-gray-400 my-auto italic">No messages yet. Start the conversation!</div>
                )}
            </div>
            <div className="flex-none p-4 pb-8 md:pb-4 bg-white border-t md:rounded-b shadow-sm gap-2 flex flex-col">
                <div className="flex gap-2 items-center">
                    <input
                        type="file"
                        ref={fileInputRef}
                        className="hidden"
                        accept="image/*,application/pdf"
                        onChange={handleFileUpload}
                    />
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        className="p-3 text-gray-500 hover:bg-gray-100 rounded-full transition-colors"
                        title="Attach file"
                        disabled={isUploading}
                    >
                        {isUploading ? <div className="animate-spin h-5 w-5 border-2 border-gray-500 border-t-transparent rounded-full" /> : <Paperclip size={20} />}
                    </button>
                    <input
                        className="flex-1 border p-3 rounded-lg text-black focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm md:text-base"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                        placeholder="Type a message..."
                    />
                    <button onClick={() => handleSend()} className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium">Send</button>
                </div>
            </div>
        </div>
    );
}
