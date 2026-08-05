import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Per-event toggle for how the hero image displays on the public event page:
 * false (default) = cropped to a 16:9 banner, true = shown at natural ratio.
 */
export class EventHeroImageFull1754040000000 implements MigrationInterface {
  name = "EventHeroImageFull1754040000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "events" ADD COLUMN "hero_image_full" boolean NOT NULL DEFAULT false`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "events" DROP COLUMN "hero_image_full"`,
    );
  }
}
