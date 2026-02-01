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

// Implementation of WebSocket Link depends on environment (browser only)
const wsLink = typeof window !== 'undefined'
    ? new GraphQLWsLink(createClient({
        url: 'ws://localhost:3002/graphql',
        connectionParams: () => {
            const token = getToken();
            return {
                Authorization: token ? `Bearer ${token}` : '',
            };
        },
    }))
    : null;

const splitLink = typeof window !== 'undefined' && wsLink
    ? split(
        ({ query }) => {
            const definition = getMainDefinition(query);
            return (
                definition.kind === 'OperationDefinition' &&
                definition.operation === 'subscription'
            );
        },
        wsLink,
        authLink.concat(httpLink),
    )
    : authLink.concat(httpLink);

export const client = new ApolloClient({
    link: splitLink,
    cache: new InMemoryCache(),
});
