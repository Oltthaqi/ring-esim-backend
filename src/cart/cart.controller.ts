import { Controller, Post, Body, UseGuards, Request } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { CartService } from './cart.service';
import {
  PricePreviewDto,
  PricePreviewResponseDto,
} from './dto/price-preview.dto';

@ApiTags('Cart')
@ApiBearerAuth()
@Controller('cart')
@UseGuards(AuthGuard('jwt'))
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Post('price-preview')
  @ApiOperation({
    summary: 'Calculate price preview without creating an order',
    description:
      'Returns calculated pricing breakdown including promo, reward, and credits. Does not create an order.',
  })
  @ApiResponse({
    status: 200,
    description: 'Price breakdown',
    type: PricePreviewResponseDto,
  })
  async pricePreview(
    @Body() dto: PricePreviewDto,
    @Request() req,
  ): Promise<PricePreviewResponseDto> {
    const userId = req.user.uuid || req.user.id;
    return this.cartService.calculatePricePreview(dto, userId);
  }
}
