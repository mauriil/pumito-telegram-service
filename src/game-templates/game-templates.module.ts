import { Module } from '@nestjs/common';
import { DbModule } from '../db/db.module';
import { GameTemplatesController } from './game-templates.controller';

@Module({
  imports: [DbModule],
  controllers: [GameTemplatesController],
})
export class GameTemplatesModule {}
