'use client';

import { useReactiveVar } from '@apollo/client/react';
import { wsStatusVar } from '../lib/apollo-client';
import { useEffect, useState } from 'react';
import React from 'react';
import { Wifi, WifiOff, Loader2 } from 'lucide-react';

export function ConnectionStatus() {
    const status = useReactiveVar(wsStatusVar);
    const [showLabel, setShowLabel] = useState(false);

    useEffect(() => {
        if (status !== 'connected') {
            setShowLabel(true);
            const timer = setTimeout(() => setShowLabel(false), 5000);
            return () => clearTimeout(timer);
        }
    }, [status]);

    if (status === 'connected' && !showLabel) {
        return null;
    }

    return (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2 rounded-full bg-background/80 px-4 py-2 text-sm font-medium shadow-lg backdrop-blur-sm border transition-all duration-300">
            {status === 'connected' && (
                <>
                    <Wifi className="h-4 w-4 text-green-500" />
                    <span className="text-green-600">Connected</span>
                </>
            )}
            {status === 'connecting' && (
                <>
                    <Loader2 className="h-4 w-4 animate-spin text-yellow-500" />
                    <span className="text-yellow-600">Connecting...</span>
                </>
            )}
            {status === 'disconnected' && (
                <>
                    <WifiOff className="h-4 w-4 text-red-500" />
                    <span className="text-red-600">Disconnected</span>
                </>
            )}
        </div>
    );
}
