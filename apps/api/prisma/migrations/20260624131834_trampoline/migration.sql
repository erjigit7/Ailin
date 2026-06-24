-- CreateTable
CREATE TABLE "trampoline_tariffs" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price" DECIMAL(12,2) NOT NULL,
    "durationMin" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trampoline_tariffs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_trampoline_items" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "tariffId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "price" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_trampoline_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "order_trampoline_items_orderId_idx" ON "order_trampoline_items"("orderId");

-- AddForeignKey
ALTER TABLE "order_trampoline_items" ADD CONSTRAINT "order_trampoline_items_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_trampoline_items" ADD CONSTRAINT "order_trampoline_items_tariffId_fkey" FOREIGN KEY ("tariffId") REFERENCES "trampoline_tariffs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
