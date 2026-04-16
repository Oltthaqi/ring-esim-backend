import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { JwtRolesGuard } from '../auth/utils/jwt\u2011roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../users/enums/role.enum';
import { ResellerOrdersService } from './reseller-orders.service';
import { PdfService } from './pdf.service';
import { CreateResellerOrderDto } from './dto/create-reseller-order.dto';
import { ResellerOrderStatus } from './entities/reseller-order.entity';
import { assertResellerOwnsResource } from '../common/utils/assert-reseller-ownership';
import type { Response } from 'express';

@ApiTags('Reseller Orders')
@ApiBearerAuth()
@Controller('reseller-orders')
@UseGuards(AuthGuard('jwt'), JwtRolesGuard)
export class ResellerOrdersController {
  constructor(
    private readonly ordersService: ResellerOrdersService,
    private readonly pdfService: PdfService,
  ) {}

  @Post()
  @Roles(Role.RESELLER)
  @ApiOperation({ summary: 'Place a new eSIM order (debits reseller balance)' })
  createOrder(
    @Body() dto: CreateResellerOrderDto,
    @Req() req: { user: { uuid: string; reseller_id: string } },
  ) {
    return this.ordersService.createOrder(
      req.user.reseller_id,
      req.user.uuid,
      dto,
    );
  }

  @Get()
  @Roles(Role.RESELLER, Role.SUPER_ADMIN)
  @ApiOperation({
    summary: 'List orders (reseller sees own, superadmin sees all)',
  })
  listOrders(
    @Req() req: { user: { uuid: string; role: string; reseller_id?: string } },
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('status') status?: ResellerOrderStatus,
    @Query('resellerId') filterResellerId?: string,
  ) {
    if (req.user.role === Role.SUPER_ADMIN) {
      return this.ordersService.findAll(
        page ?? 1,
        limit ?? 20,
        filterResellerId,
        status,
      );
    }
    return this.ordersService.findAllForReseller(
      req.user.reseller_id!,
      page ?? 1,
      limit ?? 20,
      status,
    );
  }

  @Get(':id')
  @Roles(Role.RESELLER, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get order detail' })
  async getOrder(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: { user: { uuid: string; role: string; reseller_id?: string } },
  ) {
    const order = await this.ordersService.findById(id);
    if (!order) throw new NotFoundException('Order not found');
    assertResellerOwnsResource(req.user, order);
    return order;
  }

  @Get(':id/pdf')
  @Roles(Role.RESELLER, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Download eSIM PDF for an order' })
  async getOrderPdf(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: { user: { uuid: string; role: string; reseller_id?: string } },
    @Res() res: Response,
  ) {
    const order = await this.ordersService.findById(id);
    if (!order) throw new NotFoundException('Order not found');
    assertResellerOwnsResource(req.user, order);

    if (!order.qrUrl) {
      throw new NotFoundException('No eSIM data available for this order');
    }

    const pdfBuffer = await this.pdfService.generateEsimPdf(order);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="esim-${order.iccid ?? order.id}.pdf"`,
      'Content-Length': pdfBuffer.length,
    });
    res.end(pdfBuffer);
  }

  @Post(':id/refund')
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Refund a completed order (superadmin only)' })
  refundOrder(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: { user: { uuid: string } },
  ) {
    return this.ordersService.refundOrder(id, req.user.uuid);
  }
}
