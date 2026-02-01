import { Module } from '@nestjs/common';
import { AuthService } from './auth-service.service';
import { AuthServiceResolver } from './auth-service.resolver';
import { PrismaService } from './prisma.service';
import { JwtModule } from '@nestjs/jwt';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloFederationDriver, ApolloFederationDriverConfig } from '@nestjs/apollo';
import { join } from 'path';

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'supersecretkey',
      signOptions: { expiresIn: '1d' },
    }),
    GraphQLModule.forRoot<ApolloFederationDriverConfig>({
      driver: ApolloFederationDriver,
      autoSchemaFile: {
        path: join(process.cwd(), 'apps/auth-service/src/schema.gql'),
        federation: 2,
      },
      sortSchema: true,
      playground: true,
    }),
  ],
  controllers: [],
  providers: [AuthService, AuthServiceResolver, PrismaService],
})
export class AuthServiceModule { }
