import { NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { WishlistService } from './wishlist.service';
import { FabricType, PrintTechnique } from '../../../common/enums/domain.enums';
import { Product, WishlistItem } from '../../../database/entities';

describe('WishlistService', () => {
  let service: WishlistService;
  let qb: {
    innerJoinAndSelect: jest.Mock;
    leftJoinAndSelect: jest.Mock;
    where: jest.Mock;
    andWhere: jest.Mock;
    orderBy: jest.Mock;
    getMany: jest.Mock;
  };
  let wishlistRepo: {
    createQueryBuilder: jest.Mock;
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    delete: jest.Mock;
  };
  let productRepo: { findOne: jest.Mock };

  beforeEach(async () => {
    qb = {
      innerJoinAndSelect: jest.fn().mockReturnThis(),
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    };

    wishlistRepo = {
      createQueryBuilder: jest.fn().mockReturnValue(qb),
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((v: unknown) => v),
      save: jest.fn().mockResolvedValue({ id: 'w-1' }),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
    };

    productRepo = {
      findOne: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WishlistService,
        { provide: getRepositoryToken(WishlistItem), useValue: wishlistRepo },
        { provide: getRepositoryToken(Product), useValue: productRepo },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('https://cdn.example.com') },
        },
      ],
    }).compile();

    service = module.get(WishlistService);
  });

  it('lists saved products mapped to ProductSummaryDto', async () => {
    qb.getMany.mockResolvedValue([
      {
        id: 'w-1',
        product: {
          id: 'p-1',
          slug: 'teal-kalamkari-patch-kurti',
          name: 'Teal Kalamkari-Patch Kurti',
          pricePaise: 109_900,
          compareAtPricePaise: 139_900,
          fabricType: FabricType.RIGID,
          printTechnique: PrintTechnique.KALANKARI,
          category: { slug: 'one-piece' },
          brand: null,
          media: [{ objectKey: 'products/p-1/0.jpg' }],
        },
      },
    ]);

    const items = await service.list('user-1');

    expect(items).toEqual([
      {
        id: 'p-1',
        slug: 'teal-kalamkari-patch-kurti',
        name: 'Teal Kalamkari-Patch Kurti',
        pricePaise: 109_900,
        compareAtPricePaise: 139_900,
        fabricType: FabricType.RIGID,
        printTechnique: PrintTechnique.KALANKARI,
        categorySlug: 'one-piece',
        brandSlug: null,
        thumbnailUrl: 'https://cdn.example.com/products/p-1/0.jpg',
      },
    ]);
  });

  it('throws NotFoundException when adding an unknown or inactive product', async () => {
    productRepo.findOne.mockResolvedValue(null);

    await expect(service.add('user-1', 'missing-id')).rejects.toThrow(NotFoundException);
    expect(wishlistRepo.save).not.toHaveBeenCalled();
  });

  it('is idempotent when adding an already-saved product', async () => {
    productRepo.findOne.mockResolvedValue({ id: 'p-1' });
    wishlistRepo.findOne.mockResolvedValue({ id: 'w-1' });

    await service.add('user-1', 'p-1');

    expect(wishlistRepo.save).not.toHaveBeenCalled();
  });

  it('removes a product and returns the updated list', async () => {
    await service.remove('user-1', 'p-1');

    expect(wishlistRepo.delete).toHaveBeenCalledWith({
      userId: 'user-1',
      productId: 'p-1',
    });
  });
});

