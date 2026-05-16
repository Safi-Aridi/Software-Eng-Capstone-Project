import { Module } from '@nestjs/common';
import { MukhtarController } from './mukhtar.controller';
import { MukhtarService } from './mukhtar.service';
import { ApplicationsModule } from '../applications/applications.module';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [ApplicationsModule, AuthModule, DatabaseModule],
  controllers: [MukhtarController],
  providers: [MukhtarService],
})
export class MukhtarModule {}