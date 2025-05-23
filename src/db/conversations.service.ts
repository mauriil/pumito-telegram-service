import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Conversation, ConversationDocument, Message, MessageType } from './schemas/conversation.schema';

@Injectable()
export class ConversationsService {
  private readonly logger = new Logger(ConversationsService.name);

  constructor(
    @InjectModel(Conversation.name)
    private readonly conversationModel: Model<ConversationDocument>,
  ) {}

  async addMessage(chatId: number, userId: string, content: string, type: MessageType): Promise<ConversationDocument> {
    const message: Message = {
      type,
      content,
      timestamp: new Date(),
    };

    return this.conversationModel.findOneAndUpdate(
      { chatId, userId, isActive: true },
      { $push: { messages: message } },
      { upsert: true, new: true },
    );
  }

  async getConversationHistory(chatId: number, userId: string): Promise<ConversationDocument | null> {
    return this.conversationModel.findOne({ chatId, userId, isActive: true });
  }

  async getUserConversations(userId: string): Promise<ConversationDocument[]> {
    return this.conversationModel.find({ userId, isActive: true }).sort({ updatedAt: -1 });
  }

  async deactivateConversation(chatId: number, userId: string): Promise<void> {
    await this.conversationModel.updateOne(
      { chatId, userId, isActive: true },
      { isActive: false },
    );
  }
} 