-- AlterTable
ALTER TABLE "payment_record" ALTER COLUMN "created_at" SET DEFAULT (now() AT TIME ZONE 'utc');

-- AlterTable
ALTER TABLE "ticket" ALTER COLUMN "created_at" SET DEFAULT (now() AT TIME ZONE 'utc');
