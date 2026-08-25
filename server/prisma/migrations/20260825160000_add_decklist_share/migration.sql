-- CreateTable
CREATE TABLE "DecklistShare" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "contentsHash" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdById" TEXT,
    "decklistId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DecklistShare_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DecklistShare_token_key" ON "DecklistShare"("token");

-- CreateIndex
CREATE UNIQUE INDEX "DecklistShare_createdById_contentsHash_key" ON "DecklistShare"("createdById", "contentsHash");

-- AddForeignKey
ALTER TABLE "DecklistShare" ADD CONSTRAINT "DecklistShare_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DecklistShare" ADD CONSTRAINT "DecklistShare_decklistId_fkey" FOREIGN KEY ("decklistId") REFERENCES "Decklist"("id") ON DELETE SET NULL ON UPDATE CASCADE;
