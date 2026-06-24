
-- 1) schools visibility toggle
ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS is_visible boolean NOT NULL DEFAULT true;

-- 2) admin policies for schools
DROP POLICY IF EXISTS "Admins can update schools" ON public.schools;
CREATE POLICY "Admins can update schools" ON public.schools
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'coordinator'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'coordinator'));

DROP POLICY IF EXISTS "Admins can delete schools" ON public.schools;
CREATE POLICY "Admins can delete schools" ON public.schools
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 3) admin policies for user_roles
DROP POLICY IF EXISTS "Admins view all roles" ON public.user_roles;
CREATE POLICY "Admins view all roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins insert roles" ON public.user_roles;
CREATE POLICY "Admins insert roles" ON public.user_roles
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins delete roles" ON public.user_roles;
CREATE POLICY "Admins delete roles" ON public.user_roles
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 4) Bootstrap: allow a user to insert their own admin role IFF no admin exists yet
DROP POLICY IF EXISTS "Bootstrap first admin" ON public.user_roles;
CREATE POLICY "Bootstrap first admin" ON public.user_roles
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND role = 'admin'
    AND NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin')
  );

-- 5) admins can update profiles (e.g. assign school)
DROP POLICY IF EXISTS "Admins update profiles" ON public.profiles;
CREATE POLICY "Admins update profiles" ON public.profiles
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
