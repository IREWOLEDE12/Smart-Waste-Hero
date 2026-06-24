
-- Roles enum and table
CREATE TYPE public.app_role AS ENUM ('admin', 'coordinator', 'teacher', 'student');

CREATE TABLE public.schools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  location TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.schools TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.schools TO authenticated;
GRANT ALL ON public.schools TO service_role;
ALTER TABLE public.schools ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Schools are viewable by everyone" ON public.schools FOR SELECT USING (true);
CREATE POLICY "Authenticated can insert schools" ON public.schools FOR INSERT TO authenticated WITH CHECK (true);

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  full_name TEXT,
  avatar_url TEXT,
  school_id UUID REFERENCES public.schools(id) ON DELETE SET NULL,
  points INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.profiles TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profiles viewable by everyone" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE TABLE public.waste_scans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  school_id UUID REFERENCES public.schools(id) ON DELETE SET NULL,
  image_url TEXT,
  category TEXT NOT NULL,
  subcategory TEXT,
  confidence NUMERIC(5,2) NOT NULL DEFAULT 0,
  recyclability_score INTEGER NOT NULL DEFAULT 0,
  environmental_impact_score INTEGER NOT NULL DEFAULT 0,
  carbon_reduction_kg NUMERIC(8,3) NOT NULL DEFAULT 0,
  disposal_recommendation TEXT,
  educational_insight TEXT,
  points_awarded INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.waste_scans TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.waste_scans TO authenticated;
GRANT ALL ON public.waste_scans TO service_role;
ALTER TABLE public.waste_scans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Scans viewable by everyone" ON public.waste_scans FOR SELECT USING (true);
CREATE POLICY "Users insert own scans" ON public.waste_scans FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own scans" ON public.waste_scans FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX idx_waste_scans_user ON public.waste_scans(user_id);
CREATE INDEX idx_waste_scans_school ON public.waste_scans(school_id);
CREATE INDEX idx_waste_scans_created ON public.waste_scans(created_at DESC);

-- Profile auto-create trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1)));
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'student');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Award points to profile after waste scan
CREATE OR REPLACE FUNCTION public.award_scan_points()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.profiles SET points = points + NEW.points_awarded, updated_at = now()
  WHERE id = NEW.user_id;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_award_scan_points
AFTER INSERT ON public.waste_scans
FOR EACH ROW EXECUTE FUNCTION public.award_scan_points();

-- Seed a couple of demo schools
INSERT INTO public.schools (name, location) VALUES
  ('Greenfield Academy', 'Nairobi, Kenya'),
  ('Coral Bay High', 'Mombasa, Kenya'),
  ('Mountain View School', 'Kigali, Rwanda')
ON CONFLICT DO NOTHING;
