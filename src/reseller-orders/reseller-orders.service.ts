import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import {
  ResellerOrder,
  ResellerOrderStatus,
} from './entities/reseller-order.entity';
import { Reseller } from '../resellers/entities/reseller.entity';
import {
  BalanceTransaction,
  BalanceTransactionType,
} from '../resellers/entities/balance-transaction.entity';
import { OcsService } from '../ocs/ocs.service';
import { PackageVisibilityService } from '../package-template/package-visibility.service';
import { Decimal4Util } from '../common/utils/decimal4.util';
import { UpstreamApiError } from '../ocs/errors/upstream-api.error';
import { CreateResellerOrderDto } from './dto/create-reseller-order.dto';

@Injectable()
export class ResellerOrdersService {
  private readonly logger = new Logger(ResellerOrdersService.name);

  constructor(
    @InjectRepository(ResellerOrder)
    private readonly orderRepo: Repository<ResellerOrder>,
    private readonly ocsService: OcsService,
    private readonly visibilityService: PackageVisibilityService,
    private readonly dataSource: DataSource,
  ) {}

  async createOrder(
    resellerId: string,
    userId: string,
    dto: CreateResellerOrderDto,
  ): Promise<ResellerOrder> {
    return this.dataSource.transaction(async (manager) => {
      // 1. Row-level lock on reseller (prevents double-spend)
      const reseller = await manager
        .createQueryBuilder(Reseller, 'r')
        .setLock('pessimistic_write')
        .where('r.id = :id', { id: resellerId })
        .getOne();

      if (!reseller) throw new NotFoundException('Reseller not found');

      // 2. Check reseller is active
      if (!reseller.isActive) {
        throw new ForbiddenException('Reseller account is deactivated');
      }

      // 3. Fetch upstream template server-side (never trust client price)
      const templates = await this.ocsService.listPrepaidPackageTemplates(
        this.ocsService.getDefaultResellerId(),
      );
      const template = templates.find(
        (t) => t.prepaidpackagetemplateid === dto.upstreamTemplateId,
      );
      if (!template) {
        throw new NotFoundException(
          `Package template ${dto.upstreamTemplateId} not found`,
        );
      }

      // 4. Check visibility
      if (await this.visibilityService.isHidden(dto.upstreamTemplateId)) {
        throw new ForbiddenException('This package is not available');
      }

      // 5. Compute prices
      const ourSellPrice = Decimal4Util.toString(template.cost);
      const discountPct = parseFloat(reseller.discountPct);
      const discountMultiplier = Decimal4Util.toString(1 - discountPct / 100);
      const resellerPrice = Decimal4Util.multiply(
        ourSellPrice,
        discountMultiplier,
      );

      // 6. Balance check
      const currentBalance = reseller.balance;
      if (!Decimal4Util.greaterThanOrEqual(currentBalance, resellerPrice)) {
        if (!reseller.allowDebt) {
          throw new BadRequestException('INSUFFICIENT_BALANCE');
        }
        // Check credit limit
        if (reseller.creditLimit != null) {
          const afterDebit = Decimal4Util.subtract(
            currentBalance,
            resellerPrice,
          );
          const floor = Decimal4Util.negate(
            Decimal4Util.toString(parseFloat(reseller.creditLimit)),
          );
          if (Decimal4Util.lessThan(afterDebit, floor)) {
            throw new BadRequestException('CREDIT_LIMIT_EXCEEDED');
          }
        }
      }

      // 7. Create order row (PENDING)
      const order = manager.create(ResellerOrder, {
        resellerId,
        userId,
        status: ResellerOrderStatus.PENDING,
        upstreamTemplateId: template.prepaidpackagetemplateid,
        upstreamTemplateName: template.prepaidpackagetemplatename,
        upstreamTemplateCost: ourSellPrice,
        ourSellPrice,
        discountPctApplied: discountPct.toFixed(2),
        resellerPrice,
        validityDays: dto.validityPeriod ?? template.perioddays,
        notes: dto.notes ?? null,
      });
      const savedOrder = await manager.save(order);

      // 8. Call upstream
      try {
        savedOrder.status = ResellerOrderStatus.PROCESSING;
        await manager.save(savedOrder);

        const result = await this.ocsService.affectPackageToSubscriberByAccount(
          {
            packageTemplateId: dto.upstreamTemplateId,
            accountForSubs: this.ocsService.getSharedAccountId(),
            validityPeriod: dto.validityPeriod,
          },
          savedOrder.id,
        );

        // 9. Success: update order with upstream data
        savedOrder.status = ResellerOrderStatus.COMPLETED;
        savedOrder.iccid = result.iccid;
        savedOrder.smdpServer = result.smdpServer;
        savedOrder.activationCode = result.activationCode;
        savedOrder.qrUrl = result.urlQrCode;
        savedOrder.subscriberId = String(result.subscriberId);
        savedOrder.esimId = String(result.esimId);
        savedOrder.subsPackageId = String(result.subsPackageId);
        savedOrder.upstreamResponse = result as unknown as Record<
          string,
          unknown
        >;
        await manager.save(savedOrder);

        // 10. Debit balance
        const newBalance = Decimal4Util.subtract(currentBalance, resellerPrice);
        reseller.balance = newBalance;
        await manager.save(reseller);

        // 11. Record balance transaction
        await manager.save(
          manager.create(BalanceTransaction, {
            resellerId,
            type: BalanceTransactionType.ORDER_DEBIT,
            amount: Decimal4Util.negate(resellerPrice),
            balanceAfter: newBalance,
            orderId: savedOrder.id,
            performedBy: userId,
          }),
        );

        return savedOrder;
      } catch (e) {
        // On failure: mark order FAILED, no debit
        savedOrder.status = ResellerOrderStatus.FAILED;
        savedOrder.errorMessage =
          e instanceof UpstreamApiError
            ? `[${e.code}] ${e.upstreamMessage}`
            : e instanceof Error
              ? e.message
              : String(e);
        await manager.save(savedOrder);

        if (e instanceof UpstreamApiError) {
          throw new BadRequestException({
            message: 'UPSTREAM_ORDER_FAILED',
            detail: savedOrder.errorMessage,
            orderId: savedOrder.id,
          });
        }

        // Log critical if we're not sure about the upstream state
        this.logger.error(
          `CRITICAL: Order ${savedOrder.id} upstream call failed with non-API error. ` +
            `Manual reconciliation may be needed. Error: ${savedOrder.errorMessage}`,
        );
        throw e;
      }
    });
  }

