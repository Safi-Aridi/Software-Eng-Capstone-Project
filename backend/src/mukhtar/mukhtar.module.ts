import { Module } from '@nestjs/common';
import { MukhtarController } from './mukhtar.controller';
import { ApplicationsModule } from '../applications/applications.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [ApplicationsModule, AuthModule],
  controllers: [MukhtarController],
})
export class MukhtarModule {}