'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { isAuthenticated } from '../lib/auth';
import { Activity } from 'lucide-react';

export default function AuthGuard({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const [authorized, setAuthorized] = useState(false);

    useEffect(() => {
        if (!isAuthenticated()) {
            router.push('/login');
        } else {
            setAuthorized(true);
        }
    }, [router]);

    if (!authorized) {
        return (
            <div className="flex h-screen w-full items-center justify-center bg-gray-50">
                <div className="flex flex-col items-center animate-pulse">
                    <div className="p-3 bg-blue-100 rounded-full mb-4">
                        <Activity className="h-8 w-8 text-blue-900" />
                    </div>
                    <p className="text-gray-500 font-medium">Verifying access...</p>
                </div>
            </div>
        );
    }

    return <>{children}</>;
}
