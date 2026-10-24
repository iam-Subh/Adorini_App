import type { MigrationInterface, QueryRunner } from 'typeorm';

/** Keep new category rows on the same 40-46 size band as the catalog seed. */
export class AlignCategorySizeBand1787300000000 implements MigrationInterface {
  name = 'AlignCategorySizeBand1787300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "categories" ALTER COLUMN "sizes" SET DEFAULT '{40,42,44,46}'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "categories" ALTER COLUMN "sizes" SET DEFAULT '{40,42,44,46,48}'`,
    );
  }
}
