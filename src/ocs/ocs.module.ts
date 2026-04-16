// ocs.module.ts
import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OcsService } from './ocs.service';
import { OcsController } from './ocs.controller';
import { UpstreamApiLog } from './entities/upstream-api-log.entity';

@Module({
  imports: [
    HttpModule.register({
      timeout: 30000,
      maxRedirects: 0,
    }),
    TypeOrmModule.forFeature([UpstreamApiLog]),
  ],
  controllers: [OcsController],
  providers: [OcsService],
  exports: [OcsService],
})
export class OcsModule {}
