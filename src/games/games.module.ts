import { Module } from '@nestjs/common';
import { DbModule } from '../db/db.module';
import { GamesController } from './games.controller';

@Module({
  imports: [DbModule],
  controllers: [GamesController],
})
export class GamesModule {}
