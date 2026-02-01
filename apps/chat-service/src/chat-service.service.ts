import { Injectable, Inject } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { PrismaService } from './prisma.service';

@Injectable()
export class ChatService {
  constructor(
    private prisma: PrismaService,
    @Inject('CHAT_SERVICE') private readonly client: ClientProxy,
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
