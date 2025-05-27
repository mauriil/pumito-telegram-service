import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validationSchema } from './config/validation';
import { DbModule } from './db/db.module';
import { TelegramModule } from './telegram/telegram.module';
import { PaymentsModule } from './payments/payments.module';
import { UsersModule } from './users/users.module';
import { GamesModule } from './games/games.module';
import { GameTemplatesModule } from './game-templates/game-templates.module';
import { CreditPacksModule } from './credit-packs/credit-packs.module';
import { TransactionsModule } from './transactions/transactions.module';
import { InitializationModule } from './initialization/initialization.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validationSchema }),
    DbModule,
    TelegramModule,
    PaymentsModule,
    UsersModule,
    GamesModule,
    GameTemplatesModule,
    CreditPacksModule,
    TransactionsModule,
    InitializationModule,
  ],
})
export class AppModule {}
