import { Module } from '@nestjs/common';
import { ChatService } from './chat-service.service';
import { ChatServiceResolver } from './chat-service.resolver';
import { ChatController } from './chat.controller';
import { PrismaService } from './prisma.service';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloFederationDriver, ApolloFederationDriverConfig } from '@nestjs/apollo';
import { RedisPubSub } from 'graphql-redis-subscriptions';
import { Redis } from 'ioredis';
import { join } from 'path';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { JwtStrategy } from './jwt.strategy';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { RabbitMQSetupService } from './rabbitmq-setup.service';

import { ScheduleModule } from '@nestjs/schedule';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'supersecretkey',
      signOptions: { expiresIn: '1d' },
    }),
    ClientsModule.register([
      {
        name: 'CHAT_SERVICE',
        transport: Transport.RMQ,
        options: {
          urls: [`amqp://${process.env.RABBITMQ_USER || 'guest'}:${process.env.RABBITMQ_PASS || 'guest'}@${process.env.RABBITMQ_HOST || 'localhost'}:5672`],
          queue: 'chat_queue',
          queueOptions: {
            durable: true,
            arguments: {
              'x-dead-letter-exchange': 'chat_dlx',
              'x-dead-letter-routing-key': 'chat_dlq',
            },
          },
        },
      },
    ]),
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
  controllers: [ChatController],
  providers: [
    ChatService,
    ChatServiceResolver,
    JwtStrategy,
    PrismaService,
    RabbitMQSetupService,
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
    {
      provide: 'REDIS_CLIENT',
      useFactory: () => {
        return new Redis({
          host: process.env.REDIS_HOST || 'localhost',
          port: parseInt(process.env.REDIS_PORT || '6379'),
        });
      },
    },
  ],
})
export class ChatServiceModule { }
