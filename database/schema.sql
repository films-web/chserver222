CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "clients" (
    "id" SERIAL NOT NULL,
    "hwid" TEXT NOT NULL,
    "guid" TEXT NOT NULL,
    "signature" TEXT NOT NULL,
    "currentName" TEXT, 
    "lastSeen" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "custom_guids" (
    "id" SERIAL NOT NULL,
    "original_guid" TEXT NOT NULL UNIQUE,
    "custom_guid" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "custom_guids_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "names_history" (
    "id" SERIAL NOT NULL,
    "clientId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "server" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "names_history_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "names_history_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "Fairshot" (
    "id" SERIAL NOT NULL,
    "clientId" INTEGER NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "server" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Fairshot_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Fairshot_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "whitelists" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "whitelists_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Payload" (
    "id" SERIAL NOT NULL,
    "url" TEXT NOT NULL,
    "fileHash" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "version" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Payload_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "users_username_key" ON "users"("username");
CREATE UNIQUE INDEX "clients_hwid_key" ON "clients"("hwid");
CREATE UNIQUE INDEX "clients_guid_key" ON "clients"("guid");
CREATE UNIQUE INDEX "whitelists_hash_key" ON "whitelists"("hash");
CREATE UNIQUE INDEX "Payload_fileHash_key" ON "Payload"("fileHash");

CREATE INDEX "clients_guid_idx" ON "clients"("guid");
CREATE INDEX "clients_hwid_idx" ON "clients"("hwid");
CREATE INDEX "names_history_clientId_idx" ON "names_history"("clientId");
CREATE INDEX "names_history_name_idx" ON "names_history"("name");
CREATE INDEX "Fairshot_clientId_idx" ON "Fairshot"("clientId");
CREATE INDEX "Fairshot_server_idx" ON "Fairshot"("server");
CREATE INDEX "Payload_isActive_idx" ON "Payload"("isActive");