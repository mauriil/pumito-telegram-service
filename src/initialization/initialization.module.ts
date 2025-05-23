import { Module } from '@nestjs/common';
import { DbModule } from '../db/db.module';
import { InitializationService } from './initialization.service';

@Module({
  imports: [DbModule],
  providers: [InitializationService],
})
export class InitializationModule {} 