import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { RedisPubSub } from 'graphql-redis-subscriptions';

@Processor('message-queue')
@Injectable()
export class ChatConsumer extends WorkerHost {
    constructor(
        private prisma: PrismaService,
        @Inject('PUB_SUB') private pubSub: RedisPubSub,
    ) {
        super();
    }

    async process(job: Job<any, any, string>): Promise<any> {
        const { messageId, chatRoomId } = job.data;
        console.log(`Processing message ${messageId} for room ${chatRoomId}`);

        try {
            // Simulate processing (e.g. AI analysis, moderation, etc.)
            // For now, just update status to SENT
            const message = await this.prisma.message.update({
                where: { id: messageId },
                data: { status: 'SENT' },
            });

            console.log('ChatConsumer.process publishing:', JSON.stringify(message, null, 2));

            // Publish to Subscription
            await this.pubSub.publish('messageReceived', { messageReceived: message as any });

            return message;
        } catch (error) {
            console.error(`Failed to process message ${messageId}`, error);
            // If processing fails, mark as FAILED
            await this.prisma.message.update({
                where: { id: messageId },
                data: { status: 'FAILED' },
            });
            throw error;
        }
    }

    @OnWorkerEvent('failed')
    async onFailed(job: Job<any, any, string>, error: Error) {
        const { messageId } = job.data;
        console.error(`Job ${job.id} failed for message ${messageId}: ${error.message}`);
        try {
            await this.prisma.message.update({
                where: { id: messageId },
                data: { status: 'FAILED' },
            });
        } catch (e) {
            console.error('Failed to update message status to FAILED', e);
        }
    }
}
