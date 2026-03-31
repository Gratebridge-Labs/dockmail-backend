-- AlterEnum
ALTER TYPE "EmailStatus" ADD VALUE 'RECEIVED';

-- AlterTable
ALTER TABLE "mailboxes" ADD COLUMN     "imapLastUid" INTEGER;
