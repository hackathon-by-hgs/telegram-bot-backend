-- CreateTable
CREATE TABLE "SwiftyExAccount" (
    "userId" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "kycVerified" BOOLEAN NOT NULL DEFAULT false,
    "kycLevel" INTEGER NOT NULL DEFAULT 0,
    "referralCode" TEXT,
    "wallets" JSONB NOT NULL DEFAULT '[]',
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SwiftyExAccount_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "SwiftyExRate" (
    "asset" TEXT NOT NULL,
    "buyRate" DOUBLE PRECISION NOT NULL,
    "sellRate" DOUBLE PRECISION NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SwiftyExRate_pkey" PRIMARY KEY ("asset")
);

-- CreateIndex
CREATE UNIQUE INDEX "SwiftyExAccount_chatId_key" ON "SwiftyExAccount"("chatId");

-- AddForeignKey
ALTER TABLE "SwiftyExAccount" ADD CONSTRAINT "SwiftyExAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
