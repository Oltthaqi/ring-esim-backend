import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { Esim } from './entities/esim.entity';
import { PackageTemplate } from '../package-template/entities/package-template.entity';

@Injectable()
export class EsimAllocationService {
  constructor(
    @InjectRepository(Esim)
    private readonly esimRepository: Repository<Esim>,
    @InjectRepository(PackageTemplate)
    private readonly packageTemplateRepository: Repository<PackageTemplate>,
  ) {}

  /**
   * Allocate an available eSIM for a package template
   * This finds an unused eSIM that can be used for the specified package
   */
  async allocateEsimForPackage(packageTemplateId: string): Promise<Esim> {
    // First, get the package template to understand what zones/countries it covers
    const packageTemplate = await this.packageTemplateRepository.findOne({
      where: { packageTemplateId },
      relations: ['zone'],
    });

    if (!packageTemplate) {
      throw new NotFoundException(
        `Package template ${packageTemplateId} not found`,
      );
    }

    // Find an available eSIM
    // For now, we'll find any eSIM with status 'Inactive' or null
    // In a more sophisticated system, you might want to filter by country/zone compatibility
    const availableEsim = await this.esimRepository.findOne({
      where: [
        { status: 'Inactive' },
        { status: IsNull() },
        { simStatus: 'Inactive' },
        { simStatus: IsNull() },
      ],
      order: { createdAt: 'ASC' }, // Use oldest eSIMs first (FIFO)
    });

    if (!availableEsim) {
      throw new BadRequestException(
        `No available eSIMs found for package ${packageTemplate.packageTemplateName}. Please contact support.`,
      );
    }

    // Mark eSIM as allocated/in-use
    await this.esimRepository.update(availableEsim.id, {
      status: 'Allocated',
      simStatus: 'Allocated',
    });

    // Reload the eSIM with updated status
    const allocatedEsim = await this.esimRepository.findOneOrFail({
      where: { id: availableEsim.id },
    });

    return allocatedEsim;
  }

  /**
   * Mark an eSIM as active after successful OCS activation
   */
  async markEsimAsActive(esimId: string, activationData?: any): Promise<void> {
    const updateData: any = {
      status: 'Active',
      simStatus: 'Active',
      activationDate: new Date(),
    };

    // If OCS returns updated activation details, use them
    if (activationData) {
      if (activationData.activationCode) {
        updateData.activationCode = activationData.activationCode;
      }
      if (activationData.iccid) {
        updateData.iccid = activationData.iccid;
      }
      if (activationData.smdpServer) {
        updateData.smdpServer = activationData.smdpServer;
      }
    }

    await this.esimRepository.update(esimId, updateData);
  }

  /**
   * Release an eSIM if order fails or is cancelled
   */
  async releaseEsim(esimId: string): Promise<void> {
    await this.esimRepository.update(esimId, {
      status: 'Inactive',
      simStatus: 'Inactive',
      activationDate: undefined,
    });
  }

  /**
   * Find eSIM by subscriber ID (for top-ups)
   */
  async findEsimBySubscriberId(subscriberId: number): Promise<Esim | null> {
    return this.esimRepository.findOne({
      where: { subscriberId },
    });
  }

  /**
   * Check eSIM availability for a specific package template
   */
  async checkAvailability(packageTemplateId: string): Promise<{
    available: boolean;
    count: number;
    packageTemplate: PackageTemplate;
  }> {
    const packageTemplate = await this.packageTemplateRepository.findOne({
      where: { packageTemplateId },
    });

    if (!packageTemplate) {
      throw new NotFoundException(
        `Package template ${packageTemplateId} not found`,
      );
    }

    const availableCount = await this.esimRepository.count({
      where: [
        { status: 'Inactive' },
        { status: IsNull() },
        { simStatus: 'Inactive' },
        { simStatus: IsNull() },
      ],
    });

    return {
      available: availableCount > 0,
      count: availableCount,
      packageTemplate,
    };
  }
}
