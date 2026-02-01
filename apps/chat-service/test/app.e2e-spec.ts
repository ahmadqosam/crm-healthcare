import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ExecutionContext } from '@nestjs/common';
import request from 'supertest';
import { ChatService } from './../src/chat-service.service';
import { ChatServiceResolver } from './../src/chat-service.resolver';
// import { ChatConsumer } from './../src/chat.consumer'; // Removed
import { ChatController } from './../src/chat.controller';

import { PrismaService } from './../src/prisma.service';
import { JwtAuthGuard } from './../src/jwt-auth.guard';
import { GqlExecutionContext } from '@nestjs/graphql';
import { RmqContext } from '@nestjs/microservices';

// --- Mocks ---
const mockClient = {
  emit: jest.fn(),
};

const mockPrisma = {
  message: {
    create: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    deleteMany: jest.fn(),
  },
  chatRoom: {
    findMany: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(), // Return the deleted room
  },
};

const mockPubSub = {
  publish: jest.fn(),
  asyncIterator: jest.fn(),
};

// Dynamic Mock User for switching contexts between tests
let mockUserContext = { userId: 'default', email: 'default@test.com', role: 'CUSTOMER' };

const MockAuthGuard = {
  canActivate: (context: ExecutionContext) => {
    const ctx = GqlExecutionContext.create(context);
    const req = ctx.getContext().req;
    if (req) {
      req.user = mockUserContext;
    }
    return true;
  },
};

import { GraphQLModule } from '@nestjs/graphql';
import { ApolloFederationDriver, ApolloFederationDriverConfig } from '@nestjs/apollo';
import { join } from 'path';

