import { Module } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloGatewayDriver, ApolloGatewayDriverConfig } from '@nestjs/apollo';
import { IntrospectAndCompose, RemoteGraphQLDataSource } from '@apollo/gateway';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { UploadController } from './upload.controller';

@Module({
  imports: [
    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), 'uploads'),
      serveRoot: '/uploads',
    }),
    GraphQLModule.forRoot<ApolloGatewayDriverConfig>({
      driver: ApolloGatewayDriver,
      server: {
        // playground: true, // Apollo Server 4 uses sandbox
        csrfPrevention: false,
      },
      gateway: {
        supergraphSdl: new IntrospectAndCompose({
          subgraphs: [
            { name: 'auth', url: process.env.AUTH_SERVICE_URL || 'http://auth-service:3001/graphql' },
            { name: 'chat', url: process.env.CHAT_SERVICE_URL || 'http://chat-service:3002/graphql' },
          ],
        }),
        buildService({ url }) {
          return new RemoteGraphQLDataSource({
            url,
            willSendRequest({ request, context }) {
              if (context.req && context.req.headers) {
                if (context.req.headers.authorization && request.http) {
                  request.http.headers.set('authorization', context.req.headers.authorization);
                }
              }
            },
          });
        },
      },
    }),
  ],
  controllers: [UploadController],
  providers: [],
})
export class GatewayModule { }
