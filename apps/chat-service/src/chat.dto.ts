import { ObjectType, Field, ID, registerEnumType } from '@nestjs/graphql';

@ObjectType()
export class Message {
    @Field(() => ID)
    id: string;

    @Field()
    chatRoomId: string;

    @Field()
    senderId: string;

    @Field()
    content: string;

    @Field(() => String, { nullable: true })
    attachmentUrl?: string | null;

    @Field(() => MessageStatus)
    status: MessageStatus;

    @Field()
    createdAt: Date;
}

export enum MessageStatus {
    PENDING = 'PENDING',
    SENT = 'SENT',
    DELIVERED = 'DELIVERED',
    READ = 'READ',
    FAILED = 'FAILED',
}

registerEnumType(MessageStatus, {
    name: 'MessageStatus',
});

@ObjectType()
export class ChatRoom {
    @Field(() => ID)
    id: string;

    @Field()
    customerEmail: string;

    @Field()
    status: string;

    @Field(() => [Message], { nullable: true })
    messages?: Message[];

    @Field()
    createdAt: Date;

    @Field()
    updatedAt: Date;
}

@ObjectType()
export class SendMessageResponse {
    @Field()
    success: boolean;
}

// Inputs
import { InputType } from '@nestjs/graphql';

@InputType()
export class SendMessageInput {
    @Field()
    chatRoomId: string;

    @Field()
    content: string;

    @Field(() => String, { nullable: true })
    attachmentUrl?: string | null;

    // senderId typically comes from Context (JWT), but for simplicity or arguments:
    @Field({ nullable: true })
    senderId?: string;

    @Field({ nullable: true })
    deduplicationId?: string;
}
