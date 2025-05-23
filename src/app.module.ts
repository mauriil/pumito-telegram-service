import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validationSchema } from './config/validation';
import { DbModule } from './db/db.module';
import { TelegramModule } from './telegram/telegram.module';
import { PaymentsModule } from './payments/payments.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validationSchema }),
    DbModule,
    TelegramModule,
    PaymentsModule,
  ],
})
export class AppModule {}
