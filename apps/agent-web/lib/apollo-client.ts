import { ApolloClient, InMemoryCache, HttpLink, split } from '@apollo/client';
import { setContext } from '@apollo/client/link/context';
import { GraphQLWsLink } from '@apollo/client/link/subscriptions';
import { createClient } from 'graphql-ws';
import { getMainDefinition } from '@apollo/client/utilities';
import { getToken } from './auth';

const httpLink = new HttpLink({
    uri: 'http://localhost:3000/graphql',
});

const authLink = setContext((_, { headers }) => {
    const token = getToken();
    return {
        headers: {
            ...headers,
            authorization: token ? `Bearer ${token}` : '',
        },
    };
});

import { makeVar } from '@apollo/client';

export type ConnectionStatus = 'connected' | 'connecting' | 'disconnected';
export const wsStatusVar = makeVar<ConnectionStatus>('disconnected');

// Refactoring to capture client instance
let wsClient: ReturnType<typeof createClient> | null = null;

if (typeof window !== 'undefined') {
    wsClient = createClient({
        url: 'ws://localhost:3002/graphql',
        retryAttempts: Infinity,
        keepAlive: 10_000, // 10 seconds keep-alive
        shouldRetry: () => true,
        connectionParams: () => {
            const token = getToken();
            return {
                Authorization: token ? `Bearer ${token}` : '',
            };
        },
        on: {
            connected: () => wsStatusVar('connected'),
            connecting: () => wsStatusVar('connecting'),
            closed: () => wsStatusVar('disconnected'),
            error: () => wsStatusVar('disconnected'),
        },
    });
}

const finalWsLink = typeof window !== 'undefined' && wsClient
    ? new GraphQLWsLink(wsClient)
    : null;

if (typeof window !== 'undefined' && wsClient) {
    const handleRevisit = () => {
        if (document.visibilityState === 'visible') {
            wsClient?.terminate();
        }
    };

    window.addEventListener('visibilitychange', handleRevisit);
    window.addEventListener('focus', handleRevisit);
}

const splitLink = typeof window !== 'undefined' && finalWsLink
    ? split(
        ({ query }) => {
            const definition = getMainDefinition(query);
            return (
                definition.kind === 'OperationDefinition' &&
                definition.operation === 'subscription'
            );
        },
        finalWsLink,
        authLink.concat(httpLink),
    )
    : authLink.concat(httpLink);

export const client = new ApolloClient({
    link: splitLink,
    cache: new InMemoryCache(),
});
