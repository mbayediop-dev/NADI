-- AlterTable
ALTER TABLE "Lot" ADD COLUMN     "customPrice" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Settings" ADD COLUMN     "lotPricePerM2" DOUBLE PRECISION,
ADD COLUMN     "lotPriceRounding" INTEGER NOT NULL DEFAULT 1000;
