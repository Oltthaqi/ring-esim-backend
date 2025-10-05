import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UsersEntity } from '../users/entitites/users.entity';
import { Order, OrderStatus } from '../orders/entities/order.entity';
import {
  ProfileResponseDto,
  EsimStatsResponseDto,
  BillingDetailsDto,
  PurchasesResponseDto,
  PurchaseItemDto,
  PaymentsResponseDto,
  PaymentItemDto,
} from './dto/profile-response.dto';

@Injectable()
export class ProfileService {
  constructor(
    @InjectRepository(UsersEntity)
    private readonly userRepository: Repository<UsersEntity>,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
  ) {}

  async getProfile(userId: string): Promise<ProfileResponseDto> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      name:
        `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email,
      email: user.email,
      status: user.status || 'INACTIVE',
      verified: user.is_verified || false,
    };
  }

  async getEsimStats(userId: string): Promise<EsimStatsResponseDto> {
    // Verify user exists
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Get all completed orders for the user
    const orders = await this.orderRepository.find({
      where: {
        userId,
        status: OrderStatus.COMPLETED,
      },
      relations: ['packageTemplate'],
      order: { createdAt: 'DESC' },
    });

    // Calculate total eSIMs (count all completed orders)
    const totalEsims = orders.length;

    // Calculate total spent
    const totalSpent = orders.reduce(
      (sum, order) => sum + Number(order.amount || 0),
      0,
    );

    // Calculate active eSIMs (orders with active usage)
    // For simplicity, we'll consider orders with urlQrCode as potentially active
    const activeEsims = orders.filter((order) => order.urlQrCode).length;

    // Get last two eSIM package names
    const lastEsim = orders[0]?.packageTemplate?.packageTemplateName || null;
    const secondLastEsim =
      orders[1]?.packageTemplate?.packageTemplateName || null;

    return {
      totalEsims,
      totalSpent: Number(totalSpent.toFixed(2)),
      activeEsims,
      lastEsim,
      secondLastEsim,
    };
  }

  async getBillingDetails(userId: string): Promise<BillingDetailsDto> {
    // Verify user exists
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // For now, return null values as billing details are not yet implemented
    // This can be extended when billing details are added to the user entity
    return {
      name: `${user.first_name || ''} ${user.last_name || ''}`.trim() || null,
      address: null,
      vat: null,
      phone: user.phone_number || null,
      company: null,
    };
  }

  async getPurchases(userId: string): Promise<PurchasesResponseDto> {
    // Verify user exists
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Get all orders for the user
    const orders = await this.orderRepository.find({
      where: { userId },
      relations: ['packageTemplate'],
      order: { createdAt: 'DESC' },
    });

    const purchases: PurchaseItemDto[] = orders.map((order) => ({
      id: order.id,
      item:
        order.packageTemplate?.packageTemplateName ||
        `Order ${order.orderNumber}`,
      price: Number(order.amount || 0),
      date: order.createdAt,
      status: order.status,
    }));

    return {
      purchases,
      total: purchases.length,
    };
  }

  async getPayments(userId: string): Promise<PaymentsResponseDto> {
    // Verify user exists
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Get all completed orders for the user (these represent successful payments)
    const orders = await this.orderRepository.find({
      where: { userId },
      relations: ['packageTemplate'],
      order: { createdAt: 'DESC' },
    });

    const payments: PaymentItemDto[] = orders.map((order) => ({
      id: order.paymentIntentId || order.id,
      amount: Number(order.amount || 0),
      method: this.getPaymentMethod(order),
      date: order.createdAt,
      status: this.mapOrderStatusToPaymentStatus(order.status),
    }));

    return {
      payments,
      total: payments.length,
    };
  }

  private getPaymentMethod(order: Order): string {
    // If we have payment intent ID, it's likely a Stripe payment
    if (order.paymentIntentId) {
      return 'Credit Card';
    }
    // Default to generic payment method
    return 'Payment Gateway';
  }

  private mapOrderStatusToPaymentStatus(orderStatus: OrderStatus): string {
    switch (orderStatus) {
      case OrderStatus.COMPLETED:
        return 'COMPLETED';
      case OrderStatus.PENDING:
      case OrderStatus.PROCESSING:
        return 'PENDING';
      case OrderStatus.FAILED:
      case OrderStatus.CANCELLED:
        return 'FAILED';
      default:
        return 'PENDING';
    }
  }
}
