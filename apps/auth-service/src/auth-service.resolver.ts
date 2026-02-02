import { Resolver, Mutation, Query, Args, ID } from '@nestjs/graphql';
import { AuthService } from './auth-service.service';
import { AuthResponse, RegisterInput, LoginInput, User } from './auth.dto';

@Resolver(() => User)
export class AuthServiceResolver {
    constructor(private readonly authService: AuthService) { }

    @Mutation(() => AuthResponse)
    async register(@Args('input') input: RegisterInput): Promise<AuthResponse> {
        return this.authService.register(input);
    }

    @Mutation(() => AuthResponse)
    async login(@Args('input') input: LoginInput): Promise<AuthResponse> {
        return this.authService.login(input);
    }

    @Mutation(() => AuthResponse)
    async refreshToken(@Args('token') token: string): Promise<AuthResponse> {
        return this.authService.refreshToken(token);
    }

    @Mutation(() => Boolean)
    async logout(@Args('userId', { type: () => ID }) userId: string): Promise<boolean> {
        return this.authService.logout(userId);
    }

    @Query(() => User)
    async validateToken(@Args('token') token: string): Promise<User> {
        return this.authService.validateToken(token);
    }

    // A dummy query to ensure the Query type is generated if validateToken is the only one (GraphQL requires at least one Query)
    @Query(() => String)
    hello(): string {
        return 'Hello from Auth Service';
    }
}
