'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { gql } from '@apollo/client';
import { useMutation } from '@apollo/client/react';
import { setToken } from '../../lib/auth';
import Link from 'next/link';
import { Lock, Mail, Activity, ArrowRight, UserPlus } from 'lucide-react';

const REGISTER_MUTATION = gql`
  mutation Register($email: String!, $password: String!) {
    register(input: { email: $email, password: $password, role: CUSTOMER }) {
      accessToken
      user {
        id
        email
        role
      }
    }
  }
`;

export default function RegisterPage() {
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
        <div className="flex min-h-screen bg-gray-50">
            {/* Left Panel - Branding */}
            <div className="hidden lg:flex w-1/2 bg-blue-900 text-white flex-col justify-center px-12 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-full opacity-10 flex flex-wrap gap-4 p-8 transform rotate-12 scale-150">
                    {/* Decorative Background Pattern */}
                    {Array.from({ length: 20 }).map((_, i) => (
                        <Activity key={i} size={100} />
                    ))}
                </div>

                <div className="relative z-10 max-w-lg">
                    <div className="flex items-center gap-3 mb-8">
                        <div className="p-3 bg-white/10 rounded-lg backdrop-blur-sm">
                            <Activity size={32} />
                        </div>
                        <h1 className="text-3xl font-bold tracking-tight">MediConnect CRM</h1>
                    </div>
                    <h2 className="text-4xl font-bold leading-tight mb-6">
                        Join our Healthcare <br /> Community today.
                    </h2>
                    <p className="text-blue-100 text-lg leading-relaxed">
                        Create an account to access personalized support, manage your health records, and connect with specialists instantly.
                    </p>
                </div>
            </div>

            {/* Right Panel - Register Form */}
            <div className="flex-1 flex flex-col justify-center items-center px-6 lg:px-24 py-12">
                <div className="w-full max-w-md space-y-8">
                    <div className="text-center lg:text-left">
                        <h2 className="text-3xl font-bold text-gray-900 tracking-tight">Create Account</h2>
                        <p className="mt-2 text-gray-600">Enter your details to get started.</p>
                    </div>

                    <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
                        <div className="space-y-4">
                            <div>
                                <label htmlFor="email" className="block text-sm font-medium text-gray-700">Email address</label>
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
                                        placeholder="name@company.com"
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
                                        placeholder="Confirm your password"
                                    />
                                </div>
                            </div>
                        </div>

                        {error && (
                            <div className="rounded-md bg-red-50 p-4 border border-red-200">
                                <div className="flex">
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
                                className="w-full flex justify-center items-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-900 hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all disabled:opacity-70 disabled:cursor-not-allowed"
                            >
                                {loading ? 'Creating account...' : 'Create Account'}
                                {!loading && <UserPlus size={16} className="ml-2" />}
                            </button>
                        </div>

                        <div className="text-center">
                            <p className="text-sm text-gray-600">
                                Already have an account?{' '}
                                <Link href="/login" className="font-medium text-blue-900 hover:text-blue-800 hover:underline transition-colors">
                                    Sign in instead
                                </Link>
                            </p>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
