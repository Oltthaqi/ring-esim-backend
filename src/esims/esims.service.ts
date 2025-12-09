import { Injectable } from '@nestjs/common';
import { CreateEsimDto } from './dto/create-esim.dto';
// import { UpdateEsimDto } from './dto/update-esim.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Esim } from './entities/esim.entity';
import { OcsService } from '../ocs/ocs.service';

@Injectable()
export class EsimsService {
  constructor(
    @InjectRepository(Esim) private esimRepo: Repository<Esim>,
    private OcsService: OcsService,
  ) {}
  async syncFreeEsims(accountId: number) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const list: OcsSubscriber[] =
      await this.OcsService.listSubscribers(accountId);
    const freeEsims = list.filter((e) => e.sim?.status === 'FREE');

    const entities = freeEsims.map(
      (e): CreateEsimDto => ({
        subscriberId: e.subscriberId,
        imsi: e.imsiList?.[0]?.imsi ?? undefined,
        iccid: e.sim?.iccid ?? undefined,
        phoneNumber: e.phoneNumberList?.[0]?.phoneNumber ?? undefined,
        smdpServer: e.sim?.smdpServer ?? undefined,
        activationCode: e.sim?.activationCode ?? undefined,
        batchId: e.batchId,
        accountId: e.accountId,
        resellerId: e.resellerId,
        prepaid: e.prepaid,
        balance: e.balance,
        simStatus: e.sim?.status ?? undefined,
        status: e.status?.[0]?.status ?? undefined,
        activationDate: e.activationDate
          ? new Date(e.activationDate)
          : undefined,
      }),
    );

    await this.esimRepo.save(this.esimRepo.create(entities));
  }
}
