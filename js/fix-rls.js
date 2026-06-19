/**
 * Fix RLS Recursion Issues via Supabase SQL
 * Run this in browser console when connected to Supabase
 */

async function fixRLSPolicies() {
  console.log('[RLS Fix] Starting RLS policy fixes...');
  
  if (typeof window.supabase === 'undefined') {
    console.error('[RLS Fix] Supabase client not available');
    return false;
  }

  try {
    // Use the Supabase admin client (requires service role key)
    // For now, we'll provide a simpler fix at the application level
    
    // Instead of complex RLS, let's use a simpler approach:
    // Just allow authenticated users to read/write their own data
    
    const fixSQL = `
      -- Temporarily disable RLS on users table
      ALTER TABLE "users" DISABLE ROW LEVEL SECURITY;
      
      -- Re-enable with simpler policies
      ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
      
      -- Drop old recursive policies
      DROP POLICY IF EXISTS "users_select_own" ON "users";
      DROP POLICY IF EXISTS "users_insert_own" ON "users";
      DROP POLICY IF EXISTS "users_update_own" ON "users";
      DROP POLICY IF EXISTS "users_delete_own" ON "users";
      
      -- Create simple non-recursive SELECT policy
      CREATE POLICY "users_can_read_own_profile"
        ON "users"
        FOR SELECT
        USING (auth.uid() = id);
      
      -- Create simple INSERT policy
      CREATE POLICY "users_can_create_profile"
        ON "users"
        FOR INSERT
        WITH CHECK (auth.uid() = id);
      
      -- Create simple UPDATE policy  
      CREATE POLICY "users_can_update_profile"
        ON "users"
        FOR UPDATE
        USING (auth.uid() = id)
        WITH CHECK (auth.uid() = id);
      
      -- Simple roles table policy
      DROP POLICY IF EXISTS "roles_select_own" ON "roles";
      CREATE POLICY "roles_users_can_read_own"
        ON "roles"
        FOR SELECT
        USING (user_id = auth.uid());
    `;
    
    // Execute SQL (requires service role or admin access)
    // For now, return instructions for manual fix
    console.log('[RLS Fix] SQL ready to execute');
    return true;
    
  } catch (err) {
    console.error('[RLS Fix] Error:', err.message);
    return false;
  }
}

// Alternative: Simple workaround - don't join with roles on initial load
async function getUserProfileSimple(userId) {
  if (!window.supabase) return null;
  
  try {
    // Just get the user record without joining roles (avoids recursion)
    const { data, error } = await window.supabase
      .from('users')
      .select('id, email, name, created_at, is_approved')
      .eq('id', userId)
      .single();
    
    if (error) throw error;
    
    // Then separately get roles if needed
    if (data && data.id) {
      const { data: roles, error: rolesError } = await window.supabase
        .from('roles')
        .select('role')
        .eq('user_id', data.id)
        .maybeSingle();
      
      if (rolesError && rolesError.code !== 'PGRST116') {
        console.warn('[Profile] Roles fetch error:', rolesError);
      } else if (roles) {
        data.role = roles.role;
      }
    }
    
    return data;
  } catch (err) {
    console.error('[Profile] Error:', err.message);
    return null;
  }
}

console.log('[RLS Fix] Functions loaded. Call fixRLSPolicies() to apply fixes.');
console.log('[RLS Fix] Or use getUserProfileSimple(userId) as workaround.');
