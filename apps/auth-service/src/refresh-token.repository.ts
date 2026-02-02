import { Injectable, Inject } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RefreshTokenRepository {
    private readonly TTL = 60 * 60 * 24 * 7; // 7 days

    constructor(@Inject('REDIS_CLIENT') private readonly redis: Redis) { }

    async save(userId: string, token: string): Promise<void> {
        await this.redis.set(`auth:refresh_token:${userId}`, token, 'EX', this.TTL);
    }

    async find(userId: string): Promise<string | null> {
        return this.redis.get(`auth:refresh_token:${userId}`);
    }

    async delete(userId: string): Promise<void> {
        await this.redis.del(`auth:refresh_token:${userId}`);
    }
}
