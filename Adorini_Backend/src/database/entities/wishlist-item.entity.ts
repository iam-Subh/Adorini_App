import { Column, Entity, Index, JoinColumn, ManyToOne, Unique } from 'typeorm';

import { BaseEntity } from './base.entity';
import type { Product } from './product.entity';
import type { User } from './user.entity';

/**
 * One saved product in a buyer's wishlist.
 *
 * Keyed by `(userId, productId)` so adding an already-saved product is
 * idempotent, and deleting a user or product cascades cleanly.
 */
@Unique('uq_wishlist_item_user_product', ['userId', 'productId'])
@Index('idx_wishlist_items_user', ['userId'])
@Entity('wishlist_items')
export class WishlistItem extends BaseEntity {
  @ManyToOne('User', { onDelete: 'CASCADE', nullable: false })
  @JoinColumn()
  user: User;

  @Column({ type: 'uuid' })
  userId: string;

  @ManyToOne('Product', { onDelete: 'CASCADE', nullable: false })
  @JoinColumn()
  product: Product;

  @Column({ type: 'uuid' })
  productId: string;
}

