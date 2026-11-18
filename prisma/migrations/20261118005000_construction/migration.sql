-- CreateEnum
CREATE TYPE "LandOrigin" AS ENUM ('COMPANY_LOT', 'OWN_LAND', 'NO_LAND');

-- CreateEnum
CREATE TYPE "ConstructionStatus" AS ENUM ('REQUESTED', 'STUDY', 'OFFER_SENT', 'SIGNED', 'IN_PROGRESS', 'SUSPENDED', 'DELIVERED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "QuoteStatus" AS ENUM ('DRAFT', 'SENT', 'ACCEPTED', 'DECLINED');

-- CreateEnum
CREATE TYPE "ExpenseScope" AS ENUM ('SITE', 'PROJECT');

-- CreateEnum
CREATE TYPE "ExpenseCategory" AS ENUM ('MATERIALS', 'LABOR', 'EQUIPMENT', 'TRANSPORT', 'SUBCONTRACTING', 'STUDIES', 'PERMITS', 'UTILITIES', 'OTHER');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "DocumentCategory" ADD VALUE 'PERMIT';
ALTER TYPE "DocumentCategory" ADD VALUE 'QUOTE';
ALTER TYPE "DocumentCategory" ADD VALUE 'INVOICE';

-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "constructionProjectId" TEXT,
ADD COLUMN     "fromClient" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "HouseModel" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tagline" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "levels" TEXT,
    "bedrooms" INTEGER,
    "bathrooms" INTEGER,
    "livingAreaM2" DOUBLE PRECISION,
    "minLandM2" DOUBLE PRECISION,
    "basePrice" DOUBLE PRECISION,
    "images" JSONB NOT NULL DEFAULT '[]',
    "features" TEXT[],
    "published" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HouseModel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConstructionProject" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" "ConstructionStatus" NOT NULL DEFAULT 'REQUESTED',
    "source" TEXT NOT NULL DEFAULT 'ADMIN',
    "buyerId" TEXT,
    "contactName" TEXT NOT NULL,
    "contactPhone" TEXT NOT NULL,
    "contactEmail" TEXT,
    "landOrigin" "LandOrigin" NOT NULL,
    "lotId" TEXT,
    "landAddress" TEXT,
    "landAreaM2" DOUBLE PRECISION,
    "landReference" TEXT,
    "houseModelId" TEXT,
    "customPlan" BOOLEAN NOT NULL DEFAULT false,
    "requirements" TEXT,
    "budget" DOUBLE PRECISION,
    "contractAmount" DOUBLE PRECISION,
    "startDate" TIMESTAMP(3),
    "plannedEndDate" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "showExpensesToClient" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConstructionProject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConstructionQuote" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" "QuoteStatus" NOT NULL DEFAULT 'DRAFT',
    "items" JSONB NOT NULL DEFAULT '[]',
    "amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "notes" TEXT,
    "validUntil" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "respondedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConstructionQuote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConstructionPhase" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "MilestoneStatus" NOT NULL DEFAULT 'PLANNED',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "weight" INTEGER NOT NULL DEFAULT 1,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConstructionPhase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConstructionInstallment" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "index" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "ConstructionInstallment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConstructionPayment" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "paidAt" TIMESTAMP(3) NOT NULL,
    "method" "PaymentMethod" NOT NULL DEFAULT 'CASH',
    "reference" TEXT,
    "note" TEXT,
    "receiptNumber" TEXT NOT NULL,
    "recordedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConstructionPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Expense" (
    "id" TEXT NOT NULL,
    "scope" "ExpenseScope" NOT NULL,
    "projectId" TEXT,
    "phaseId" TEXT,
    "category" "ExpenseCategory" NOT NULL DEFAULT 'MATERIALS',
    "label" TEXT NOT NULL,
    "supplier" TEXT,
    "quantity" DOUBLE PRECISION,
    "unit" TEXT,
    "unitPrice" DOUBLE PRECISION,
    "amount" DOUBLE PRECISION NOT NULL,
    "spentAt" TIMESTAMP(3) NOT NULL,
    "method" "PaymentMethod",
    "reference" TEXT,
    "note" TEXT,
    "attachmentKey" TEXT,
    "attachmentName" TEXT,
    "attachmentMime" TEXT,
    "visibleToClient" BOOLEAN NOT NULL DEFAULT true,
    "recordedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConstructionUpdate" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "phaseId" TEXT,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL DEFAULT '',
    "visibleToClient" BOOLEAN NOT NULL DEFAULT true,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConstructionUpdate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConstructionMedia" (
    "id" TEXT NOT NULL,
    "updateId" TEXT NOT NULL,
    "type" "MediaType" NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "caption" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConstructionMedia_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ConstructionProject_reference_key" ON "ConstructionProject"("reference");

-- CreateIndex
CREATE INDEX "ConstructionProject_status_idx" ON "ConstructionProject"("status");

-- CreateIndex
CREATE INDEX "ConstructionProject_buyerId_idx" ON "ConstructionProject"("buyerId");

-- CreateIndex
CREATE INDEX "ConstructionProject_lotId_idx" ON "ConstructionProject"("lotId");

-- CreateIndex
CREATE UNIQUE INDEX "ConstructionQuote_number_key" ON "ConstructionQuote"("number");

-- CreateIndex
CREATE INDEX "ConstructionQuote_projectId_idx" ON "ConstructionQuote"("projectId");

-- CreateIndex
CREATE INDEX "ConstructionPhase_projectId_idx" ON "ConstructionPhase"("projectId");

-- CreateIndex
CREATE INDEX "ConstructionInstallment_dueDate_idx" ON "ConstructionInstallment"("dueDate");

-- CreateIndex
CREATE UNIQUE INDEX "ConstructionInstallment_projectId_index_key" ON "ConstructionInstallment"("projectId", "index");

-- CreateIndex
CREATE UNIQUE INDEX "ConstructionPayment_receiptNumber_key" ON "ConstructionPayment"("receiptNumber");

-- CreateIndex
CREATE INDEX "ConstructionPayment_projectId_idx" ON "ConstructionPayment"("projectId");

-- CreateIndex
CREATE INDEX "ConstructionPayment_paidAt_idx" ON "ConstructionPayment"("paidAt");

-- CreateIndex
CREATE INDEX "Expense_scope_idx" ON "Expense"("scope");

-- CreateIndex
CREATE INDEX "Expense_projectId_idx" ON "Expense"("projectId");

-- CreateIndex
CREATE INDEX "Expense_spentAt_idx" ON "Expense"("spentAt");

-- CreateIndex
CREATE INDEX "ConstructionUpdate_projectId_publishedAt_idx" ON "ConstructionUpdate"("projectId", "publishedAt");

-- CreateIndex
CREATE INDEX "ConstructionMedia_updateId_idx" ON "ConstructionMedia"("updateId");

-- CreateIndex
CREATE INDEX "Document_constructionProjectId_idx" ON "Document"("constructionProjectId");

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_constructionProjectId_fkey" FOREIGN KEY ("constructionProjectId") REFERENCES "ConstructionProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConstructionProject" ADD CONSTRAINT "ConstructionProject_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "Buyer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConstructionProject" ADD CONSTRAINT "ConstructionProject_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "Lot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConstructionProject" ADD CONSTRAINT "ConstructionProject_houseModelId_fkey" FOREIGN KEY ("houseModelId") REFERENCES "HouseModel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConstructionQuote" ADD CONSTRAINT "ConstructionQuote_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "ConstructionProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConstructionPhase" ADD CONSTRAINT "ConstructionPhase_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "ConstructionProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConstructionInstallment" ADD CONSTRAINT "ConstructionInstallment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "ConstructionProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConstructionPayment" ADD CONSTRAINT "ConstructionPayment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "ConstructionProject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConstructionPayment" ADD CONSTRAINT "ConstructionPayment_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "ConstructionProject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_phaseId_fkey" FOREIGN KEY ("phaseId") REFERENCES "ConstructionPhase"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConstructionUpdate" ADD CONSTRAINT "ConstructionUpdate_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "ConstructionProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConstructionUpdate" ADD CONSTRAINT "ConstructionUpdate_phaseId_fkey" FOREIGN KEY ("phaseId") REFERENCES "ConstructionPhase"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConstructionMedia" ADD CONSTRAINT "ConstructionMedia_updateId_fkey" FOREIGN KEY ("updateId") REFERENCES "ConstructionUpdate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