describe('ChatService Flow (Integration)', () => {
  let app: INestApplication;
  let chatController: ChatController;

  beforeEach(async () => {
    jest.clearAllMocks();

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
        ChatController, // Now provided here for access
        {
          provide: 'CHAT_SERVICE', // ClientProxy token
          useValue: mockClient,
        },
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
        {
          provide: 'PUB_SUB',
          useValue: mockPubSub,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(MockAuthGuard)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    chatController = moduleFixture.get<ChatController>(ChatController);
  });

  afterAll(async () => {
    await app.close();
  });

  // --- Scenario 1: Agent sends message ---
  it('Scenario 1: Agent sends message', async () => {
    mockUserContext = { userId: 'agent-123', email: 'agent@test.com', role: 'AGENT' };

    const sendMessageMutation = `
      mutation {
        sendMessage(input: { chatRoomId: "room-1", content: "Hello Customer" }) {
          id
          content
          senderId
          status
        }
      }
    `;

    // Mock Prisma Response
    mockPrisma.message.create.mockResolvedValue({
      id: 'msg-1',
      chatRoomId: 'room-1',
      content: 'Hello Customer',
      senderId: 'agent@test.com',
      status: 'PENDING',
      createdAt: new Date(),
    });

    const res = await request(app.getHttpServer())
      .post('/graphql')
      .send({ query: sendMessageMutation })
      .expect(200);

    const data = res.body.data.sendMessage;
    expect(data.content).toEqual('Hello Customer');
    expect(data.senderId).toEqual('agent@test.com');
    expect(data.status).toEqual('PENDING');

    // Verify DB Call
    expect(mockPrisma.message.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        content: 'Hello Customer',
        senderId: 'agent@test.com',
        status: 'PENDING'
      })
    }));

    // Verify Queue Call (ClientProxy.emit)
    expect(mockClient.emit).toHaveBeenCalledWith('new-message', expect.objectContaining({
      content: 'Hello Customer',
      senderId: 'agent@test.com'
    }));
  });


  // --- Scenario 2: Customer sends message ---
  it('Scenario 2: Customer sends message', async () => {
    mockUserContext = { userId: 'cust-456', email: 'customer@test.com', role: 'CUSTOMER' };

    const sendMessageMutation = `
      mutation {
        sendMessage(input: { chatRoomId: "room-1", content: "Help me" }) {
          id
          senderId
        }
      }
    `;

    mockPrisma.message.create.mockResolvedValue({
      id: 'msg-2',
      chatRoomId: 'room-1',
      content: 'Help me',
      senderId: 'customer@test.com',
      status: 'PENDING',
      createdAt: new Date(),
    });

    const res = await request(app.getHttpServer())
      .post('/graphql')
      .send({ query: sendMessageMutation })
      .expect(200);

    const data = res.body.data.sendMessage;
    expect(data.senderId).toEqual('customer@test.com');
  });

  // --- Scenario 3: Message with Attachment ---
  it('Scenario 3: Message with Attachment', async () => {
    mockUserContext = { userId: 'agent-123', email: 'agent@test.com', role: 'AGENT' };

    const sendMessageMutation = `
      mutation {
        sendMessage(input: { chatRoomId: "room-1", content: "File", attachmentUrl: "http://test.com/file.pdf" }) {
          id
          attachmentUrl
        }
      }
    `;

    mockPrisma.message.create.mockResolvedValue({
      id: 'msg-3',
      chatRoomId: 'room-1',
      content: 'File',
      attachmentUrl: 'http://test.com/file.pdf',
      senderId: 'agent@test.com',
      status: 'PENDING',
      createdAt: new Date(),
    });

    await request(app.getHttpServer())
      .post('/graphql')
      .send({ query: sendMessageMutation })
      .expect(200);

    // Verify Queue Payload contains attachment
    expect(mockClient.emit).toHaveBeenCalledWith('new-message', expect.objectContaining({
      attachmentUrl: 'http://test.com/file.pdf',
    }));
  });

  // --- Scenario 4: Agent retrieves chats ---
  it('Scenario 4: Agent retrieves chats (All)', async () => {
    mockUserContext = { userId: 'agent-123', email: 'agent@test.com', role: 'AGENT' };

    const getChatsQuery = `
      query {
        getChats {
          id
          customerEmail
        }
      }
    `;

    mockPrisma.chatRoom.findMany.mockResolvedValue([
      { id: 'room-1', customerEmail: 'cust1@test.com' },
      { id: 'room-2', customerEmail: 'cust2@test.com' },
    ]);

    const res = await request(app.getHttpServer())
      .post('/graphql')
      .send({ query: getChatsQuery })
      .expect(200);

    expect(res.body.data.getChats).toHaveLength(2);
  });

  // --- Scenario 5: Customer retrieves chats ---
  it('Scenario 5: Customer retrieves chats (Own)', async () => {
    mockUserContext = { userId: 'cust-456', email: 'customer@test.com', role: 'CUSTOMER' };

    const getChatsQuery = `
      query {
        getChats {
          id
          customerEmail
        }
      }
    `;

    mockPrisma.chatRoom.findMany.mockResolvedValue([
      { id: 'room-1', customerEmail: 'customer@test.com' },
    ]);

    await request(app.getHttpServer())
      .post('/graphql')
      .send({ query: getChatsQuery })
      .expect(200);

    // Verify findMany WAS called with correct where clause
    expect(mockPrisma.chatRoom.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { customerEmail: 'customer@test.com' }
    }));
  });

  // --- Scenario 6: Agent deletes chat ---
  it('Scenario 6: Agent deletes chat', async () => {
    mockUserContext = { userId: 'agent-123', email: 'agent@test.com', role: 'AGENT' };

    const deleteMutation = `
      mutation {
        deleteChatRoom(id: "room-1")
      }
    `;

    mockPrisma.message.deleteMany.mockResolvedValue({ count: 5 });
    mockPrisma.chatRoom.delete.mockResolvedValue({ id: 'room-1' });

    const res = await request(app.getHttpServer())
      .post('/graphql')
      .send({ query: deleteMutation })
      .expect(200);

    expect(res.body.data.deleteChatRoom).toBe(true);
    expect(mockPrisma.message.deleteMany).toHaveBeenCalledWith({ where: { chatRoomId: 'room-1' } });
    expect(mockPrisma.chatRoom.delete).toHaveBeenCalledWith({ where: { id: 'room-1' } });
  });

  // --- Scenario 7: Customer deletes chat (Forbidden) ---
  it('Scenario 7: Customer deletes chat (Forbidden)', async () => {
    mockUserContext = { userId: 'cust-456', email: 'customer@test.com', role: 'CUSTOMER' };

    const deleteMutation = `
      mutation {
        deleteChatRoom(id: "room-1")
      }
    `;

    const res = await request(app.getHttpServer())
      .post('/graphql')
      .send({ query: deleteMutation })
      .expect(200);

    expect(res.body.errors).toBeDefined();
    expect(res.body.data).toBeNull();
  });

  // --- Scenario 8: Message Reception (Subscription Simulation) ---
  it('Scenario 8: Message Reception (Subscription Publish)', async () => {

    // Mock RmqContext
    const mockChannel = {
      ack: jest.fn(),
      nack: jest.fn(),
    };

    // Note: getMessage() returns the original raw message
    const mockRmqContext = {
      getChannelRef: () => mockChannel,
      getMessage: () => ({}), // dummy original msg
    } as unknown as RmqContext;

    // Simulate Data Payload
    const data = {
      messageId: 'msg-100',
      chatRoomId: 'room-100',
      senderId: 'agent@test.com',
      content: 'Test Msg',
      createdAt: new Date().toISOString()
    };

    mockPrisma.message.update.mockResolvedValue({
      id: 'msg-100',
      chatRoomId: 'room-100',
      content: 'Test Msg',
      senderId: 'agent@test.com',
      status: 'SENT', // Consumer updates to SENT
      createdAt: new Date(),
    });

    // Run Controller Handler directly
    await chatController.handleNewMessage(data, mockRmqContext);

    // Verify PubSub Publish
    expect(mockPubSub.publish).toHaveBeenCalledWith(
      'messageReceived',
      expect.objectContaining({
        messageReceived: expect.objectContaining({
          id: 'msg-100',
          status: 'SENT' // Verify status assertion
        })
      })
    );

    // Verify Ack
    expect(mockChannel.ack).toHaveBeenCalled();
  });

});
