-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('superadmin', 'admin');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'admin',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_login_at" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "file_path" TEXT,
    "image_width_px" INTEGER,
    "image_height_px" INTEGER,
    "field_zones" JSONB,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "generations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "template_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "folio_prefix" TEXT NOT NULL DEFAULT 'SEN',
    "folio_year" INTEGER NOT NULL,
    "folio_counter" INTEGER NOT NULL DEFAULT 1,
    "total_count" INTEGER NOT NULL DEFAULT 0,
    "processed_count" INTEGER NOT NULL DEFAULT 0,
    "error_count" INTEGER NOT NULL DEFAULT 0,
    "zip_path" TEXT,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "generations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "certificates" (
    "id" TEXT NOT NULL,
    "folio" TEXT NOT NULL,
    "verification_token" TEXT NOT NULL,
    "generation_id" TEXT NOT NULL,
    "student_name" TEXT NOT NULL,
    "email" TEXT,
    "program" TEXT,
    "issued_date" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'active',
    "photo_path" TEXT,
    "diploma_pdf_path" TEXT,
    "diploma_png_path" TEXT,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "revocation_reason" TEXT,

    CONSTRAINT "certificates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "generation_errors" (
    "id" TEXT NOT NULL,
    "generation_id" TEXT NOT NULL,
    "student_name" TEXT,
    "row_number" INTEGER,
    "error_type" TEXT NOT NULL,
    "error_detail" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "generation_errors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "action" TEXT NOT NULL,
    "target_id" TEXT,
    "target_type" TEXT,
    "detail" JSONB,
    "ip" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "certificates_folio_key" ON "certificates"("folio");

-- CreateIndex
CREATE UNIQUE INDEX "certificates_verification_token_key" ON "certificates"("verification_token");

-- AddForeignKey
ALTER TABLE "generations" ADD CONSTRAINT "generations_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generations" ADD CONSTRAINT "generations_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_generation_id_fkey" FOREIGN KEY ("generation_id") REFERENCES "generations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generation_errors" ADD CONSTRAINT "generation_errors_generation_id_fkey" FOREIGN KEY ("generation_id") REFERENCES "generations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
