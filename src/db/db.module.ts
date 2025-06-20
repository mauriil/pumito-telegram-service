import { Module } from '@nestjs/common';
import { SharedModule } from '../shared/shared.module';

@Module({
  imports: [SharedModule],
  exports: [SharedModule],
})
export class DbModule {}
