'use client';

import { client } from '../lib/apollo-client';
import AgentDashboard from './agent-dashboard';
import AuthGuard from '../components/AuthGuard';

export default function Home() {
  return (
    <AuthGuard>
      <AgentDashboard />
    </AuthGuard>
  );
}
