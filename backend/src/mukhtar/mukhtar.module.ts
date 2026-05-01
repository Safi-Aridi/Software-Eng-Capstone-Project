import { Module } from '@nestjs/common';
import { MukhtarController } from './mukhtar.controller';
import { ApplicationsModule } from '../applications/applications.module';

@Module({
  imports: [ApplicationsModule],
  controllers: [MukhtarController],
})
export class MukhtarModule {}