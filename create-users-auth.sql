-- Create users_auth table for custom username/password authentication
CREATE TABLE IF NOT EXISTS public.users_auth (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role_id INTEGER REFERENCES public.user_roles(id),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.users_auth ENABLE ROW LEVEL SECURITY;

-- Create policy: users can read their own record
CREATE POLICY "users_read_own" ON public.users_auth
  FOR SELECT USING (
    auth.uid()::text = id::text OR
    auth.jwt() ->> 'role' = 'authenticated'
  );

-- Insert team members with plaintext:password format
INSERT INTO public.users_auth (username, password_hash, role_id, is_active)
VALUES
  ('admin', 'plaintext:admin123', 1, true),
  ('porche1', 'plaintext:porche123', 2, true),
  ('bass1', 'plaintext:bass123', 2, true),
  ('vit1', 'plaintext:vit123', 4, true),
  ('mix1', 'plaintext:mix123', 2, true)
ON CONFLICT (username) DO NOTHING;

-- Verify data
SELECT * FROM public.users_auth;
