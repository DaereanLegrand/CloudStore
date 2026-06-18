CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE products ADD COLUMN IF NOT EXISTS embedding vector(768);

CREATE INDEX IF NOT EXISTS products_embedding_idx
  ON products USING hnsw (embedding vector_cosine_ops);

CREATE OR REPLACE FUNCTION match_products(
  query_embedding vector(768),
  match_count int DEFAULT 20
)
RETURNS TABLE(id UUID, vendedor_id UUID, titulo TEXT, descripcion TEXT,
              precio NUMERIC, stock INTEGER, categoria TEXT, imagen_url TEXT,
              created_at TIMESTAMPTZ, precio_promocion NUMERIC, similarity float)
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT p.id, p.vendedor_id, p.titulo, p.descripcion, p.precio, p.stock,
         p.categoria, p.imagen_url, p.created_at, p.precio_promocion,
         1 - (p.embedding <=> query_embedding) AS similarity
  FROM products p
  WHERE p.embedding IS NOT NULL
  ORDER BY p.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
