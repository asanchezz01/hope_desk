-- CreateTable
CREATE TABLE "user" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "email" VARCHAR(120) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "role" VARCHAR(20) NOT NULL,
    "is_superuser" BOOLEAN NOT NULL DEFAULT false,
    "must_change_password" BOOLEAN NOT NULL DEFAULT false,
    "reset_token_hash" VARCHAR(64),
    "reset_token_expires_at" TIMESTAMP(6),

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticket" (
    "id" SERIAL NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "description" TEXT NOT NULL,
    "status" VARCHAR(30) NOT NULL DEFAULT 'aberto',
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "client_id" INTEGER NOT NULL,
    "technician_id" INTEGER,
    "system_module_id" INTEGER,

    CONSTRAINT "ticket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity" (
    "id" SERIAL NOT NULL,
    "ticket_id" INTEGER NOT NULL,
    "notes" TEXT NOT NULL,
    "started_at" TIMESTAMP(6) NOT NULL,
    "ended_at" TIMESTAMP(6) NOT NULL,
    "created_by_id" INTEGER NOT NULL,

    CONSTRAINT "activity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_module" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "system_module_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_parameter" (
    "id" SERIAL NOT NULL,
    "key" VARCHAR(120) NOT NULL,
    "value" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "system_parameter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_record" (
    "id" SERIAL NOT NULL,
    "paid_at" DATE NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "paid_hours" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_record_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_token" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "jti" VARCHAR(64) NOT NULL,
    "replaced_by_jti" VARCHAR(64),
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "revoked_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_token_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE INDEX "user_role_idx" ON "user"("role");

-- CreateIndex
CREATE INDEX "user_reset_token_hash_idx" ON "user"("reset_token_hash");

-- CreateIndex
CREATE INDEX "ticket_client_id_idx" ON "ticket"("client_id");

-- CreateIndex
CREATE INDEX "ticket_technician_id_idx" ON "ticket"("technician_id");

-- CreateIndex
CREATE INDEX "ticket_system_module_id_idx" ON "ticket"("system_module_id");

-- CreateIndex
CREATE INDEX "ticket_status_idx" ON "ticket"("status");

-- CreateIndex
CREATE INDEX "ticket_created_at_idx" ON "ticket"("created_at");

-- CreateIndex
CREATE INDEX "activity_ticket_id_idx" ON "activity"("ticket_id");

-- CreateIndex
CREATE INDEX "activity_created_by_id_idx" ON "activity"("created_by_id");

-- CreateIndex
CREATE INDEX "activity_created_by_id_started_at_ended_at_idx" ON "activity"("created_by_id", "started_at", "ended_at");

-- CreateIndex
CREATE INDEX "activity_started_at_idx" ON "activity"("started_at");

-- CreateIndex
CREATE INDEX "activity_ended_at_idx" ON "activity"("ended_at");

-- CreateIndex
CREATE UNIQUE INDEX "system_module_name_key" ON "system_module"("name");

-- CreateIndex
CREATE INDEX "system_module_is_active_idx" ON "system_module"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "system_parameter_key_key" ON "system_parameter"("key");

-- CreateIndex
CREATE INDEX "payment_record_paid_at_idx" ON "payment_record"("paid_at");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_token_jti_key" ON "refresh_token"("jti");

-- CreateIndex
CREATE INDEX "refresh_token_user_id_idx" ON "refresh_token"("user_id");

-- CreateIndex
CREATE INDEX "refresh_token_expires_at_idx" ON "refresh_token"("expires_at");

-- AddForeignKey
ALTER TABLE "ticket" ADD CONSTRAINT "ticket_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket" ADD CONSTRAINT "ticket_technician_id_fkey" FOREIGN KEY ("technician_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket" ADD CONSTRAINT "ticket_system_module_id_fkey" FOREIGN KEY ("system_module_id") REFERENCES "system_module"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity" ADD CONSTRAINT "activity_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity" ADD CONSTRAINT "activity_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_token" ADD CONSTRAINT "refresh_token_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
