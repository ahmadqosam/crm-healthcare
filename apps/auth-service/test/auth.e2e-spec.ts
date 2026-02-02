import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AuthServiceModule } from '../src/auth-service.module';

describe('AuthService (e2e)', () => {
    let app: INestApplication;
    const mockRedis = {
        set: jest.fn(),
        get: jest.fn(),
        del: jest.fn(),
    };

    beforeAll(async () => {
        const moduleFixture: TestingModule = await Test.createTestingModule({
            imports: [AuthServiceModule],
        })
            .overrideProvider('REDIS_CLIENT')
            .useValue(mockRedis)
            .compile();

        app = moduleFixture.createNestApplication();
        await app.init();
    });

    afterAll(async () => {
        await app.close();
    });

    const email = `test-${Date.now()}@example.com`;
    const password = 'password123';
    let accessToken: string;
    let refreshToken: string;
    let userId: string;

    it('should register a new user', () => {
        const query = `
      mutation Register($input: RegisterInput!) {
        register(input: $input) {
          accessToken
          refreshToken
          user {
            id
            email
            role
          }
        }
      }
    `;

        return request(app.getHttpServer())
            .post('/graphql')
            .send({
                query,
                variables: {
                    input: {
                        email,
                        password,
                        role: 'CUSTOMER',
                    },
                },
            })
            .expect(200)
            .expect((res) => {
                const data = res.body.data.register;
                expect(data.accessToken).toBeDefined();
                expect(data.refreshToken).toBeDefined();
                expect(data.user.email).toBe(email);
                expect(mockRedis.set).toHaveBeenCalled(); // Should save refresh token

                userId = data.user.id;
                refreshToken = data.refreshToken;
            });
    });

    it('should login', () => {
        const query = `
      mutation Login($input: LoginInput!) {
        login(input: $input) {
          accessToken
          refreshToken
          user {
            id
            email
          }
        }
      }
    `;

        return request(app.getHttpServer())
            .post('/graphql')
            .send({
                query,
                variables: {
                    input: {
                        email,
                        password,
                    },
                },
            })
            .expect(200)
            .expect((res) => {
                const data = res.body.data.login;
                expect(data.accessToken).toBeDefined();
                expect(data.refreshToken).toBeDefined();
                expect(data.user.email).toBe(email);

                // Update tokens for next tests
                refreshToken = data.refreshToken;
                accessToken = data.accessToken;
            });
    });

    it('should rotate tokens using refresh token', async () => {
        await new Promise(resolve => setTimeout(resolve, 1100)); // Ensure iat changes
        // Mock Redis to return the token we just got
        mockRedis.get.mockResolvedValue(refreshToken);

        const query = `
      mutation RefreshToken($token: String!) {
        refreshToken(token: $token) {
          accessToken
          refreshToken
          user {
            id
          }
        }
      }
    `;

        return request(app.getHttpServer())
            .post('/graphql')
            .send({
                query,
                variables: {
                    token: refreshToken, // Pass the token (simulating what client sends)
                },
            })
            .expect(200)
            .expect((res) => {
                const data = res.body.data.refreshToken;
                expect(data.accessToken).toBeDefined();
                expect(data.refreshToken).toBeDefined();
                expect(data.refreshToken).not.toBe(refreshToken); // Rotation check
                expect(mockRedis.get).toHaveBeenCalledWith(`auth:refresh_token:${userId}`);

                // Update for logout
                refreshToken = data.refreshToken;
            });
    });

    it('should logout', () => {
        const query = `
      mutation Logout($userId: ID!) {
        logout(userId: $userId)
      }
    `;

        return request(app.getHttpServer())
            .post('/graphql')
            .send({
                query,
                variables: {
                    userId,
                },
            })
            .expect(200)
            .expect((res) => {
                expect(res.body.data.logout).toBe(true);
                expect(mockRedis.del).toHaveBeenCalledWith(`auth:refresh_token:${userId}`);
            });
    });
});
