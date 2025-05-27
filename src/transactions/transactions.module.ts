import { Module } from '@nestjs/common';
import { TransactionsController } from './transactions.controller';
import { DbModule } from '../db/db.module';

@Module({
  imports: [DbModule],
  controllers: [TransactionsController],
})
export class TransactionsModule {} 