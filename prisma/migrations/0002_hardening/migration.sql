-- AlterTable
ALTER TABLE "Message" ADD COLUMN "clientKey" TEXT;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_AiProvider" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "apiKey" TEXT NOT NULL,
    "baseUrl" TEXT NOT NULL DEFAULT '',
    "model" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isGlobal" BOOLEAN NOT NULL DEFAULT false,
    "lastTestedAt" DATETIME,
    "lastTestOk" BOOLEAN,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AiProvider_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_AiProvider" ("apiKey", "baseUrl", "createdAt", "id", "isActive", "isGlobal", "lastTestOk", "lastTestedAt", "model", "name", "tenantId", "type", "updatedAt") SELECT "apiKey", "baseUrl", "createdAt", "id", "isActive", "isGlobal", "lastTestOk", "lastTestedAt", "model", "name", "tenantId", "type", "updatedAt" FROM "AiProvider";
DROP TABLE "AiProvider";
ALTER TABLE "new_AiProvider" RENAME TO "AiProvider";
CREATE INDEX "AiProvider_tenantId_idx" ON "AiProvider"("tenantId");
CREATE INDEX "AiProvider_type_idx" ON "AiProvider"("type");
CREATE INDEX "AiProvider_isGlobal_idx" ON "AiProvider"("isGlobal");
CREATE TABLE "new_Booking" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "leadId" TEXT,
    "conversationId" TEXT,
    "type" TEXT NOT NULL,
    "payloadJson" TEXT NOT NULL DEFAULT '{}',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "scheduledAt" DATETIME,
    "dedupeKey" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Booking_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Booking_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Booking_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Booking" ("conversationId", "createdAt", "id", "leadId", "payloadJson", "scheduledAt", "status", "tenantId", "type") SELECT "conversationId", "createdAt", "id", "leadId", "payloadJson", "scheduledAt", "status", "tenantId", "type" FROM "Booking";
DROP TABLE "Booking";
ALTER TABLE "new_Booking" RENAME TO "Booking";
CREATE UNIQUE INDEX "Booking_dedupeKey_key" ON "Booking"("dedupeKey");
CREATE INDEX "Booking_tenantId_idx" ON "Booking"("tenantId");
CREATE INDEX "Booking_status_idx" ON "Booking"("status");
CREATE INDEX "Booking_conversationId_type_status_idx" ON "Booking"("conversationId", "type", "status");
CREATE INDEX "Booking_tenantId_createdAt_idx" ON "Booking"("tenantId", "createdAt");
CREATE TABLE "new_InternalLead" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "conversationId" TEXT,
    "endUserName" TEXT NOT NULL,
    "signal" TEXT NOT NULL,
    "score" INTEGER NOT NULL DEFAULT 50,
    "status" TEXT NOT NULL DEFAULT 'new',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InternalLead_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "InternalLead_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_InternalLead" ("conversationId", "createdAt", "endUserName", "id", "score", "signal", "status", "tenantId") SELECT "conversationId", "createdAt", "endUserName", "id", "score", "signal", "status", "tenantId" FROM "InternalLead";
DROP TABLE "InternalLead";
ALTER TABLE "new_InternalLead" RENAME TO "InternalLead";
CREATE INDEX "InternalLead_tenantId_idx" ON "InternalLead"("tenantId");
CREATE INDEX "InternalLead_status_idx" ON "InternalLead"("status");
CREATE INDEX "InternalLead_conversationId_idx" ON "InternalLead"("conversationId");
CREATE UNIQUE INDEX "InternalLead_tenantId_conversationId_key" ON "InternalLead"("tenantId", "conversationId");
CREATE TABLE "new_Invoice" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "subtotal" INTEGER NOT NULL DEFAULT 0,
    "tax" INTEGER NOT NULL DEFAULT 0,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'IRT',
    "usdtRate" REAL,
    "usdtAmount" REAL,
    "billingCycle" TEXT NOT NULL DEFAULT 'monthly',
    "months" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "paymentRef" TEXT NOT NULL DEFAULT '',
    "paidAt" DATETIME,
    "periodStart" DATETIME NOT NULL,
    "periodEnd" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Invoice_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Invoice_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Invoice" ("amount", "createdAt", "id", "periodEnd", "periodStart", "planId", "status", "tenantId") SELECT "amount", "createdAt", "id", "periodEnd", "periodStart", "planId", "status", "tenantId" FROM "Invoice";
DROP TABLE "Invoice";
ALTER TABLE "new_Invoice" RENAME TO "Invoice";
CREATE INDEX "Invoice_tenantId_idx" ON "Invoice"("tenantId");
CREATE INDEX "Invoice_tenantId_status_idx" ON "Invoice"("tenantId", "status");
CREATE INDEX "Invoice_createdAt_idx" ON "Invoice"("createdAt");
CREATE TABLE "new_ProcessedEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "platform" TEXT NOT NULL,
    "eventKey" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "replyText" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProcessedEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_ProcessedEvent" ("createdAt", "eventKey", "id", "platform", "tenantId") SELECT "createdAt", "eventKey", "id", "platform", "tenantId" FROM "ProcessedEvent";
DROP TABLE "ProcessedEvent";
ALTER TABLE "new_ProcessedEvent" RENAME TO "ProcessedEvent";
CREATE INDEX "ProcessedEvent_tenantId_idx" ON "ProcessedEvent"("tenantId");
CREATE INDEX "ProcessedEvent_createdAt_idx" ON "ProcessedEvent"("createdAt");
CREATE UNIQUE INDEX "ProcessedEvent_tenantId_platform_eventKey_key" ON "ProcessedEvent"("tenantId", "platform", "eventKey");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "Lead_tenantId_status_createdAt_idx" ON "Lead"("tenantId", "status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Message_conversationId_clientKey_key" ON "Message"("conversationId", "clientKey");

