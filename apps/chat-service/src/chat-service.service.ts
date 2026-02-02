import { Injectable, Inject } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { PrismaService } from './prisma.service';
import { Redis } from 'ioredis';

@Injectable()
export class ChatService {
  constructor(
    private prisma: PrismaService,
    @Inject('CHAT_SERVICE') private readonly client: ClientProxy,
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
  ) { }

  async sendMessage(senderId: string, chatRoomId: string, content: string, attachmentUrl?: string | null) {
    // 1. Create Message in DB as PENDING
    const message = await this.prisma.message.create({
      data: {
        chatRoomId,
        senderId,
        content,
        attachmentUrl,
        status: 'PENDING',
        createdAt: new Date(),
      },
    });

    // 2. Add to Redis Queue (Producer) via RabbitMQ
    const payload = {
      messageId: message.id,
      senderId,
      chatRoomId,
      content,
      attachmentUrl,
      createdAt: message.createdAt
    };

    // 2.1 Cache Message in Redis (Store latest 50 messages)
    const redisKey = `chat:${chatRoomId}:messages`;
    await this.redis.lpush(redisKey, JSON.stringify(message));
    await this.redis.ltrim(redisKey, 0, 49); // Keep only top 50
    await this.redis.expire(redisKey, 3600); // Expire after 1 hour of inactivity

    this.client.emit('new-message', payload);

    console.log('ChatService.sendMessage result:', JSON.stringify(message, null, 2));
    return message as any;
  }

  async markMessageAsRead(messageId: string) {
    const message = await this.prisma.message.update({
      where: { id: messageId },
      data: { status: 'READ' },
    });
    return message as any;
  }

  async updateMessageStatus(messageId: string, status: 'SENT' | 'DELIVERED' | 'FAILED') {
    const message = await this.prisma.message.update({
      where: { id: messageId },
      data: { status },
    });
    return message as any;
  }

  async getChats(user: any) {
    if (user.role === 'AGENT') {
      // Agents see all chats
      const chats = await this.prisma.chatRoom.findMany({
        include: { messages: { take: 1, orderBy: { createdAt: 'desc' } } },
        orderBy: { updatedAt: 'desc' }
      });
      return chats as any;
    } else {
      // Customers see their own chats
      // Ideally we filter by customerEmail. We need to ensure user.email is available.
      const chats = await this.prisma.chatRoom.findMany({
        where: { customerEmail: user.email },
        include: { messages: { take: 1, orderBy: { createdAt: 'desc' } } },
        orderBy: { updatedAt: 'desc' }
      });
      return chats as any;
    }
  }

  async getMessages(chatRoomId: string, limit: number = 50, cursor?: string) {
    // 1. Try fetching from Redis first if no cursor (initial load)
    if (!cursor) {
      const redisKey = `chat:${chatRoomId}:messages`;
      const cachedMessages = await this.redis.lrange(redisKey, 0, limit - 1);

      if (cachedMessages.length > 0) {
        console.log(`Cache HIT for chatRoomId: ${chatRoomId}`);
        // Redis stores latest first (LPUSH), need to reverse to show oldest first if frontend expects that, 
        // OR if frontend expects newest first (which it implies by 'take: -limit' in DB query), 
        // then we need to be careful.
        // DB Query 'take: -limit, orderBy: createdAt: asc' means: 
        // Get the LAST 50 records sorted by createdAt ASC.
        // Effectively getting the *most recent* 50 messages, but returning them in chronological order.

        // REDIS LPUSH: [Newest, ..., Oldest]
        // LRANGE 0 49: [Newest, ..., Oldest]
        // We need to reverse this to match proper chronological order: [Oldest, ..., Newest]
        return cachedMessages.map((msg) => JSON.parse(msg)).reverse();
      }
    }

    console.log(`Cache MISS for chatRoomId: ${chatRoomId}, fetching from DB`);

    const options: any = {
      where: { chatRoomId },
      take: -limit, // Fetch from the end (newest first)
      orderBy: { createdAt: 'asc' },
    };

    if (cursor) {
      options.cursor = { id: cursor };
      options.skip = 1;
    }

    const messages = await this.prisma.message.findMany(options);

    // If no cursor (initial fetch) and we went to DB, populate Redis for next time
    // Note: This is an optimization we can add. But filling Redis from valid DB data is tricky 
    // because we need to ensure order. 
    // Let's just store NEW messages in Redis for now as per plan to avoid complexity with race conditions.
    // Or we can rebuild cache here if it was empty.

    if (!cursor && messages.length > 0) {
      const redisKey = `chat:${chatRoomId}:messages`;
      // Messages are [Oldest, ..., Newest]
      // Redis needs [Newest, ..., Oldest] via LPUSH
      // So we iterate messages in regular order and LPUSH them? No.
      // LPUSH adds to the LEFT. 
      // Msg1 (Old), Msg2 (New). 
      // LPUSH Msg1 -> [Msg1]
      // LPUSH Msg2 -> [Msg2, Msg1] -> Correct order for Redis list? 
      // Wait, if I read with LRANGE, I get [Msg2, Msg1]. 

      const pipeline = this.redis.pipeline();
      // To reconstruct, we want the LAST message to be at index 0 (Left).
      // So we need to push Oldest...Newest? 
      // If we push Oldest first: [Oldest]
      // Push Newer: [Newer, Oldest]...
      // Yes. So pushing in chronological order (ASC) works for LPUSH to stack them Newest-first.

      messages.forEach(msg => pipeline.lpush(redisKey, JSON.stringify(msg)));
      pipeline.ltrim(redisKey, 0, limit - 1);
      pipeline.expire(redisKey, 3600);
      await pipeline.exec();
    }

    return messages as any;
  }

  async createChatRoom(customerEmail: string) {
    return this.prisma.chatRoom.create({
      data: { customerEmail },
    });
  }

  async deleteChatRoom(id: string) {
    // Delete messages first (manual cascade)
    await this.prisma.message.deleteMany({
      where: { chatRoomId: id },
    });

    return this.prisma.chatRoom.delete({
      where: { id },
    });
  }
}
