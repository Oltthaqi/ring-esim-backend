import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PackageVisibility } from './entities/package-visibility.entity';

@Injectable()
export class PackageVisibilityService {
  constructor(
    @InjectRepository(PackageVisibility)
    private readonly repo: Repository<PackageVisibility>,
  ) {}

  async isHidden(templateId: number): Promise<boolean> {
    const row = await this.repo.findOne({
      where: { upstreamTemplateId: templateId },
    });
    return row?.hidden ?? false;
  }

  async getHiddenTemplateIds(): Promise<Set<number>> {
    const rows = await this.repo.find({ where: { hidden: true } });
    return new Set(rows.map((r) => r.upstreamTemplateId));
  }

  async setVisibility(
    templateId: number,
    hidden: boolean,
    userId: string,
  ): Promise<PackageVisibility> {
    let row = await this.repo.findOne({
      where: { upstreamTemplateId: templateId },
    });
    if (row) {
      row.hidden = hidden;
      row.updatedBy = userId;
    } else {
      row = this.repo.create({
        upstreamTemplateId: templateId,
        hidden,
        updatedBy: userId,
      });
    }
    return this.repo.save(row);
  }
}
