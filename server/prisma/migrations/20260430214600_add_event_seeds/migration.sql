-- CreateTable
CREATE TABLE "EventSeed" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "seedNum" INTEGER NOT NULL,

    CONSTRAINT "EventSeed_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EventSeed_eventId_userId_key" ON "EventSeed"("eventId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "EventSeed_eventId_seedNum_key" ON "EventSeed"("eventId", "seedNum");

-- AddForeignKey
ALTER TABLE "EventSeed" ADD CONSTRAINT "EventSeed_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventSeed" ADD CONSTRAINT "EventSeed_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
