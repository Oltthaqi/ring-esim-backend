import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { PromoCodesService } from './promo-codes.service';
import { CreatePromoCodeDto } from './dto/create-promo-code.dto';
import { UpdatePromoCodeDto } from './dto/update-promo-code.dto';
import { PromoCodeResponseDto } from './dto/promo-code-response.dto';
import { AuthGuard } from '@nestjs/passport';
import { JwtRolesGuard } from '../auth/utils/jwt‑roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../users/enums/role.enum';
import { PromoCodeStatus } from './entities/promo-code.entity';

@ApiTags('Admin - Promo Codes')
@ApiBearerAuth()
@Controller('api/admin/promo-codes')
@UseGuards(AuthGuard('jwt'), JwtRolesGuard)
@Roles(Role.ADMIN)
export class PromoCodesAdminController {
  constructor(private readonly promoCodesService: PromoCodesService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new promo code' })
  @ApiResponse({
    status: 201,
    description: 'Promo code created successfully',
    type: PromoCodeResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Validation error or duplicate code',
  })
  async create(
    @Body() createDto: CreatePromoCodeDto,
    @Request() req,
  ): Promise<PromoCodeResponseDto> {
    const userId = req.user?.id;
    return this.promoCodesService.create(createDto, userId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a promo code' })
  @ApiResponse({
    status: 200,
    description: 'Promo code updated successfully',
    type: PromoCodeResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Promo code not found' })
  async update(
    @Param('id') id: string,
    @Body() updateDto: UpdatePromoCodeDto,
  ): Promise<PromoCodeResponseDto> {
    return this.promoCodesService.update(id, updateDto);
  }

  @Get()
  @ApiOperation({ summary: 'List all promo codes with optional filters' })
  @ApiQuery({ name: 'status', enum: PromoCodeStatus, required: false })
  @ApiQuery({ name: 'search', type: String, required: false })
  @ApiQuery({ name: 'page', type: Number, required: false, example: 1 })
  @ApiQuery({ name: 'limit', type: Number, required: false, example: 50 })
  @ApiResponse({
    status: 200,
    description: 'List of promo codes',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: { $ref: '#/components/schemas/PromoCodeResponseDto' },
        },
        total: { type: 'number' },
        page: { type: 'number' },
        limit: { type: 'number' },
      },
    },
  })
  async findAll(
    @Query('status') status?: PromoCodeStatus,
    @Query('search') search?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.promoCodesService.findAll({ status, search, page, limit });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a promo code by ID' })
  @ApiResponse({
    status: 200,
    description: 'Promo code details',
    type: PromoCodeResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Promo code not found' })
  async findOne(@Param('id') id: string): Promise<PromoCodeResponseDto> {
    return this.promoCodesService.findOne(id);
  }
}
