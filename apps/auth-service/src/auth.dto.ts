import { ObjectType, Field, ID, registerEnumType } from '@nestjs/graphql';
import { IsEmail, IsNotEmpty, MinLength, IsEnum } from 'class-validator';

export enum UserRole {
    CUSTOMER = 'CUSTOMER',
    AGENT = 'AGENT',
}

registerEnumType(UserRole, {
    name: 'UserRole',
});

@ObjectType()
export class User {
    @Field(() => ID)
    id: string;

    @Field()
    email: string;

    @Field(() => UserRole)
    role: UserRole;

    @Field()
    createdAt: Date;

    @Field()
    updatedAt: Date;
}

@ObjectType()
export class AuthResponse {
    @Field()
    accessToken: string;

    @Field()
    refreshToken: string;

    @Field(() => User)
    user: User;
}

// Inputs are typically defined in a inputs.ts file but for simplicity here:
import { InputType } from '@nestjs/graphql';

@InputType()
export class RegisterInput {
    @Field()
    @IsEmail()
    email: string;

    @Field()
    @IsNotEmpty()
    @MinLength(6)
    password: string;

    @Field(() => UserRole, { defaultValue: UserRole.CUSTOMER })
    @IsEnum(UserRole)
    role: UserRole;
}

@InputType()
export class LoginInput {
    @Field()
    @IsEmail()
    email: string;

    @Field()
    @IsNotEmpty()
    password: string;
}
