-- Create RPC function to query users by username
-- This bypasses the schema cache issue
CREATE OR REPLACE FUNCTION public.get_user_by_username(p_username TEXT)
RETURNS TABLE (
  id UUID,
  username TEXT,
  password_hash TEXT,
  role_id INTEGER,
  is_active BOOLEAN,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
) AS $$
BEGIN
  RETURN QUERY
  SELECT ua.id, ua.username, ua.password_hash, ua.role_id, ua.is_active, ua.created_at, ua.updated_at
  FROM public.users_auth ua
  WHERE ua.username = p_username;
END;
$$ LANGUAGE plpgsql;