  async refundOrder(
    orderId: string,
    performedByUserId: string,
  ): Promise<ResellerOrder> {
    return this.dataSource.transaction(async (manager) => {
      const order = await manager.findOne(ResellerOrder, {
        where: { id: orderId },
      });
      if (!order) throw new NotFoundException('Order not found');
      if (order.status !== ResellerOrderStatus.COMPLETED) {
        throw new BadRequestException('Only completed orders can be refunded');
      }

      // Lock reseller row
      const reseller = await manager
        .createQueryBuilder(Reseller, 'r')
        .setLock('pessimistic_write')
        .where('r.id = :id', { id: order.resellerId })
        .getOne();
      if (!reseller) throw new NotFoundException('Reseller not found');

      // Credit back
      const newBalance = Decimal4Util.add(
        reseller.balance,
        order.resellerPrice,
      );
      reseller.balance = newBalance;
      await manager.save(reseller);

      // Record transaction
      await manager.save(
        manager.create(BalanceTransaction, {
          resellerId: order.resellerId,
          type: BalanceTransactionType.ORDER_REFUND,
          amount: order.resellerPrice,
          balanceAfter: newBalance,
          orderId: order.id,
          performedBy: performedByUserId,
        }),
      );

      // Update order
      order.status = ResellerOrderStatus.REFUNDED;
      order.refundedAt = new Date();
      order.refundedBy = performedByUserId;
      await manager.save(order);

      return order;
    });
  }

  async findAllForReseller(
    resellerId: string,
    page = 1,
    limit = 20,
    status?: ResellerOrderStatus,
  ): Promise<{ data: ResellerOrder[]; total: number }> {
    const where: Record<string, unknown> = { resellerId };
    if (status) where.status = status;

    const [data, total] = await this.orderRepo.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data, total };
  }

  async findAll(
    page = 1,
    limit = 20,
    resellerId?: string,
    status?: ResellerOrderStatus,
  ): Promise<{ data: ResellerOrder[]; total: number }> {
    const where: Record<string, unknown> = {};
    if (resellerId) where.resellerId = resellerId;
    if (status) where.status = status;

    const [data, total] = await this.orderRepo.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data, total };
  }

  async findById(id: string): Promise<ResellerOrder | null> {
    return this.orderRepo.findOne({
      where: { id },
      relations: ['reseller'],
    });
  }
}
