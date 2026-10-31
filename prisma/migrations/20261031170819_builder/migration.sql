-- CreateEnum
CREATE TYPE "BuildSlot" AS ENUM ('CPU', 'MOTHERBOARD', 'MEMORY', 'STORAGE', 'STORAGE_2', 'GPU', 'CASE', 'PSU', 'COOLER');

-- AlterEnum
ALTER TYPE "OrderStatus" ADD VALUE 'ASSEMBLING';

-- AlterTable
ALTER TABLE "OrderLine" ADD COLUMN     "buildGroup" TEXT,
ADD COLUMN     "slot" "BuildSlot";

-- CreateTable
CREATE TABLE "Build" (
    "id" TEXT NOT NULL,
    "shareId" TEXT NOT NULL,
    "editToken" TEXT NOT NULL,
    "location" "LocationCode" NOT NULL DEFAULT 'TOR',
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "title" JSONB,
    "description" JSONB,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Build_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BuildItem" (
    "buildId" TEXT NOT NULL,
    "slot" "BuildSlot" NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "BuildItem_pkey" PRIMARY KEY ("buildId","slot")
);

-- CreateTable
CREATE TABLE "CartBuild" (
    "id" TEXT NOT NULL,
    "cartId" TEXT NOT NULL,
    "items" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CartBuild_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Build_shareId_key" ON "Build"("shareId");

-- CreateIndex
CREATE UNIQUE INDEX "Build_editToken_key" ON "Build"("editToken");

-- AddForeignKey
ALTER TABLE "BuildItem" ADD CONSTRAINT "BuildItem_buildId_fkey" FOREIGN KEY ("buildId") REFERENCES "Build"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuildItem" ADD CONSTRAINT "BuildItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CartBuild" ADD CONSTRAINT "CartBuild_cartId_fkey" FOREIGN KEY ("cartId") REFERENCES "Cart"("id") ON DELETE CASCADE ON UPDATE CASCADE;
