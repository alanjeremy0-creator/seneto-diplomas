-- CreateIndex
CREATE INDEX "certificates_generation_id_idx" ON "certificates"("generation_id");

-- CreateIndex
CREATE INDEX "certificates_status_idx" ON "certificates"("status");

-- CreateIndex
CREATE INDEX "certificates_verification_token_idx" ON "certificates"("verification_token");

-- CreateIndex
CREATE INDEX "certificates_folio_idx" ON "certificates"("folio");
