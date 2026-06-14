-- Enable Row-Level Security on all public tables.
-- The app uses Prisma with a direct postgres connection (superuser),
-- which bypasses RLS. This blocks Supabase PostgREST (anon key) access only.

ALTER TABLE "users"             ENABLE ROW LEVEL SECURITY;
ALTER TABLE "templates"         ENABLE ROW LEVEL SECURITY;
ALTER TABLE "generations"       ENABLE ROW LEVEL SECURITY;
ALTER TABLE "certificates"      ENABLE ROW LEVEL SECURITY;
ALTER TABLE "generation_errors" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "audit_logs"        ENABLE ROW LEVEL SECURITY;
