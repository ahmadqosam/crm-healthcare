'use client';

import { client } from '../lib/apollo-client';
import CustomerChatApp from './chat';
import AuthGuard from '../components/AuthGuard';

export default function Home() {
  return (
    <AuthGuard>
      <CustomerChatApp />
    </AuthGuard>
  );
}
