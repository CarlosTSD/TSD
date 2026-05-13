-- ─── Profiles ──────────────────────────────────────────────────────────────────
CREATE TABLE profiles (
  id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name       TEXT,
  role       TEXT NOT NULL DEFAULT 'editor'
               CHECK (role IN ('admin', 'editor', 'viewer')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-cria profile quando usuário se registra
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.profiles (id, name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'name');
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ─── Projects ───────────────────────────────────────────────────────────────────
CREATE TABLE projects (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug       TEXT UNIQUE NOT NULL,
  name       TEXT NOT NULL,
  owner_id   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  is_public  BOOLEAN NOT NULL DEFAULT TRUE,
  status     TEXT NOT NULL DEFAULT 'draft'
               CHECK (status IN ('draft', 'published', 'archived')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Project Config (1:1) ───────────────────────────────────────────────────────
CREATE TABLE project_config (
  project_id         UUID PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,

  -- Hero
  etapa_label        TEXT DEFAULT 'ETAPA 01',
  hero_title         TEXT,
  hero_descricao     TEXT,
  hero_role          TEXT,
  hero_date          TEXT,
  hero_version       TEXT,
  hero_bg            TEXT DEFAULT '#0015cf',
  hero_banner_filter BOOLEAN DEFAULT FALSE,
  hero_image_path    TEXT,

  -- Footer
  footer_left        TEXT DEFAULT 'TSSD',
  footer_center      TEXT,
  footer_right       TEXT DEFAULT '2026',
  footer_studio      TEXT DEFAULT 'TRESSDE',
  footer_heading     TEXT DEFAULT 'WE CREATE\nTHE\nIMPOSSIBLE.',
  footer_sub         TEXT,

  updated_at         TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Blocks ─────────────────────────────────────────────────────────────────────
CREATE TABLE blocks (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  position   SMALLINT NOT NULL DEFAULT 0,
  title      TEXT,
  subtitle   TEXT,
  tag_a      TEXT,
  tag_b      TEXT,
  about      TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX blocks_project_position_idx ON blocks (project_id, position);

-- ─── Media ──────────────────────────────────────────────────────────────────────
CREATE TABLE media (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  block_id        UUID NOT NULL REFERENCES blocks(id) ON DELETE CASCADE,
  project_id      UUID NOT NULL REFERENCES projects(id),
  position        SMALLINT NOT NULL DEFAULT 0,
  type            TEXT NOT NULL CHECK (type IN ('image', 'video')),
  aspect_ratio    TEXT NOT NULL DEFAULT '16/9',

  -- Imagens -> Supabase Storage
  storage_path    TEXT,

  -- Videos -> MUX
  mux_upload_id   TEXT,
  mux_asset_id    TEXT,
  mux_playback_id TEXT,
  mux_status      TEXT DEFAULT 'preparing'
                    CHECK (mux_status IN ('preparing', 'ready', 'errored')),
  duration_sec    NUMERIC(8,2),
  thumbnail_time  NUMERIC(5,2) DEFAULT 0,

  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX media_block_position_idx ON media (block_id, position);
CREATE INDEX media_mux_asset_idx      ON media (mux_asset_id);

-- ─── Feedback ───────────────────────────────────────────────────────────────────
CREATE TABLE feedback (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  media_id     UUID NOT NULL REFERENCES media(id) ON DELETE CASCADE,
  project_id   UUID NOT NULL REFERENCES projects(id),
  author_name  TEXT,
  author_email TEXT,
  content      TEXT NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX feedback_media_idx   ON feedback (media_id);
CREATE INDEX feedback_project_idx ON feedback (project_id);

-- ─── updated_at automatico ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_project_config_updated_at
  BEFORE UPDATE ON project_config
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_blocks_updated_at
  BEFORE UPDATE ON blocks
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_media_updated_at
  BEFORE UPDATE ON media
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─── RLS ────────────────────────────────────────────────────────────────────────
ALTER TABLE profiles       ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects       ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE blocks         ENABLE ROW LEVEL SECURITY;
ALTER TABLE media          ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback       ENABLE ROW LEVEL SECURITY;

-- profiles: cada um ve/edita o proprio
CREATE POLICY "profiles: self read"   ON profiles FOR SELECT USING (id = auth.uid());
CREATE POLICY "profiles: self update" ON profiles FOR UPDATE USING (id = auth.uid());

-- projects: publico se is_public, owner gerencia tudo
CREATE POLICY "projects: public read"  ON projects FOR SELECT
  USING (is_public = TRUE OR owner_id = auth.uid());
CREATE POLICY "projects: owner insert" ON projects FOR INSERT
  WITH CHECK (owner_id = auth.uid());
CREATE POLICY "projects: owner update" ON projects FOR UPDATE
  USING (owner_id = auth.uid());
CREATE POLICY "projects: owner delete" ON projects FOR DELETE
  USING (owner_id = auth.uid());

-- project_config: segue visibilidade do projeto
CREATE POLICY "config: read" ON project_config FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM projects p
    WHERE p.id = project_id AND (p.is_public OR p.owner_id = auth.uid())
  ));
CREATE POLICY "config: owner write" ON project_config FOR ALL
  USING (EXISTS (
    SELECT 1 FROM projects p
    WHERE p.id = project_id AND p.owner_id = auth.uid()
  ));

-- blocks: segue visibilidade do projeto
CREATE POLICY "blocks: read" ON blocks FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM projects p
    WHERE p.id = project_id AND (p.is_public OR p.owner_id = auth.uid())
  ));
CREATE POLICY "blocks: owner write" ON blocks FOR ALL
  USING (EXISTS (
    SELECT 1 FROM projects p
    WHERE p.id = project_id AND p.owner_id = auth.uid()
  ));

-- media: segue visibilidade do projeto
CREATE POLICY "media: read" ON media FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM projects p
    WHERE p.id = project_id AND (p.is_public OR p.owner_id = auth.uid())
  ));
CREATE POLICY "media: owner write" ON media FOR ALL
  USING (EXISTS (
    SELECT 1 FROM projects p
    WHERE p.id = project_id AND p.owner_id = auth.uid()
  ));

-- feedback: qualquer um insere, owner le tudo
CREATE POLICY "feedback: insert anon" ON feedback FOR INSERT WITH CHECK (TRUE);
CREATE POLICY "feedback: owner read"  ON feedback FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM projects p
    WHERE p.id = project_id AND p.owner_id = auth.uid()
  ));

-- ─── Storage bucket ─────────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('project-images', 'project-images', TRUE)
ON CONFLICT DO NOTHING;

CREATE POLICY "images: public read" ON storage.objects FOR SELECT
  USING (bucket_id = 'project-images');
CREATE POLICY "images: auth upload" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'project-images' AND auth.role() = 'authenticated');
CREATE POLICY "images: owner delete" ON storage.objects FOR DELETE
  USING (bucket_id = 'project-images' AND auth.uid()::TEXT = (storage.foldername(name))[1]);
