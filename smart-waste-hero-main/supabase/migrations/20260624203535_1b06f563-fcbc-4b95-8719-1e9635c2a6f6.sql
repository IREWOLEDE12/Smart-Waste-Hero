
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.award_scan_points() FROM PUBLIC, anon, authenticated;

DROP POLICY IF EXISTS "Authenticated can insert schools" ON public.schools;
CREATE POLICY "Admins can insert schools" ON public.schools FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'coordinator'));
