import { Module } from '@nestjs/common';
import { OfficerController } from './officer.controller';
import { ApplicationsModule } from '../applications/applications.module';

@Module({
  imports: [ApplicationsModule],
  controllers: [OfficerController],
})
export class OfficerModule {}