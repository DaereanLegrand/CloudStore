CREATE TYPE user_role AS ENUM ('comprador', 'vendedor');

CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  email TEXT NOT NULL,
  rol user_role NOT NULL DEFAULT 'comprador',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read any profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert their own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendedor_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  descripcion TEXT DEFAULT '',
  precio NUMERIC(10,2) NOT NULL CHECK (precio > 0),
  stock INTEGER NOT NULL CHECK (stock >= 0),
  categoria TEXT NOT NULL,
  imagen_url TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read products"
  ON products FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Vendors can insert their own products"
  ON products FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = vendedor_id
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND rol = 'vendedor')
  );

CREATE POLICY "Vendors can update their own products"
  ON products FOR UPDATE
  TO authenticated
  USING (auth.uid() = vendedor_id);

CREATE POLICY "Vendors can delete their own products"
  ON products FOR DELETE
  TO authenticated
  USING (auth.uid() = vendedor_id);

CREATE TABLE cart_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comprador_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  cantidad INTEGER NOT NULL CHECK (cantidad > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(comprador_id, product_id)
);

ALTER TABLE cart_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Buyers can read their own cart"
  ON cart_items FOR SELECT
  TO authenticated
  USING (auth.uid() = comprador_id);

CREATE POLICY "Buyers can insert into their own cart"
  ON cart_items FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = comprador_id);

CREATE POLICY "Buyers can update their own cart"
  ON cart_items FOR UPDATE
  TO authenticated
  USING (auth.uid() = comprador_id);

CREATE POLICY "Buyers can delete from their own cart"
  ON cart_items FOR DELETE
  TO authenticated
  USING (auth.uid() = comprador_id);

CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comprador_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  total NUMERIC(10,2) NOT NULL,
  estado TEXT NOT NULL DEFAULT 'pagado',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Buyers can read their own orders"
  ON orders FOR SELECT
  TO authenticated
  USING (auth.uid() = comprador_id);

CREATE POLICY "Only edge function can create orders"
  ON orders FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = comprador_id);

CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL,
  titulo TEXT NOT NULL,
  precio NUMERIC(10,2) NOT NULL,
  cantidad INTEGER NOT NULL
);

ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Buyers can read their own order items"
  ON order_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM orders WHERE orders.id = order_items.order_id AND orders.comprador_id = auth.uid())
  );

CREATE POLICY "Only edge function can insert order items"
  ON order_items FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM orders WHERE orders.id = order_items.order_id AND orders.comprador_id = auth.uid())
  );

ALTER TABLE products ADD COLUMN IF NOT EXISTS precio_promocion NUMERIC(10,2) DEFAULT NULL;

INSERT INTO storage.buckets (id, name, public) VALUES ('productos', 'productos', true)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE recipes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  titulo TEXT NOT NULL,
  descripcion TEXT DEFAULT '',
  instrucciones JSONB NOT NULL DEFAULT '[]',
  categoria TEXT DEFAULT '',
  dificultad TEXT DEFAULT 'facil',
  tiempo_preparacion INTEGER DEFAULT 0,
  porciones INTEGER DEFAULT 1,
  calorias INTEGER DEFAULT 0,
  imagen_url TEXT DEFAULT '',
  url_origen TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read recipes"
  ON recipes FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Only service role can insert recipes"
  ON recipes FOR INSERT
  TO authenticated
  WITH CHECK (auth.role() = 'service_role');

CREATE TABLE recipe_ingredients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  ingredient_raw TEXT NOT NULL,
  cantidad_recipe NUMERIC(10,2) DEFAULT 1,
  unidad_recipe TEXT DEFAULT '',
  cantidad_producto NUMERIC(10,2) DEFAULT 1,
  es_opcional BOOLEAN DEFAULT FALSE,
  mapeado BOOLEAN DEFAULT FALSE,
  notas TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE recipe_ingredients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read recipe ingredients"
  ON recipe_ingredients FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Only service role can insert recipe ingredients"
  ON recipe_ingredients FOR INSERT
  TO authenticated
  WITH CHECK (auth.role() = 'service_role');
