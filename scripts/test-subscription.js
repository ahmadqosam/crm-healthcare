const { createClient } = require('graphql-ws');
const WebSocket = require('ws');

const client = createClient({
    url: 'ws://localhost:3002/graphql',
    webSocketImpl: WebSocket,
    on: {
        connected: () => console.log('✅ Connected to WebSocket'),
        closed: (event) => console.log(`❌ WebSocket closed: ${event.code} ${event.reason}`),
        error: (err) => console.log('❌ WebSocket error:', err),
    },
});

const QUERY = `
  subscription {
    messageReceived(chatRoomId: "test-room") {
      id
      content
    }
  }
`;

console.log('🔌 Connecting to ws://localhost:3002/graphql...');

const unsubscribe = client.subscribe(
    { query: QUERY },
    {
        next: (data) => console.log('📩 Received data:', data),
        error: (err) => console.error('❌ Subscription error:', err),
        complete: () => console.log('✅ Subscription complete'),
    }
);

// Keep alive for 5 seconds then exit
setTimeout(() => {
    console.log('⏱️ Test finished');
    unsubscribe();
    process.exit(0);
}, 5000);
