import { ApolloClient, InMemoryCache, HttpLink, split, from, Observable } from '@apollo/client';
import { setContext } from '@apollo/client/link/context';
import { GraphQLWsLink } from '@apollo/client/link/subscriptions';
import { createClient } from 'graphql-ws';
import { getMainDefinition } from '@apollo/client/utilities';
import { onError } from '@apollo/client/link/error';
import { getToken, getRefreshToken, setToken, setRefreshToken, removeToken } from './auth';

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

const errorLink = onError(({ graphQLErrors, operation, forward }) => {
    if (graphQLErrors) {
        for (const err of graphQLErrors) {
            if (err.extensions?.code === 'UNAUTHENTICATED') {
                return new Observable(observer => {
                    const refreshToken = getRefreshToken();
                    if (!refreshToken) {
                        removeToken();
                        window.location.reload();
                        return;
                    }

                    // Perform refresh logic
                    fetch('http://localhost:3000/graphql', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            query: `
                                mutation RefreshToken($token: String!) {
                                    refreshToken(token: $token) {
                                        accessToken
                                        refreshToken
                                    }
                                }
                            `,
                            variables: { token: refreshToken }
                        })
                    })
                        .then(res => res.json())
                        .then(data => {
                            if (data.data?.refreshToken) {
                                const { accessToken, refreshToken: newRefreshToken } = data.data.refreshToken;
                                setToken(accessToken);
                                setRefreshToken(newRefreshToken);

                                // Retry the failed request
                                const oldHeaders = operation.getContext().headers;
                                operation.setContext({
                                    headers: {
                                        ...oldHeaders,
                                        authorization: `Bearer ${accessToken}`,
                                    },
                                });

                                const subscriber = {
                                    next: observer.next.bind(observer),
                                    error: observer.error.bind(observer),
                                    complete: observer.complete.bind(observer),
                                };

                                forward(operation).subscribe(subscriber);
                            } else {
                                // Refresh failed
                                removeToken();
                                window.location.reload();
                            }
                        })
                        .catch(() => {
                            removeToken();
                            window.location.reload();
                        });
                });
            }
        }
    }
});

import { makeVar } from '@apollo/client';

export type ConnectionStatus = 'connected' | 'connecting' | 'disconnected';
export const wsStatusVar = makeVar<ConnectionStatus>('disconnected');



// Refactoring to capture client instance
let wsClient: ReturnType<typeof createClient> | null = null;

if (typeof window !== 'undefined') {
    wsClient = createClient({
        url: 'ws://localhost:3002/graphql', // Direct to Chat Service for subscriptions (or use Gateway if WS supported)
        retryAttempts: Infinity,
        keepAlive: 10_000,
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
            // Force close to trigger immediate reconnection (assuming active subscriptions)
            // or just rely on keep-alive if connection is still good.
            // But user asked to "auto-connect ... in-case it has been idle or just been revisited"
            // Terminating confirms a fresh check.
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
        from([errorLink, authLink, httpLink]), // Chain error > auth > http
    )
    : from([errorLink, authLink, httpLink]);

export const client = new ApolloClient({
    link: splitLink,
    cache: new InMemoryCache(),
});
