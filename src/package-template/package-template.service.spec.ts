import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { PackageTemplatesService } from './package-template.service';
import { PackageTemplate } from './entities/package-template.entity';
import { LocationZone } from '../location-zone/entities/location-zone.entity';
import { OcsService } from 'src/ocs/ocs.service';
import { LocationZoneService } from '../location-zone/location-zone.service';

describe('PackageTemplatesService.updatePackage', () => {
  let service: PackageTemplatesService;
  const post = jest.fn();
  const save = jest.fn();
  const findOne = jest.fn();

  beforeEach(async () => {
    post.mockReset();
    save.mockReset();
    findOne.mockReset();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PackageTemplatesService,
        {
          provide: getRepositoryToken(PackageTemplate),
          useValue: {
            findOne,
            upsert: jest.fn(),
            createQueryBuilder: jest.fn(),
            save,
          },
        },
        {
          provide: getRepositoryToken(LocationZone),
          useValue: {},
        },
        {
          provide: OcsService,
          useValue: {
            post,
            getDefaultResellerId: () => 590,
          },
        },
        {
          provide: LocationZoneService,
          useValue: { findManyByIds: jest.fn() },
        },
      ],
    }).compile();

    service = module.get(PackageTemplatesService);
  });

  it('lists template, sends modifyPPTCore with new cost, persists price', async () => {
    const row = {
      id: 'uuid-1',
      packageTemplateId: '1204',
      packageTemplateName: 'Test Pack',
      zoneId: '21',
      zoneName: 'Zone A',
      periodDays: 30,
      volume: '10GB',
      price: 10,
      currency: 'EUR',
      isDeleted: false,
    };
    findOne.mockResolvedValue({ ...row });

    const ocsTemplate = {
      prepaidpackagetemplateid: 1204,
      prepaidpackagetemplatename: 'Test Pack',
      resellerid: 1,
      locationzoneid: 21,
      perioddays: 30,
      databyte: 10737418240,
      destinationzoneid: 5,
      esimSponsor: 1,
      cost: 10,
    };

    post
      .mockResolvedValueOnce({
        status: { code: 0, msg: 'OK' },
        listPrepaidPackageTemplate: { template: [ocsTemplate] },
      })
      .mockResolvedValueOnce({
        status: { code: 0, msg: 'OK' },
        modifyPrepaidPackageTemplate: { ...ocsTemplate, cost: 12.5 },
      });

    save.mockImplementation(async (r) => r);

    const result = await service.updatePackage('uuid-1', { price: 12.5 });

    expect(post).toHaveBeenCalledTimes(2);
    expect(post.mock.calls[0][0]).toEqual({
      listPrepaidPackageTemplate: { templateId: 1204 },
    });
    expect(post.mock.calls[1][0]).toEqual({
      modifyPPTCore: {
        prepaidpackagetemplateid: 1204,
        prepaidpackagetemplatename: 'Test Pack',
        resellerid: 1,
        locationzoneid: 21,
        perioddays: 30,
        cost: 12.5,
        destinationzoneid: 5,
        databyte: 10737418240,
        esimSponsor: 1,
      },
    });
    expect(save).toHaveBeenCalled();
    expect(result.price).toBe(12.5);
    expect(result.id).toBe('uuid-1');
  });
});
