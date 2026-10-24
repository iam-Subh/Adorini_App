import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Brand leaves the shop.
 *
 * Adorini does not present its garments by brand: shoppers browse by what the
 * garment is, not who supplied it. The supplier names that had been seeded
 * (Four Cat, Payal, Lyra, MM, MG, NAVRANGA, Local) were placeholders standing in
 * for information no PDF actually carried, and the owner has removed the concept
 * from the storefront.
 *
 * ### `brand_id` becomes nullable, the table survives
 *
 * The `brands` table and the relation stay in the schema. Dropping them would
 * mean a destructive migration to write back the day a real supplier list
 * arrives, and nothing is gained by it — an unused nullable column costs a byte
 * of null bitmap per row.
 *
 * ### The join has to change with it
 *
 * `CatalogService.listProducts` inner-joined `product.brand` and filtered on
 * `brand.isActive`. An inner join drops every row whose join column is null, so
 * making the column nullable without touching that query would have emptied the
 * catalogue completely while every individual product still existed. That query
 * moves to a left join in the same change.
 */
export class DropBrandFromShop1787200000000 implements MigrationInterface {
  name = 'DropBrandFromShop1787200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "products" ALTER COLUMN "brand_id" DROP NOT NULL`);

    // Unlink first: the FK is ON DELETE RESTRICT, so the brand rows cannot go
    // while products still point at them.
    await queryRunner.query(`UPDATE "products" SET "brand_id" = NULL`);
    await queryRunner.query(`DELETE FROM "brands"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Not reversible in the honest sense: which product belonged to which
    // supplier was never recorded anywhere but the seed, so there is nothing to
    // restore it from. Rolling back would leave every product with a null brand
    // and a NOT NULL constraint it cannot satisfy, so the constraint is left
    // off. Re-run the seed of that era to get the placeholder brands back.
    await queryRunner.query(
      `SELECT 1 -- deliberately empty: see the comment above`,
    );
  }
}
