import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ExecutionContext } from '@nestjs/common';
import request from 'supertest';
import { ChatService } from '../src/chat-service.service';
import { ChatServiceResolver } from '../src/chat-service.resolver';
import { PrismaService } from '../src/prisma.service';
import { JwtAuthGuard } from '../src/jwt-auth.guard';
import { GqlExecutionContext, GraphQLModule } from '@nestjs/graphql';
import { ApolloFederationDriver, ApolloFederationDriverConfig } from '@nestjs/apollo';

describe('ChatService Pagination (e2e)', () => {
    let app: INestApplication;
    let prisma: any;

    const mockPrisma = {
        message: {
            findMany: jest.fn(),
        },
    };

    const mockClient = {
        emit: jest.fn(),
    };

    const mockPubSub = {
        asyncIterator: jest.fn(),
    };

    const MockAuthGuard = {
        canActivate: (context: ExecutionContext) => {
            const ctx = GqlExecutionContext.create(context);
            const req = ctx.getContext().req;
            if (req) {
                req.user = { userId: 'tester', email: 'test@example.com' };
            }
            return true;
        },
    };

    beforeAll(async () => {
        const moduleFixture: TestingModule = await Test.createTestingModule({
            imports: [
                GraphQLModule.forRoot<ApolloFederationDriverConfig>({
                    driver: ApolloFederationDriver,
                    autoSchemaFile: {
                        federation: 2,
                    },
                    sortSchema: true,
                }),
            ],
            providers: [
                ChatService,
                ChatServiceResolver,
                {
                    provide: 'CHAT_SERVICE',
                    useValue: mockClient,
                },
                {
                    provide: PrismaService,
                    useValue: mockPrisma,
                },
                {
                    provide: 'PUB_SUB',
                    useValue: mockPubSub,
                }
            ],
        })
            .overrideGuard(JwtAuthGuard)
            .useValue(MockAuthGuard)
            .compile();

        app = moduleFixture.createNestApplication();
        await app.init();
        prisma = moduleFixture.get(PrismaService);
    });

    afterAll(async () => {
        await app.close();
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should fetch last 50 messages by default', async () => {
        const query = `
      query {
        getMessages(chatRoomId: "room-1") {
          id
          content
        }
      }
    `;

        // Mock return value
        const mockMessages = Array.from({ length: 50 }, (_, i) => ({
            id: `msg-${i}`,
            content: `Message ${i}`,
            createdAt: new Date(),
            senderId: 'tester',
            status: 'SENT',
            chatRoomId: 'room-1'
        }));
        mockPrisma.message.findMany.mockResolvedValue(mockMessages);

        await request(app.getHttpServer())
            .post('/graphql')
            .send({ query })
            .expect(200)
            .expect((res) => {
                expect(res.body.data.getMessages).toHaveLength(50);
            });

        // ASSERTION: Verify findMany was called with correct default pagination
        expect(mockPrisma.message.findMany).toHaveBeenCalledWith(expect.objectContaining({
            where: { chatRoomId: 'room-1' },
            take: -50,
            orderBy: { createdAt: 'asc' }
        }));
    });

    it('should fetch previous 10 messages using cursor', async () => {
        const query = `
      query {
        getMessages(chatRoomId: "room-1", limit: 10, cursor: "msg-100") {
          id
        }
      }
    `;

        mockPrisma.message.findMany.mockResolvedValue([]);

        await request(app.getHttpServer())
            .post('/graphql')
            .send({ query })
            .expect(200);

        // ASSERTION: Verify findMany was called with limit and cursor
        expect(mockPrisma.message.findMany).toHaveBeenCalledWith(expect.objectContaining({
            where: { chatRoomId: 'room-1' },
            take: -10,
            orderBy: { createdAt: 'asc' },
            cursor: { id: 'msg-100' },
            skip: 1
        }));
    });
});
