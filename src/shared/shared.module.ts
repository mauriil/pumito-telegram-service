import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { User, UserSchema } from '../db/schemas/user.schema';
import { Conversation, ConversationSchema } from '../db/schemas/conversation.schema';
import { UsersService } from '../db/users.service';
import { ConversationsService } from '../db/conversations.service';

@Module({
  imports: [
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        uri: cfg.get<string>('MONGODB_URI'),
        autoIndex: false,
      }),
    }),
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Conversation.name, schema: ConversationSchema },
    ]),
  ],
  providers: [UsersService, ConversationsService],
  exports: [UsersService, ConversationsService, MongooseModule],
})
export class SharedModule {} 