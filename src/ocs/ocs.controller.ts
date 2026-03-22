// ocs.controller.ts
import { Controller, Get, Query } from '@nestjs/common';
import { OcsService } from './ocs.service';

@Controller('ocs')
export class OcsController {
  constructor(private readonly ocs: OcsService) {}

  @Get('list')
  async list(@Query('accountId') accountId?: string) {
    const id =
      accountId != null && String(accountId).trim() !== ''
        ? Number(accountId)
        : this.ocs.getDefaultAccountId();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return this.ocs.listSubscribers(id);
  }
}
