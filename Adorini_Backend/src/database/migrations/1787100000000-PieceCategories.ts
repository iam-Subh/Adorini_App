import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Categories become the piece configuration; the craft becomes an attribute.
 *
 * This inverts `RestructureCatalogue`, at the owner's direction. Dress garments
 * are now filed as One Piece / Two Piece / Three Piece, and the print style —
 * Ajrak, Kalamkari, Batik, Patchwork, Bandhani, Ikat, Fancy — lives on
 * `products.print_technique`, where it is a filter rather than a place.
 *
 * Nothing is lost in the move: `print_technique` was already populated for every
 * product by the previous seed, so the craft survives intact and the catalog's
 * existing `printTechnique` filter starts doing real work.
 *
 * Products are **remapped, not deleted** — each one moves to the category
 * matching its `pieces` value, so the style categories are unreferenced by the
 * time they are dropped.
 */
export class PieceCategories1787100000000 implements MigrationInterface {
  name = 'PieceCategories1787100000000';

  private readonly styleSlugs = [
    'ajrak',
    'kalamkari',
    'batik',
    'patchwork',
    'bandhani',
    'ikat',
    'fancy',
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    // The three destinations, created here rather than left to the seed: the
    // remap below needs them to exist inside this transaction.
    await queryRunner.query(`
      INSERT INTO "categories" ("slug", "name", "description", "display_order", "sizes", "is_active")
      VALUES
        ('one-piece',   'One Piece',   'Single kurti, kurta, tunic, kaftan or dress.', 5, '{40,42,44,46}', true),
        ('two-piece',   'Two Piece',   'Kurta with a matching bottom.',                6, '{40,42,44,46}', true),
        ('three-piece', 'Three Piece', 'Kurta, bottom and dupatta.',                   7, '{40,42,44,46}', true)
      ON CONFLICT ("slug") DO NOTHING
    `);

    // Move every dress garment to the category matching its piece count.
    // Bottom wear has `pieces IS NULL` and is untouched.
    await queryRunner.query(`
      UPDATE "products" p
      SET "category_id" = c."id"
      FROM "categories" c
      WHERE c."slug" = CASE p."pieces"
                         WHEN 1 THEN 'one-piece'
                         WHEN 2 THEN 'two-piece'
                         WHEN 3 THEN 'three-piece'
                       END
        AND p."pieces" IS NOT NULL
    `);

    // Guard rather than assume: a dress product left behind would block the
    // delete below with a foreign-key error that says nothing useful about why.
    const stranded = await queryRunner.query(`
      SELECT COUNT(*)::int AS count FROM "products" p
      JOIN "categories" c ON c."id" = p."category_id"
      WHERE c."slug" = ANY($1)
    `, [this.styleSlugs]);

    if (stranded[0].count > 0) {
      throw new Error(
        `${stranded[0].count} product(s) still reference a style category — ` +
          'they are missing a `pieces` value and have nowhere to go.',
      );
    }

    await queryRunner.query(`DELETE FROM "categories" WHERE "slug" = ANY($1)`, [this.styleSlugs]);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Rebuild the style categories and send each product back to the one
    // matching its print technique. `pieces` is untouched throughout, so this
    // reverses cleanly in both directions.
    await queryRunner.query(`
      INSERT INTO "categories" ("slug", "name", "description", "display_order", "sizes", "is_active")
      VALUES
        ('ajrak',     'Ajrak',      'Hand-block Ajrakh resist printing.',      5,  '{40,42,44,46}', true),
        ('kalamkari', 'Kalam Kari', 'Hand-painted Kalamkari panels.',          6,  '{40,42,44,46}', true),
        ('batik',     'Batik',      'Wax-resist batik prints.',                7,  '{40,42,44,46}', true),
        ('patchwork', 'Patchwork',  'Pieced panels and appliqué.',             8,  '{40,42,44,46}', true),
        ('bandhani',  'Bandhani',   'Tie-dye bandhani prints.',                9,  '{40,42,44,46}', true),
        ('ikat',      'Ikat',       'Resist-dyed ikat weaves.',                10, '{40,42,44,46}', true),
        ('fancy',     'Fancy',      'Embroidered, zari and printed styles.',   11, '{40,42,44,46}', true)
      ON CONFLICT ("slug") DO NOTHING
    `);

    await queryRunner.query(`
      UPDATE "products" p
      SET "category_id" = c."id"
      FROM "categories" c
      WHERE c."slug" = CASE p."print_technique"::text
                         WHEN 'AJRAK'     THEN 'ajrak'
                         WHEN 'KALANKARI' THEN 'kalamkari'
                         WHEN 'BATIK'     THEN 'batik'
                         WHEN 'PATCHWORK' THEN 'patchwork'
                         WHEN 'BANDHANI'  THEN 'bandhani'
                         WHEN 'IKAT'      THEN 'ikat'
                         ELSE 'fancy'
                       END
        AND p."pieces" IS NOT NULL
    `);

    await queryRunner.query(
      `DELETE FROM "categories" WHERE "slug" IN ('one-piece', 'two-piece', 'three-piece')`,
    );
  }
}
