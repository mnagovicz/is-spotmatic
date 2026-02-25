-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "JobStatus" ADD VALUE 'GENERATING_TTS';
ALTER TYPE "JobStatus" ADD VALUE 'MIXING';

-- AlterTable
ALTER TABLE "render_jobs" ADD COLUMN     "backgroundVolumeDb" DOUBLE PRECISION,
ADD COLUMN     "voiceoverVolumeDb" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "templates" ADD COLUMN     "allowClientAudioEdit" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "backgroundVolumeDb" DOUBLE PRECISION NOT NULL DEFAULT -10,
ADD COLUMN     "fps" INTEGER NOT NULL DEFAULT 25,
ADD COLUMN     "voiceoverVolumeDb" DOUBLE PRECISION NOT NULL DEFAULT 0;
