-- AlterTable: User AI recommendation preferences
ALTER TABLE "User" ADD COLUMN "preferences" JSONB;

-- AlterTable: Airdrop Gemini legitimacy/longevity assessment
ALTER TABLE "Airdrop" ADD COLUMN "aiLegitScore" INTEGER;
ALTER TABLE "Airdrop" ADD COLUMN "aiOutlook" TEXT;
ALTER TABLE "Airdrop" ADD COLUMN "aiSerious" BOOLEAN;
ALTER TABLE "Airdrop" ADD COLUMN "aiFlags" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Airdrop" ADD COLUMN "aiSummary" TEXT;
ALTER TABLE "Airdrop" ADD COLUMN "aiAssessedAt" TIMESTAMP(3);
