import { Module } from '@nestjs/common';
import { ChatService } from './chat-service.service';
import { ChatServiceResolver } from './chat-service.resolver';
import { ChatConsumer } from './chat.consumer';
import { PrismaService } from './prisma.service';
import { BullModule } from '@nestjs/bullmq';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloFederationDriver, ApolloFederationDriverConfig } from '@nestjs/apollo';
import { RedisPubSub } from 'graphql-redis-subscriptions';
import { join } from 'path';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { JwtStrategy } from './jwt.strategy';

@Module({
  imports: [
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'supersecretkey',
      signOptions: { expiresIn: '1d' },
    }),
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
      },
    }),
    BullModule.registerQueue({
      name: 'message-queue',
    }),
    GraphQLModule.forRoot<ApolloFederationDriverConfig>({
      driver: ApolloFederationDriver,
      autoSchemaFile: {
        path: join(process.cwd(), 'apps/chat-service/src/schema.gql'),
        federation: 2,
      },
      sortSchema: true,
      playground: true,
      subscriptions: {
        'graphql-ws': true
      },
    }),
  ],
  controllers: [],
  providers: [
    ChatService,
    ChatServiceResolver,
    JwtStrategy,
    ChatConsumer,
    PrismaService,
    {
      provide: 'PUB_SUB',
      useFactory: () => {
        return new RedisPubSub({
          connection: {
            host: process.env.REDIS_HOST || 'localhost',
            port: parseInt(process.env.REDIS_PORT || '6379'),
          },
        });
      },
    },
  ],
})
export class ChatServiceModule { }
