import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AddressesController } from './controllers/addresses.controller';
import { UsersController } from './controllers/users.controller';
import { WishlistController } from './controllers/wishlist.controller';
import { AddressesService } from './services/addresses.service';
import { UsersService } from './services/users.service';
import { WishlistService } from './services/wishlist.service';
import { Address, Product, Referral, User, WishlistItem } from '../../database/entities';
import { StorageModule } from '../../providers/storage/storage.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Address, Referral, WishlistItem, Product]),
    StorageModule,
  ],
  controllers: [UsersController, AddressesController, WishlistController],
  providers: [UsersService, AddressesService, WishlistService],
  exports: [UsersService, AddressesService, WishlistService],
})
export class UsersModule {}
