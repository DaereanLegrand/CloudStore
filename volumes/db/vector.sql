CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

ALTER TABLE products ADD COLUMN IF NOT EXISTS embedding vector(1024);

DROP INDEX IF EXISTS products_embedding_idx;
CREATE INDEX IF NOT EXISTS products_embedding_idx
  ON products USING hnsw (embedding vector_cosine_ops);

ALTER TABLE products ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (
    to_tsvector('spanish', coalesce(titulo, '') || ' ' || coalesce(descripcion, ''))
  ) STORED;

CREATE INDEX IF NOT EXISTS products_search_idx ON products USING GIN (search_vector);
CREATE INDEX IF NOT EXISTS products_titulo_trgm_idx ON products USING GIN (titulo gin_trgm_ops);

DROP FUNCTION IF EXISTS match_products CASCADE;
CREATE OR REPLACE FUNCTION match_products(
  query_embedding vector(1024),
  match_count int DEFAULT 20,
  match_threshold float DEFAULT 0.3
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
    AND 1 - (p.embedding <=> query_embedding) >= match_threshold
  ORDER BY p.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

DROP FUNCTION IF EXISTS hybrid_search CASCADE;
CREATE OR REPLACE FUNCTION hybrid_search(
  query_embedding vector(1024),
  text_query TEXT DEFAULT '',
  match_count INT DEFAULT 20,
  vector_threshold FLOAT DEFAULT 0.15,
  keyword_boost FLOAT DEFAULT 0.3
)
RETURNS TABLE(id UUID, vendedor_id UUID, titulo TEXT, descripcion TEXT,
              precio NUMERIC, stock INTEGER, categoria TEXT, imagen_url TEXT,
              created_at TIMESTAMPTZ, precio_promocion NUMERIC, similarity float)
LANGUAGE plpgsql AS $$
DECLARE
  tsq tsquery;
  has_text boolean;
BEGIN
  has_text := text_query IS NOT NULL AND text_query != '';
  IF has_text THEN
    BEGIN
      tsq := websearch_to_tsquery('spanish', text_query);
    EXCEPTION WHEN OTHERS THEN
      BEGIN
        tsq := plainto_tsquery('spanish', text_query);
      EXCEPTION WHEN OTHERS THEN
        tsq := NULL;
      END;
    END;
  END IF;

  RETURN QUERY
  WITH scored AS (
    SELECT p.id, p.vendedor_id, p.titulo, p.descripcion, p.precio, p.stock,
           p.categoria, p.imagen_url, p.created_at, p.precio_promocion,
           1 - (p.embedding <=> query_embedding) AS vec_sim,
           CASE
             WHEN has_text AND tsq IS NOT NULL AND tsq != ''::tsquery
             THEN GREATEST(ts_rank(p.search_vector, tsq), 0)
             ELSE 0
           END AS txt_sim
    FROM products p
    WHERE p.embedding IS NOT NULL
  )
  SELECT s.id, s.vendedor_id, s.titulo, s.descripcion, s.precio, s.stock,
         s.categoria, s.imagen_url, s.created_at, s.precio_promocion,
         CASE
           WHEN has_text AND txt_sim > 0
           THEN keyword_boost + s.vec_sim * (1 - keyword_boost)
           ELSE s.vec_sim
         END AS similarity
  FROM scored s
  WHERE s.vec_sim >= vector_threshold
  ORDER BY similarity DESC
  LIMIT match_count;
END;
$$;
