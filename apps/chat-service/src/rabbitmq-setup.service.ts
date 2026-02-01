import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import * as amqp from 'amqplib';

@Injectable()
export class RabbitMQSetupService implements OnModuleInit {
    private readonly logger = new Logger(RabbitMQSetupService.name);

    async onModuleInit() {
        await this.setupTopology();
    }

    private async setupTopology() {
        const user = process.env.RABBITMQ_USER || 'guest';
        const pass = process.env.RABBITMQ_PASS || 'guest';
        const host = process.env.RABBITMQ_HOST || 'localhost';
        const port = 5672;
        const url = `amqp://${user}:${pass}@${host}:${port}`;

        try {
            this.logger.log('Connecting to RabbitMQ to assert topology...');
            const connection = await amqp.connect(url);
            const channel = await connection.createChannel();

            const dlx = 'chat_dlx';
            const dlq = 'chat_dlq';
            const routingKey = 'chat_dlq';

            // 1. Assert Dead Letter Exchange
            await channel.assertExchange(dlx, 'direct', { durable: true });
            this.logger.log(`Exchange '${dlx}' asserted.`);

            // 2. Assert Dead Letter Queue
            await channel.assertQueue(dlq, { durable: true });
            this.logger.log(`Queue '${dlq}' asserted.`);

            // 3. Bind Queue to Exchange
            await channel.bindQueue(dlq, dlx, routingKey);
            this.logger.log(`Queue '${dlq}' bound to exchange '${dlx}' with key '${routingKey}'.`);

            await channel.close();
            await connection.close();
            this.logger.log('RabbitMQ topology setup complete.');
        } catch (error) {
            this.logger.error('Failed to setup RabbitMQ topology', error);
            // Don't throw error to avoid crashing app on transient connection issues, 
            // but in production you might want to retry or fail hard.
        }
    }
}
