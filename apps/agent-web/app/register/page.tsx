'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { gql } from '@apollo/client';
import { useMutation } from '@apollo/client/react';
import { setToken } from '../../lib/auth';
import Link from 'next/link';
import { Lock, Mail, Activity, UserPlus, Stethoscope, ShieldCheck } from 'lucide-react';

const REGISTER_MUTATION = gql`
  mutation Register($email: String!, $password: String!) {
    register(input: { email: $email, password: $password, role: AGENT }) {
      accessToken
      user {
        id
        email
        role
      }
    }
  }
`;

export default function AgentRegisterPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const router = useRouter();

    const [register, { loading }] = useMutation(REGISTER_MUTATION);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (password !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        try {
            const { data } = await register({
                variables: { email, password },
            });

            if (data?.register?.accessToken) {
                setToken(data.register.accessToken);
                router.push('/'); // Redirect to dashboard/home
            }
        } catch (err: any) {
            console.error("Register error:", err);
            setError(err.message || 'Registration failed');
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
                        <h2 className="text-3xl font-extrabold text-gray-900">Provider Registration</h2>
                        <p className="mt-2 text-sm text-gray-600">
                            Create a new secure provider account
                        </p>
                    </div>

                    <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
                        <div className="space-y-4">
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
                                        className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 text-black transition-colors"
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
                                        autoComplete="new-password"
                                        required
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 text-black transition-colors"
                                        placeholder="Min. 8 characters"
                                    />
                                </div>
                            </div>

                            <div>
                                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">Confirm Password</label>
                                <div className="mt-1 relative rounded-md shadow-sm">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                                        <Lock size={18} />
                                    </div>
                                    <input
                                        id="confirmPassword"
                                        name="confirmPassword"
                                        type="password"
                                        autoComplete="new-password"
                                        required
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 text-black transition-colors"
                                        placeholder="Confirm authentication credential"
                                    />
                                </div>
                            </div>
                        </div>

                        {error && (
                            <div className="rounded-md bg-red-50 p-4 border border-red-200">
                                <div className="flex">
                                    <div className="flex-shrink-0">
                                        <ShieldCheck className="h-5 w-5 text-red-400" aria-hidden="true" />
                                    </div>
                                    <div className="ml-3">
                                        <h3 className="text-sm font-medium text-red-800">Registration failed</h3>
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
                                className="w-full flex justify-center items-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all disabled:opacity-70 disabled:cursor-not-allowed"
                            >
                                {loading ? 'Processing...' : 'Create Provider Account'}
                                {!loading && <UserPlus size={16} className="ml-2" />}
                            </button>
                        </div>

                        <div className="text-center">
                            <p className="text-sm text-gray-600">
                                Already have credentials?{' '}
                                <Link href="/login" className="font-medium text-blue-600 hover:text-blue-500 hover:underline transition-colors">
                                    Sign in here
                                </Link>
                            </p>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
