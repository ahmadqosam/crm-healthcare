import { Resolver, Mutation, Query, Args, Subscription } from '@nestjs/graphql';
import { ChatService } from './chat-service.service';
import { ChatRoom, Message, SendMessageInput, SendMessageResponse } from './chat.dto';
import { Inject, UseGuards } from '@nestjs/common';
import { RedisPubSub } from 'graphql-redis-subscriptions';
import { JwtAuthGuard } from './jwt-auth.guard';
import { CurrentUser } from './current-user.decorator';

@Resolver()
export class ChatServiceResolver {
    constructor(
        private readonly chatService: ChatService,
        @Inject('PUB_SUB') private readonly pubSub: RedisPubSub,
    ) { }

    @Mutation(() => Message)
    @UseGuards(JwtAuthGuard)
    async sendMessage(
        @Args('input') input: SendMessageInput,
        @CurrentUser() user: any
    ): Promise<Message> {
        // Use senderId from token if available (secure), otherwise fallback to input (legacy support if needed, or better: enforce token)
        const senderId = user.email || user.userId;
        return this.chatService.sendMessage(senderId, input.chatRoomId, input.content, input.attachmentUrl);
    }

    @Mutation(() => Message)
    @UseGuards(JwtAuthGuard)
    async markMessageAsRead(@Args('messageId') messageId: string): Promise<Message> {
        return this.chatService.markMessageAsRead(messageId);
    }

    @Query(() => [ChatRoom])
    @UseGuards(JwtAuthGuard)
    async getChats(@CurrentUser() user: any): Promise<ChatRoom[]> {
        return this.chatService.getChats(user);
    }

    @Query(() => [Message])
    @UseGuards(JwtAuthGuard)
    async getMessages(@Args('chatRoomId') chatRoomId: string): Promise<Message[]> {
        return this.chatService.getMessages(chatRoomId);
    }

    @Mutation(() => ChatRoom)
    @UseGuards(JwtAuthGuard)
    async createChatRoom(@CurrentUser() user: any): Promise<ChatRoom> {
        // Use email from token
        return this.chatService.createChatRoom(user.email);
    }

    @Mutation(() => Boolean)
    @UseGuards(JwtAuthGuard)
    async deleteChatRoom(@Args('id') id: string, @CurrentUser() user: any): Promise<boolean> {
        if (user.role !== 'AGENT') {
            throw new Error('Unauthorized');
        }
        await this.chatService.deleteChatRoom(id);
        return true;
    }

    @Subscription(() => Message, {
        filter: (payload, variables) => {
            return payload.messageReceived.chatRoomId === variables.chatRoomId;
        },
    })
    messageReceived(@Args('chatRoomId') chatRoomId: string) {
        return this.pubSub.asyncIterator('messageReceived');
    }
}
