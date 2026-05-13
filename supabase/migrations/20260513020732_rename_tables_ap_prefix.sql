-- Drop tudo do schema anterior (banco vazio, sem dados)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS trg_projects_updated_at ON projects;
DROP TRIGGER IF EXISTS trg_project_config_updated_at ON project_config;
DROP TRIGGER IF EXISTS trg_blocks_updated_at ON blocks;
DROP TRIGGER IF EXISTS trg_media_updated_at ON media;

DROP FUNCTION IF EXISTS handle_new_user();
DROP FUNCTION IF EXISTS set_updated_at();

DROP TABLE IF EXISTS feedback       CASCADE;
DROP TABLE IF EXISTS media          CASCADE;
DROP TABLE IF EXISTS blocks         CASCADE;
DROP TABLE IF EXISTS project_config CASCADE;
DROP TABLE IF EXISTS projects       CASCADE;
DROP TABLE IF EXISTS profiles       CASCADE;

-- ─── ap_profiles ────────────────────────────────────────────────────────────────
CREATE TABLE ap_profiles (
  id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name       TEXT,
  role       TEXT NOT NULL DEFAULT 'editor'
               CHECK (role IN ('admin', 'editor', 'viewer')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.ap_profiles (id, name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'name');
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ─── ap_projects ────────────────────────────────────────────────────────────────
CREATE TABLE ap_projects (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug       TEXT UNIQUE NOT NULL,
  name       TEXT NOT NULL,
  owner_id   UUID NOT NULL REFERENCES ap_profiles(id) ON DELETE CASCADE,
  is_public  BOOLEAN NOT NULL DEFAULT TRUE,
  status     TEXT NOT NULL DEFAULT 'draft'
               CHECK (status IN ('draft', 'published', 'archived')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── ap_project_config ──────────────────────────────────────────────────────────
CREATE TABLE ap_project_config (
  project_id         UUID PRIMARY KEY REFERENCES ap_projects(id) ON DELETE CASCADE,

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

-- ─── ap_blocks ──────────────────────────────────────────────────────────────────
CREATE TABLE ap_blocks (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES ap_projects(id) ON DELETE CASCADE,
  position   SMALLINT NOT NULL DEFAULT 0,
  title      TEXT,
  subtitle   TEXT,
  tag_a      TEXT,
  tag_b      TEXT,
  about      TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX ap_blocks_project_position_idx ON ap_blocks (project_id, position);

-- ─── ap_media ───────────────────────────────────────────────────────────────────
CREATE TABLE ap_media (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  block_id        UUID NOT NULL REFERENCES ap_blocks(id) ON DELETE CASCADE,
  project_id      UUID NOT NULL REFERENCES ap_projects(id),
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

CREATE INDEX ap_media_block_position_idx ON ap_media (block_id, position);
CREATE INDEX ap_media_mux_asset_idx      ON ap_media (mux_asset_id);

-- ─── ap_feedback ────────────────────────────────────────────────────────────────
CREATE TABLE ap_feedback (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  media_id     UUID NOT NULL REFERENCES ap_media(id) ON DELETE CASCADE,
  project_id   UUID NOT NULL REFERENCES ap_projects(id),
  author_name  TEXT,
  author_email TEXT,
  content      TEXT NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX ap_feedback_media_idx   ON ap_feedback (media_id);
CREATE INDEX ap_feedback_project_idx ON ap_feedback (project_id);

-- ─── updated_at automatico ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_ap_projects_updated_at
  BEFORE UPDATE ON ap_projects
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_ap_project_config_updated_at
  BEFORE UPDATE ON ap_project_config
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_ap_blocks_updated_at
  BEFORE UPDATE ON ap_blocks
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_ap_media_updated_at
  BEFORE UPDATE ON ap_media
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─── RLS ────────────────────────────────────────────────────────────────────────
ALTER TABLE ap_profiles       ENABLE ROW LEVEL SECURITY;
ALTER TABLE ap_projects       ENABLE ROW LEVEL SECURITY;
ALTER TABLE ap_project_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE ap_blocks         ENABLE ROW LEVEL SECURITY;
ALTER TABLE ap_media          ENABLE ROW LEVEL SECURITY;
ALTER TABLE ap_feedback       ENABLE ROW LEVEL SECURITY;

-- ap_profiles
CREATE POLICY "ap_profiles: self read"   ON ap_profiles FOR SELECT USING (id = auth.uid());
CREATE POLICY "ap_profiles: self update" ON ap_profiles FOR UPDATE USING (id = auth.uid());

-- ap_projects
CREATE POLICY "ap_projects: public read"  ON ap_projects FOR SELECT
  USING (is_public = TRUE OR owner_id = auth.uid());
CREATE POLICY "ap_projects: owner insert" ON ap_projects FOR INSERT
  WITH CHECK (owner_id = auth.uid());
CREATE POLICY "ap_projects: owner update" ON ap_projects FOR UPDATE
  USING (owner_id = auth.uid());
CREATE POLICY "ap_projects: owner delete" ON ap_projects FOR DELETE
  USING (owner_id = auth.uid());

-- ap_project_config
CREATE POLICY "ap_config: read" ON ap_project_config FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM ap_projects p
    WHERE p.id = project_id AND (p.is_public OR p.owner_id = auth.uid())
  ));
CREATE POLICY "ap_config: owner write" ON ap_project_config FOR ALL
  USING (EXISTS (
    SELECT 1 FROM ap_projects p
    WHERE p.id = project_id AND p.owner_id = auth.uid()
  ));

-- ap_blocks
CREATE POLICY "ap_blocks: read" ON ap_blocks FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM ap_projects p
    WHERE p.id = project_id AND (p.is_public OR p.owner_id = auth.uid())
  ));
CREATE POLICY "ap_blocks: owner write" ON ap_blocks FOR ALL
  USING (EXISTS (
    SELECT 1 FROM ap_projects p
    WHERE p.id = project_id AND p.owner_id = auth.uid()
  ));

-- ap_media
CREATE POLICY "ap_media: read" ON ap_media FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM ap_projects p
    WHERE p.id = project_id AND (p.is_public OR p.owner_id = auth.uid())
  ));
CREATE POLICY "ap_media: owner write" ON ap_media FOR ALL
  USING (EXISTS (
    SELECT 1 FROM ap_projects p
    WHERE p.id = project_id AND p.owner_id = auth.uid()
  ));

-- ap_feedback
CREATE POLICY "ap_feedback: insert anon" ON ap_feedback FOR INSERT WITH CHECK (TRUE);
CREATE POLICY "ap_feedback: owner read"  ON ap_feedback FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM ap_projects p
    WHERE p.id = project_id AND p.owner_id = auth.uid()
  ));

-- ─── Storage bucket (sem prefixo — nome de bucket e livre) ───────────────────────
DROP POLICY IF EXISTS "images: public read"  ON storage.objects;
DROP POLICY IF EXISTS "images: auth upload"  ON storage.objects;
DROP POLICY IF EXISTS "images: owner delete" ON storage.objects;

INSERT INTO storage.buckets (id, name, public)
VALUES ('project-images', 'project-images', TRUE)
ON CONFLICT DO NOTHING;

CREATE POLICY "images: public read" ON storage.objects FOR SELECT
  USING (bucket_id = 'project-images');
CREATE POLICY "images: auth upload" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'project-images' AND auth.role() = 'authenticated');
CREATE POLICY "images: owner delete" ON storage.objects FOR DELETE
  USING (bucket_id = 'project-images' AND auth.uid()::TEXT = (storage.foldername(name))[1]);
