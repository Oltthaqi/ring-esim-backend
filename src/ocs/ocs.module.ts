// ocs.module.ts
import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { OcsService } from './ocs.service';
import { OcsController } from './ocs.controller';

@Module({
  imports: [
    HttpModule.register({
      timeout: 15000,
      maxRedirects: 0,
      // If their TLS cert is non-public and you must ignore it (only if they ask you to):
      // httpsAgent: new (require('https').Agent)({ rejectUnauthorized: false }),
    }),
  ],
  controllers: [OcsController],
  providers: [OcsService],
  exports: [OcsService],
})
export class OcsModule {}
