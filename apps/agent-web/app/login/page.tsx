'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { gql } from '@apollo/client';
import { useMutation } from '@apollo/client/react';
import { setToken } from '../../lib/auth';
import Link from 'next/link';
import { Lock, Mail, Stethoscope, ArrowRight, ShieldCheck } from 'lucide-react';

const LOGIN_MUTATION = gql`
  mutation Login($email: String!, $password: String!) {
    login(input: { email: $email, password: $password }) {
      accessToken
      user {
        id
        email
        role
      }
    }
  }
`;

export default function AgentLoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const router = useRouter();

    const [login, { loading }] = useMutation(LOGIN_MUTATION);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        try {
            const { data } = await login({
                variables: { email, password },
            });

            if (data?.login?.accessToken) {
                if (data.login.user.role !== 'AGENT') {
                    setError('Access denied. Valid Agent credentials required.');
                    return;
                }
                setToken(data.login.accessToken);
                router.push('/'); // Redirect to dashboard
            }
        } catch (err: any) {
            console.error("Login error:", err);
            setError(err.message || 'Invalid credentials');
        }
    };

    return (
        <div className="flex min-h-screen bg-gray-100">
            {/* Centered Card Layout for Agent/Admin */}
            <div className="m-auto w-full max-w-md">
                <div className="bg-white py-8 px-6 shadow-xl rounded-2xl border border-gray-100">
                    <div className="sm:mx-auto sm:w-full sm:max-w-md text-center mb-8">
                        <div className="mx-auto h-16 w-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mb-4">
                            <Stethoscope size={32} />
                        </div>
                        <h2 className="text-3xl font-extrabold text-gray-900">Provider Portal</h2>
                        <p className="mt-2 text-sm text-gray-600">
                            Secure access for Healthcare Professionals
                        </p>
                    </div>

                    <form className="space-y-6" onSubmit={handleSubmit}>
                        <div>
                            <label htmlFor="email" className="block text-sm font-medium text-gray-700">Work Email</label>
                            <div className="mt-1 relative rounded-md shadow-sm">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                                    <Mail size={18} />
                                </div>
                                <input
                                    id="email"
                                    name="email"
                                    type="email"
                                    autoComplete="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 text-black sm:text-sm"
                                    placeholder="agent@mediconnect.com"
                                />
                            </div>
                        </div>

                        <div>
                            <label htmlFor="password" className="block text-sm font-medium text-gray-700">Password</label>
                            <div className="mt-1 relative rounded-md shadow-sm">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                                    <Lock size={18} />
                                </div>
                                <input
                                    id="password"
                                    name="password"
                                    type="password"
                                    autoComplete="current-password"
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 text-black sm:text-sm"
                                    placeholder="••••••••"
                                />
                            </div>
                        </div>

                        {error && (
                            <div className="rounded-md bg-red-50 p-4 border border-red-200">
                                <div className="flex">
                                    <div className="flex-shrink-0">
                                        <ShieldCheck className="h-5 w-5 text-red-400" aria-hidden="true" />
                                    </div>
                                    <div className="ml-3">
                                        <h3 className="text-sm font-medium text-red-800">Authentication Error</h3>
                                        <div className="mt-1 text-sm text-red-700">
                                            {error}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div>
                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                            >
                                {loading ? 'Verifying...' : 'Access Dashboard'}
                            </button>
                        </div>
                    </form>

                    <div className="mt-6 text-center text-xs text-gray-400 space-y-2">
                        <p>
                            New Agent? <Link href="/register" className="text-blue-600 hover:underline">Create Account</Link>
                        </p>
                        <p>
                            Are you a patient? <a href="http://localhost:4000/login" className="text-blue-500 hover:underline">Go to Patient Login</a>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
