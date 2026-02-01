import { Resolver, Mutation, Query, Args } from '@nestjs/graphql';
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
