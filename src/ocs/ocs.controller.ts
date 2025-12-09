// ocs.controller.ts
import { Controller, Get, Query } from '@nestjs/common';
import { OcsService } from './ocs.service';

@Controller('ocs')
export class OcsController {
  constructor(private readonly ocs: OcsService) {}

  @Get('list')
  async list(@Query('accountId') accountId?: string) {
    const id = Number(accountId ?? process.env.OCS_ACCOUNT_ID);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return this.ocs.listSubscribers(id);
  }
}
