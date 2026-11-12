import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { WishlistService } from '../services/wishlist.service';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { AuthUser } from '../../../common/types/auth-user';
import { ProductSummaryDto } from '../../catalog/dto/product-summary.dto';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users/me/wishlist')
export class WishlistController {
  constructor(private readonly wishlist: WishlistService) {}

  @Get()
  @ApiOperation({ summary: 'List products saved to the signed-in user’s wishlist' })
  @ApiResponse({ status: 200, type: [ProductSummaryDto] })
  list(@CurrentUser() user: AuthUser): Promise<ProductSummaryDto[]> {
    return this.wishlist.list(user.id);
  }

  @Post(':productId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Save a product to the wishlist (idempotent)',
    description: 'Returns the updated wishlist in most-recently-saved order.',
  })
  @ApiResponse({ status: 200, type: [ProductSummaryDto] })
  @ApiResponse({ status: 404, description: 'Product not found' })
  add(
    @CurrentUser() user: AuthUser,
    @Param('productId', ParseUUIDPipe) productId: string,
  ): Promise<ProductSummaryDto[]> {
    return this.wishlist.add(user.id, productId);
  }

  @Delete(':productId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Remove a product from the wishlist (idempotent)',
    description: 'Returns the updated wishlist.',
  })
  @ApiResponse({ status: 200, type: [ProductSummaryDto] })
  remove(
    @CurrentUser() user: AuthUser,
    @Param('productId', ParseUUIDPipe) productId: string,
  ): Promise<ProductSummaryDto[]> {
    return this.wishlist.remove(user.id, productId);
  }
}

