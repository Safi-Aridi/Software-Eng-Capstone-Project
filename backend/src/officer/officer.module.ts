import { Module } from '@nestjs/common';
import { OfficerController } from './officer.controller';
import { ApplicationsModule } from '../applications/applications.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [ApplicationsModule, AuthModule],
  controllers: [OfficerController],
})
export class OfficerModule {}