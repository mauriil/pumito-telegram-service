import { Module } from '@nestjs/common';
import { DbModule } from '../db/db.module';
import { UsersController } from './users.controller';


@Module({
  imports: [DbModule],
  controllers: [UsersController],
})
export class UsersModule {} 