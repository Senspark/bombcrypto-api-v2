import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialSchema1714856000000 implements MigrationInterface {
    name = 'InitialSchema1714856000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Create indexer_state table
        await queryRunner.query(`
            CREATE TABLE "indexer_state" (
                "network" varchar(10) NOT NULL,
                "last_processed_block" bigint NOT NULL DEFAULT '0',
                "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_indexer_state" PRIMARY KEY ("network")
            )
        `);

        // Create partitioned nfts table
        await queryRunner.query(`
            CREATE TABLE "nfts" (
                "id" uuid NOT NULL,
                "network" varchar(10) NOT NULL,
                "token_id" bigint NOT NULL,
                "owner_address" char(42) NOT NULL,
                "metadata" jsonb NOT NULL DEFAULT '{}',
                "last_update_block" bigint NOT NULL,
                CONSTRAINT "PK_nfts" PRIMARY KEY ("id", "network")
            ) PARTITION BY LIST ("network");
        `);

        // Create partitions
        await queryRunner.query(`
            CREATE TABLE "nfts_bsc" PARTITION OF "nfts" FOR VALUES IN ('bsc');
        `);
        await queryRunner.query(`
            CREATE TABLE "nfts_polygon" PARTITION OF "nfts" FOR VALUES IN ('polygon');
        `);

        // Create indexes
        await queryRunner.query(`
            CREATE UNIQUE INDEX "IDX_nfts_network_token_id" ON "nfts" ("network", "token_id");
        `);
        await queryRunner.query(`
            CREATE INDEX "IDX_nfts_owner_address" ON "nfts" ("owner_address");
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "IDX_nfts_owner_address"`);
        await queryRunner.query(`DROP INDEX "IDX_nfts_network_token_id"`);
        await queryRunner.query(`DROP TABLE "nfts_polygon"`);
        await queryRunner.query(`DROP TABLE "nfts_bsc"`);
        await queryRunner.query(`DROP TABLE "nfts"`);
        await queryRunner.query(`DROP TABLE "indexer_state"`);
    }
}
