import { Controller, Inject } from '@nestjs/common';
import { Ctx, EventPattern, Payload, RmqContext } from '@nestjs/microservices';
import { PrismaService } from './prisma.service';
import { RedisPubSub } from 'graphql-redis-subscriptions';

@Controller()
export class ChatController {
    constructor(
        private prisma: PrismaService,
        @Inject('PUB_SUB') private pubSub: RedisPubSub,
    ) { }

    @EventPattern('new-message')
    async handleNewMessage(@Payload() data: any, @Ctx() context: RmqContext) {
        const channel = context.getChannelRef();
        const originalMsg = context.getMessage();

        const { messageId, chatRoomId } = data;
        console.log(`Processing message ${messageId} for room ${chatRoomId}`);

        try {
            const message = await this.prisma.message.update({
                where: { id: messageId },
                data: { status: 'SENT' },
            });

            console.log('ChatController publishing:', JSON.stringify(message, null, 2));

            await this.pubSub.publish('messageReceived', { messageReceived: message });

            channel.ack(originalMsg);
        } catch (error) {
            console.error(`Failed to process message ${messageId}`, error);

            // Update to FAILED in DB? 
            // Or just let it go to DLQ. 
            // Existing logic updated status to FAILED.
            try {
                await this.prisma.message.update({
                    where: { id: messageId },
                    data: { status: 'FAILED' },
                });
            } catch (e) {
                console.error('Failed to update message status to FAILED', e);
            }

            // Nack with requeue=false to send to DLQ (if configured)
            channel.nack(originalMsg, false, false);
        }
    }
}
