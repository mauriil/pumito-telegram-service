import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { User, UserSchema } from '../db/schemas/user.schema';
import { Conversation, ConversationSchema } from '../db/schemas/conversation.schema';
import { Game, GameSchema } from '../db/schemas/game.schema';
import { GameTemplate, GameTemplateSchema } from '../db/schemas/game-template.schema';
import { CreditPack, CreditPackSchema } from '../db/schemas/credit-pack.schema';
import { Transaction, TransactionSchema } from '../db/schemas/transaction.schema';
import { UsersService } from '../db/users.service';
import { ConversationsService } from '../db/conversations.service';
import { GamesService } from '../db/games.service';
import { GameTemplatesService } from '../db/game-templates.service';
import { CreditPacksService } from '../db/credit-packs.service';
import { TransactionsService } from '../db/transactions.service';

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
      { name: Game.name, schema: GameSchema },
      { name: GameTemplate.name, schema: GameTemplateSchema },
      { name: CreditPack.name, schema: CreditPackSchema },
      { name: Transaction.name, schema: TransactionSchema },
    ]),
  ],
  providers: [
    UsersService,
    ConversationsService,
    GamesService,
    GameTemplatesService,
    CreditPacksService,
    TransactionsService,
  ],
  exports: [
    UsersService,
    ConversationsService,
    GamesService,
    GameTemplatesService,
    CreditPacksService,
    TransactionsService,
    MongooseModule,
  ],
})
export class SharedModule {}
