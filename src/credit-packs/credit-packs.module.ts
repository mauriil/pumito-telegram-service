import { Module } from '@nestjs/common';
import { DbModule } from '../db/db.module';
import { CreditPacksController } from './credit-packs.controller';

@Module({
  imports: [DbModule],
  controllers: [CreditPacksController],
})
export class CreditPacksModule {} 