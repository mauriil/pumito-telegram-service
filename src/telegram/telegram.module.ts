import { Module, forwardRef } from '@nestjs/common';
import { TelegrafModule } from 'nestjs-telegraf';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CommandsHandler } from './handlers/commands.handler';
import { PurchaseFlow } from './handlers/purchase.flow';
import { MessageHandler } from './handlers/message.handler';
import { TelegrafService } from './telegraf.service';
import { SharedModule } from '../shared/shared.module';
import { PaymentsModule } from '../payments/payments.module';
import { UsersService } from '../db/users.service';

@Module({
  imports: [
    TelegrafModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        token: configService.get<string>('TELEGRAM_BOT_TOKEN'),
      }),
      inject: [ConfigService],
    }),
    SharedModule,
    forwardRef(() => PaymentsModule),
  ],
  providers: [CommandsHandler, PurchaseFlow, MessageHandler, TelegrafService, UsersService],
  exports: [TelegrafService],
})
export class TelegramModule {}
