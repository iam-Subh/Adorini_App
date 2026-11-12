import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';

import { MediaProvenance } from '../../../common/enums/domain.enums';
import type { Env } from '../../../config/env.validation';
import { Product, WishlistItem } from '../../../database/entities';
import type { ProductSummaryDto } from '../../catalog/dto/product-summary.dto';

const PG_UNIQUE_VIOLATION = '23505';

@Injectable()
export class WishlistService {
  constructor(
    @InjectRepository(WishlistItem)
    private readonly wishlistRepo: Repository<WishlistItem>,
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async list(userId: string): Promise<ProductSummaryDto[]> {
    const items = await this.wishlistRepo
      .createQueryBuilder('item')
      .innerJoinAndSelect('item.product', 'product')
      .innerJoinAndSelect('product.category', 'category')
      .leftJoinAndSelect('product.brand', 'brand')
      .leftJoinAndSelect(
        'product.media',
        'thumbnail',
        'thumbnail.provenance = :adminProvenance AND thumbnail.displayOrder = 0',
        { adminProvenance: MediaProvenance.ADMIN },
      )
      .where('item.userId = :userId', { userId })
      .andWhere('product.isActive = true')
      .andWhere('category.isActive = true')
      .andWhere('(brand.id IS NULL OR brand.isActive = true)')
      .orderBy('item.createdAt', 'DESC')
      .getMany();

    return items.map((item) => {
      const p = item.product;
      return {
        id: p.id,
        slug: p.slug,
        name: p.name,
        pricePaise: p.pricePaise,
        compareAtPricePaise: p.compareAtPricePaise,
        fabricType: p.fabricType,
        printTechnique: p.printTechnique,
        categorySlug: p.category.slug,
        brandSlug: p.brand?.slug ?? null,
        thumbnailUrl: p.media?.[0]?.objectKey ? this.toPublicUrl(p.media[0].objectKey) : null,
      };
    });
  }

  /**
   * Idempotent: adding a product already on the wishlist simply returns the
   * current wishlist rather than throwing a 409.
   */
  async add(userId: string, productId: string): Promise<ProductSummaryDto[]> {
    const product = await this.productRepo.findOne({
      where: { id: productId, isActive: true },
      select: { id: true },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    const existing = await this.wishlistRepo.findOne({
      where: { userId, productId },
      select: { id: true },
    });

    if (!existing) {
      try {
        await this.wishlistRepo.save(
          this.wishlistRepo.create({ userId, productId }),
        );
      } catch (error) {
        if (
          !(
            error instanceof QueryFailedError &&
            (error as QueryFailedError & { code?: string }).code === PG_UNIQUE_VIOLATION
          )
        ) {
          throw error;
        }
      }
    }

    return this.list(userId);
  }

  /**
   * Idempotent: removing a product not on the wishlist succeeds and returns the
   * remaining wishlist.
   */
  async remove(userId: string, productId: string): Promise<ProductSummaryDto[]> {
    await this.wishlistRepo.delete({ userId, productId });
    return this.list(userId);
  }

  private toPublicUrl(objectKey: string): string {
    const base = this.config.get('R2_PUBLIC_BASE_URL', { infer: true });
    return `${base.replace(/\/$/, '')}/${objectKey}`;
  }
}

