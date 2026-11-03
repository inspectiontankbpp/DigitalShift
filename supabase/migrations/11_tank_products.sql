-- Migration 11: master produk per nomor tangki
CREATE TABLE IF NOT EXISTS public.tank_products (
  no_tanki TEXT PRIMARY KEY,
  produk TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.tank_products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tank_products_select ON public.tank_products;
CREATE POLICY tank_products_select ON public.tank_products
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS tank_products_write ON public.tank_products;
CREATE POLICY tank_products_write ON public.tank_products
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = (select auth.uid()) AND profiles.role = 'supervisor'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = (select auth.uid()) AND profiles.role = 'supervisor'
    )
  );

GRANT SELECT ON public.tank_products TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.tank_products TO authenticated;

INSERT INTO public.tank_products (no_tanki, produk, sort_order) VALUES
  ('1', 'Pertamax', 1),
  ('2', 'Pertalite', 2),
  ('3', 'Pertamax', 3),
  ('4', 'Avtur', 4),
  ('5', 'Pertadex', 5),
  ('6', 'Pertamax', 6),
  ('7', 'Solar', 7),
  ('8', 'Avtur', 8),
  ('9', 'Pertadex', 9),
  ('10', 'Fame', 10),
  ('11', 'Pertalite', 11),
  ('12', 'Pertamax', 12),
  ('13', 'Solar', 13),
  ('14', 'Avtur', 14)
ON CONFLICT (no_tanki) DO NOTHING;
