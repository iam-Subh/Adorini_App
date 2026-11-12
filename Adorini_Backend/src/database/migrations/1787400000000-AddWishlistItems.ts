import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddWishlistItems1787400000000 implements MigrationInterface {
  name = 'AddWishlistItems1787400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "wishlist_items" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "user_id" uuid NOT NULL,
        "product_id" uuid NOT NULL,
        CONSTRAINT "uq_wishlist_item_user_product" UNIQUE ("user_id", "product_id"),
        CONSTRAINT "PK_wishlist_items" PRIMARY KEY ("id"),
        CONSTRAINT "fk_wishlist_items_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "fk_wishlist_items_product" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);
    await queryRunner.query(`CREATE INDEX "idx_wishlist_items_user" ON "wishlist_items" ("user_id")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."idx_wishlist_items_user"`);
    await queryRunner.query(`DROP TABLE "wishlist_items"`);
  }
}

