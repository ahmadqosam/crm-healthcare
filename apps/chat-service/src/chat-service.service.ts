import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from './prisma.service';

@Injectable()
export class ChatService {
  constructor(
    private prisma: PrismaService,
    @InjectQueue('message-queue') private messageQueue: Queue,
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

    // 2. Add to Redis Queue (Producer)
    const payload = {
      messageId: message.id,
      senderId,
      chatRoomId,
      content,
      attachmentUrl,
      createdAt: message.createdAt
    };

    await this.messageQueue.add('new-message', payload, {
      removeOnComplete: true,
      removeOnFail: false, // Keep failed jobs in the "failed" set (DLQ)
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
    });

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

  async getMessages(chatRoomId: string) {
    const messages = await this.prisma.message.findMany({
      where: { chatRoomId },
      orderBy: { createdAt: 'asc' },
    });
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
