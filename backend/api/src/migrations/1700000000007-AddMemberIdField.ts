import { MigrationInterface, QueryRunner } from "typeorm";

export class AddMemberIdField1700000000007 implements MigrationInterface {
    name = 'AddMemberIdField1700000000007'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add the member_id column (nullable initially)
        await queryRunner.query(`ALTER TABLE "members" ADD "member_id" character varying(4)`);
        
        // Get all existing members
        const members = await queryRunner.query(`SELECT "id" FROM "members" ORDER BY "created_at" ASC`);
        
        // Generate unique 4-digit member IDs starting from 1001
        let memberIdCounter = 1001;
        
        for (const member of members) {
            // Ensure we don't exceed 4 digits (max 9999)
            if (memberIdCounter > 9999) {
                throw new Error('Cannot generate more than 8999 unique 4-digit member IDs (1001-9999)');
            }
            
            // Check if this member ID already exists (in case of conflicts)
            let memberIdToUse = memberIdCounter.toString();
            let existingMember = await queryRunner.query(
                `SELECT "id" FROM "members" WHERE "member_id" = $1`, 
                [memberIdToUse]
            );
            
            // If it exists, find the next available ID
            while (existingMember.length > 0 && memberIdCounter <= 9999) {
                memberIdCounter++;
                memberIdToUse = memberIdCounter.toString();
                existingMember = await queryRunner.query(
                    `SELECT "id" FROM "members" WHERE "member_id" = $1`, 
                    [memberIdToUse]
                );
            }
            
            // Update the member with the generated member ID
            await queryRunner.query(
                `UPDATE "members" SET "member_id" = $1 WHERE "id" = $2`,
                [memberIdToUse, member.id]
            );
            
            memberIdCounter++;
        }
        
        // Now make the column NOT NULL and add unique constraint
        await queryRunner.query(`ALTER TABLE "members" ALTER COLUMN "member_id" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "members" ADD CONSTRAINT "UQ_members_member_id" UNIQUE ("member_id")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Remove the unique constraint and drop the column
        await queryRunner.query(`ALTER TABLE "members" DROP CONSTRAINT "UQ_members_member_id"`);
        await queryRunner.query(`ALTER TABLE "members" DROP COLUMN "member_id"`);
    }
}
