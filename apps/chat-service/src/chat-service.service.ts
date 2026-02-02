import { Injectable, Inject, Logger } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { PrismaService } from './prisma.service';
import { Redis } from 'ioredis';
import { Cron, CronExpression } from '@nestjs/schedule';
import { v4 as uuidv4 } from 'uuid';
import * as amqp from 'amqplib';

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    private prisma: PrismaService,
    @Inject('CHAT_SERVICE') private readonly client: ClientProxy,
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
  ) { }

  async sendMessage(senderId: string, chatRoomId: string, content: string, attachmentUrl?: string | null) {
    // 1. Generate ID immediately (App-side)
    const messageId = uuidv4();
    const createdAt = new Date();

    const messageData = {
      id: messageId,
      chatRoomId,
      senderId,
      content,
      attachmentUrl,
      status: 'PENDING',
      createdAt,
    };

    const payload = { ...messageData, messageId }; // Payload for Queue

    // 2. Optimistic: Write to Redis & Queue (Blocking only on Redis/Queue which is fast)
    const redisKey = `chat:${chatRoomId}:messages`;
    await this.redis.lpush(redisKey, JSON.stringify(messageData));
    await this.redis.ltrim(redisKey, 0, 49);
    await this.redis.expire(redisKey, 3600);

    try {
      this.client.emit('new-message', payload);
    } catch (error) {
      this.logger.error(`Failed to emit message ${messageId} to queue`, error);
    }

    // 3. Async DB Write (Write-Behind)
    // We don't await this to return fast to user, BUT we need to handle failure!
    // Actually, to ensure data safety, we should probably wait for *persistence* somewhere.
    // Proposal: We wait for "Fastest Persistence" (Redis is already done).
    // So we just fire-and-forget the DB write? No, if the pod dies, we lose data if Redis flushes.
    // Better: We try to write to DB with a timeout. If it fails, we write to a Persistent Redis List.

    this.writeToDbOrFallback(messageData);

    console.log('ChatService.sendMessage (Optimistic) result:', JSON.stringify(messageData, null, 2));
    return messageData as any;
  }

  private async writeToDbOrFallback(messageData: any) {
    try {
      // Race: DB Write vs 2s Timeout
      await Promise.race([
        this.prisma.message.create({ data: messageData }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('DB Timeout')), 2000))
      ]);
    } catch (error) {
      this.logger.warn(`DB Write failed/timed-out for ${messageData.id}. Pushing to Fallback List.`);
      // Push to Fallback List
      await this.redis.rpush('chat:fallback:messages', JSON.stringify(messageData));
    }
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
  @Cron(CronExpression.EVERY_MINUTE)
  async rescuePendingMessages() {
    this.logger.log('Running rescuePendingMessages job...');

    if (!(await this.isDatabaseAvailable())) {
      this.logger.warn('Database is down. Skipping rescue job to prevent retry exhaustion.');
      return;
    }

    const oneMinuteAgo = new Date(Date.now() - 60 * 1000);

    // Find messages that are still PENDING and created more than 1 minute ago
    const pendingMessages = await this.prisma.message.findMany({
      where: {
        status: 'PENDING',
        createdAt: {
          lt: oneMinuteAgo,
        },
      },
      take: 50, // Process in batches
    });

    if (pendingMessages.length === 0) {
      return;
    }

    this.logger.log(`Found ${pendingMessages.length} pending messages to rescue.`);

    for (const message of pendingMessages) {
      const payload = {
        messageId: message.id,
        senderId: message.senderId,
        chatRoomId: message.chatRoomId,
        content: message.content,
        attachmentUrl: message.attachmentUrl,
        createdAt: message.createdAt
      };

      try {
        this.client.emit('new-message', payload);
        this.logger.log(`Rescued message ${message.id}: Re-emitted to queue.`);
      } catch (error) {
        this.logger.error(`Failed to rescue message ${message.id}`, error);
      }
    }
    // 2. Process Fallback List (Failed DB Writes from Optimistic Sends)
    const fallbackMessages = await this.redis.lrange('chat:fallback:messages', 0, 49);
    if (fallbackMessages.length > 0) {
      this.logger.log(`Found ${fallbackMessages.length} messages in Fallback List. Syncing to DB (Bulk)...`);

      const messagesToSync = fallbackMessages.map(msg => JSON.parse(msg));

      try {
        // Bulk Insert (skips duplicates automatically)
        const result = await this.prisma.message.createMany({
          data: messagesToSync,
          skipDuplicates: true,
        });

        this.logger.log(`Bulk synced ${result.count} messages to DB.`);

        // Remove processed messages from Redis
        // Since we processed the first N messages, we can safely LTRIM them.
        // Wait! LTRIM keeps the range. LTRIM key 50 -1 keeps from index 50 to end.
        // So we remove 0 to length-1.
        await this.redis.ltrim('chat:fallback:messages', fallbackMessages.length, -1);

      } catch (error) {
        this.logger.error('Failed to bulk sync messages', error);
      }
    }

    // 3. Process Dead Letter Queue (DLQ)
    await this.rescueDLQMessages();
  }

  private async rescueDLQMessages() {
    // Determine connection URL from environment variables
    const user = process.env.RABBITMQ_USER || 'guest';
    const pass = process.env.RABBITMQ_PASS || 'guest';
    const host = process.env.RABBITMQ_HOST || 'localhost';
    const port = 5672;
    const url = `amqp://${user}:${pass}@${host}:${port}`;

    let connection;
    let channel;

    try {
      connection = await amqp.connect(url);
      channel = await connection.createChannel();

      // Ensure DLQ exists (it should, but safety first)
      await channel.checkQueue('chat_dlq');

      // Fetch a batch of messages (e.g., up to 10)
      for (let i = 0; i < 10; i++) {
        const msg = await channel.get('chat_dlq', { noAck: false }); // We will ack manually
        if (!msg) break; // No more messages

        const content = JSON.parse(msg.content.toString());
        const headers = msg.properties.headers || {};
        const retryCount = (headers['x-retry-count'] || 0) + 1;

        this.logger.log(`Rescuing DLQ message ${content.messageId || 'unknown'}. Retry attempt: ${retryCount}`);

        if (retryCount > 3) {
          this.logger.error(`Message ${content.messageId} exceeded max retries (3). Discarding.`);
          channel.ack(msg); // Ack to remove from DLQ
          continue;
        }

        // Re-publish to main queue with updated retry count
        channel.sendToQueue('chat_queue', msg.content, {
          headers: { ...headers, 'x-retry-count': retryCount },
          persistent: true,
        });

        channel.ack(msg); // Remove from DLQ
      }

    } catch (error) {
      this.logger.error('Error processing DLQ messages', error);
    } finally {
      if (channel) await channel.close().catch(() => { });
      if (connection) await connection.close().catch(() => { });
    }
  }

  private async isDatabaseAvailable(): Promise<boolean> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return true;
    } catch (e) {
      this.logger.error('Database Health Check Failed', e);
      return false;
    }
  }
}
