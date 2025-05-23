import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type MessageType = 'user' | 'bot';

export interface Message {
  type: MessageType;
  content: string;
  timestamp: Date;
}

@Schema({ timestamps: true })
export class Conversation {
  @Prop({ index: true })
  chatId: number;

  @Prop({ index: true })
  userId: string;

  @Prop({ type: [{ type: Object }] })
  messages: Message[];

  @Prop({ default: true })
  isActive: boolean;
}

export type ConversationDocument = HydratedDocument<Conversation>;
export const ConversationSchema = SchemaFactory.createForClass(Conversation);
