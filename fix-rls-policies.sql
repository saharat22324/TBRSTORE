-- FIX RLS RECURSION ISSUES IN SUPABASE
-- This script fixes the infinite recursion in user profile policies

-- 1. Disable all policies on users table temporarily
ALTER TABLE "users" DISABLE ROW LEVEL SECURITY;

-- 2. Create simple, non-recursive policies
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;

-- Drop existing problematic policies
DROP POLICY IF EXISTS "users_select_own" ON "users";
DROP POLICY IF EXISTS "users_insert_own" ON "users";
DROP POLICY IF EXISTS "users_update_own" ON "users";
DROP POLICY IF EXISTS "users_delete_own" ON "users";

-- 3. Create NEW non-recursive policies
-- Users can read their own profile
CREATE POLICY "users_select_own"
  ON "users"
  FOR SELECT
  USING (auth.uid() = id);

-- Users can insert their own record
CREATE POLICY "users_insert_own"
  ON "users"
  FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "users_update_own"
  ON "users"
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Users can delete their own record
CREATE POLICY "users_delete_own"
  ON "users"
  FOR DELETE
  USING (auth.uid() = id);

-- 4. Allow admins to read all users
CREATE POLICY "users_select_admin"
  ON "users"
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM "roles" 
      WHERE "roles"."user_id" = auth.uid() 
      AND "roles"."role" = 'admin'
    )
  );

-- 5. Test policy for roles table (non-recursive)
DROP POLICY IF EXISTS "roles_select_own" ON "roles";

CREATE POLICY "roles_select_own"
  ON "roles"
  FOR SELECT
  USING (user_id = auth.uid());

-- Success message
SELECT 'RLS Policies fixed successfully!' as message;
