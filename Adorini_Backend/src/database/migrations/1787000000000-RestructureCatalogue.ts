import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The catalogue stops being organised by garment and starts being organised by
 * print style.
 *
 * "Kurti", "Kaftaan", "One-Piece", "Two-Piece Set" and "Three-Piece Set" were
 * categories doing two jobs at once — naming the garment *and* encoding how
 * many pieces came in the box. Splitting them is the point of this migration:
 *
 *   category  ->  the craft: Ajrak, Kalamkari, Batik, Patchwork, Bandhani,
 *                 Ikat, Fancy (plus bottom wear, which stays by garment)
 *   pieces    ->  a property of the product, 1 / 2 / 3
 *
 * A kurti is now "Kalamkari, 1 piece"; a suit set is "Ajrak, 3 piece".
 *
 * Blouse and Petticoat leave entirely — the client does not stock them.
 *
 * ### This deletes data, deliberately
 *
 * Categories are referenced by `products.category_id` with ON DELETE RESTRICT,
 * so a retired category cannot be dropped while products still point at it.
 * Those products are placeholder catalogue rows that the seed re-creates under
 * the new taxonomy, and no order has ever referenced one. The delete is scoped
 * to the retired categories: bottom wear and its stock are untouched.
 */
export class RestructureCatalogue1787000000000 implements MigrationInterface {
  name = 'RestructureCatalogue1787000000000';

  /** Categories that stop existing. Bottom wear is not in this list. */
  private readonly retired = [
    'blouses',
    'petticoats',
    'kurtis',
    'kaftaans',
    'one-piece',
    'two-piece-suit-sets',
    'three-piece-suit-sets',
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ---- 1. Piece count moves onto the product ----
    //
    // Nullable because bottom wear has no piece configuration: a palazzo is not
    // "1 piece", it is simply a palazzo. Defaulting it to 1 would put a number
    // on the PDP that means nothing.
    await queryRunner.query(`ALTER TABLE "products" ADD COLUMN "pieces" smallint`);
    await queryRunner.query(
      `ALTER TABLE "products" ADD CONSTRAINT "chk_product_pieces_range" ` +
        `CHECK ("pieces" IS NULL OR "pieces" BETWEEN 1 AND 3)`,
    );

    // ---- 2. Two new print techniques ----
    //
    // Bandhani and ikat were previously filed as FANCY, which made that value a
    // catch-all covering more than half the catalogue — useless as a filter.
    // Postgres 12+ allows ADD VALUE inside a transaction as long as the value is
    // not *used* in the same transaction; the seed inserts separately, so this
    // is safe here.
    await queryRunner.query(`ALTER TYPE "print_technique" ADD VALUE IF NOT EXISTS 'BANDHANI'`);
    await queryRunner.query(`ALTER TYPE "print_technique" ADD VALUE IF NOT EXISTS 'IKAT'`);
    await queryRunner.query(`ALTER TYPE "print_technique" ADD VALUE IF NOT EXISTS 'PATCHWORK'`);

    // ---- 3. Size band narrows to 40-46 ----
    await queryRunner.query(`DELETE FROM "product_variants" WHERE "nominal_size" > 46`);
    await queryRunner.query(
      `ALTER TABLE "product_variants" DROP CONSTRAINT "chk_variant_nominal_size_range"`,
    );
    // Floor stays 32 rather than 40: the constraint is a coarse backstop against
    // a transposed digit, and the real per-category band lives on
    // `categories.sizes`. Blouse leaves with its 32-36 band, but nothing is
    // gained by re-narrowing the floor and it would have to be widened again
    // the first time a low-sized garment returns.
    await queryRunner.query(
      `ALTER TABLE "product_variants" ADD CONSTRAINT "chk_variant_nominal_size_range" ` +
        `CHECK ("nominal_size" BETWEEN 32 AND 46)`,
    );
    await queryRunner.query(
      `UPDATE "categories" SET "sizes" = '{40,42,44,46}' WHERE 48 = ANY("sizes")`,
    );

    // ---- 4. Retire the garment-shaped categories ----
    const list = this.retired.map((slug) => `'${slug}'`).join(', ');
    await queryRunner.query(`
      DELETE FROM "products"
      WHERE "category_id" IN (SELECT "id" FROM "categories" WHERE "slug" IN (${list}))
    `);
    await queryRunner.query(`DELETE FROM "categories" WHERE "slug" IN (${list})`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // The retired categories and their products are not restored: they were
    // seed data, and re-running the seed of that era is the way back. Rolling
    // back only undoes the schema so the old code can run again.
    await queryRunner.query(
      `ALTER TABLE "product_variants" DROP CONSTRAINT "chk_variant_nominal_size_range"`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_variants" ADD CONSTRAINT "chk_variant_nominal_size_range" ` +
        `CHECK ("nominal_size" BETWEEN 32 AND 48)`,
    );

    await queryRunner.query(`ALTER TABLE "products" DROP CONSTRAINT "chk_product_pieces_range"`);
    await queryRunner.query(`ALTER TABLE "products" DROP COLUMN "pieces"`);

    // Enum values are deliberately left in place. Postgres cannot drop a value
    // from an enum, and recreating the type would mean rewriting every row that
    // uses it — a far larger operation than the one being reversed.
  }
}
