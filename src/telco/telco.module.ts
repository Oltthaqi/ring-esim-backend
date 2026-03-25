import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { TelcoService } from './telco.service';

@Module({
  imports: [
    HttpModule.register({
      timeout: 30000,
      maxRedirects: 0,
    }),
  ],
  providers: [TelcoService],
  exports: [TelcoService],
})
export class TelcoModule {}
