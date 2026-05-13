import { createClient } from '@supabase/supabase-js'

export function generateUUID() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16)
  })
}

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)

// ─── DB → cfg ────────────────────────────────────────────────────────────────
export function dbToCfg(config, blocks, media) {
  return {
    etapaLabel:       config.etapa_label       ?? 'ETAPA 01',
    heroTitle:        config.hero_title        ?? '',
    heroDescricao:    config.hero_descricao    ?? '',
    heroRole:         config.hero_role         ?? '',
    heroDate:         config.hero_date         ?? '',
    heroVersion:      config.hero_version      ?? '',
    heroBg:           config.hero_bg           ?? '#0015cf',
    heroBannerFilter: config.hero_banner_filter ?? false,
    heroImage:        config.hero_image_path    ?? null,
    footerLeft:       config.footer_left        ?? 'TSSD',
    footerCenter:     config.footer_center      ?? '',
    footerRight:      config.footer_right       ?? '2026',
    footerStudio:     config.footer_studio      ?? 'TRESSDE',
    footerHeading:    config.footer_heading     ?? 'WE CREATE\nTHE\nIMPOSSIBLE.',
    footerSub:        config.footer_sub         ?? '',
    blocks: (blocks || []).map(b => ({
      id:       b.id,
      title:    b.title    ?? '',
      subtitle: b.subtitle ?? '',
      tagA:     b.tag_a    ?? '',
      tagB:     b.tag_b    ?? '',
      about:    b.about    ?? '',
      images: (media || [])
        .filter(m => m.block_id === b.id)
        .sort((a, bm) => a.position - bm.position)
        .map(m => ({
          src:           m.storage_path,
          ar:            m.aspect_ratio || '16/9',
          type:          m.type || 'image',
          muxPlaybackId: m.mux_playback_id ?? null,
        })),
    })),
  }
}

// ─── Fetch project by slug (viewer público) ──────────────────────────────────
export async function fetchProjectBySlug(slug) {
  const { data: project } = await supabase
    .from('ap_projects')
    .select('*')
    .eq('slug', slug)
    .eq('is_public', true)
    .maybeSingle()

  if (!project) return null

  const [{ data: config }, { data: blocks }] = await Promise.all([
    supabase.from('ap_project_config').select('*').eq('project_id', project.id).maybeSingle(),
    supabase.from('ap_blocks').select('*').eq('project_id', project.id).order('position'),
  ])

  const blockIds = (blocks || []).map(b => b.id)
  const { data: media } = blockIds.length
    ? await supabase.from('ap_media').select('*').in('block_id', blockIds).order('position')
    : { data: [] }

  return dbToCfg(config || {}, blocks || [], media || [])
}

// ─── Fetch lista de projetos do usuário (admin) ───────────────────────────────
export async function fetchMyProjects(userId) {
  const { data } = await supabase
    .from('ap_projects')
    .select('id, slug, name, status, updated_at')
    .eq('owner_id', userId)
    .order('updated_at', { ascending: false })
  return (data || []).map(p => ({ id: p.id, slug: p.slug, name: p.name, savedAt: p.updated_at }))
}

// ─── Fetch projeto completo por ID (admin edição) ─────────────────────────────
export async function fetchProjectById(projectId) {
  const [{ data: project }, { data: config }, { data: blocks }] = await Promise.all([
    supabase.from('ap_projects').select('*').eq('id', projectId).maybeSingle(),
    supabase.from('ap_project_config').select('*').eq('project_id', projectId).maybeSingle(),
    supabase.from('ap_blocks').select('*').eq('project_id', projectId).order('position'),
  ])

  if (!project) return null

  const blockIds = (blocks || []).map(b => b.id)
  const { data: media } = blockIds.length
    ? await supabase.from('ap_media').select('*').in('block_id', blockIds).order('position')
    : { data: [] }

  return dbToCfg(config || {}, blocks || [], media || [])
}

// ─── Salvar projeto (admin) ───────────────────────────────────────────────────
export async function saveProject({ id, slug, name, ownerId, cfg }) {
  // 1. Upsert projeto
  const { error: pe } = await supabase.from('ap_projects').upsert(
    { id, slug, name, owner_id: ownerId, is_public: true, status: 'published' },
    { onConflict: 'id' }
  )
  if (pe) throw new Error(pe.message)

  // 2. Upsert config
  const { error: ce } = await supabase.from('ap_project_config').upsert({
    project_id:         id,
    etapa_label:        cfg.etapaLabel        ?? 'ETAPA 01',
    hero_title:         cfg.heroTitle         ?? '',
    hero_descricao:     cfg.heroDescricao     ?? '',
    hero_role:          cfg.heroRole          ?? '',
    hero_date:          cfg.heroDate          ?? '',
    hero_version:       cfg.heroVersion       ?? '',
    hero_bg:            cfg.heroBg            ?? '#0015cf',
    hero_banner_filter: cfg.heroBannerFilter  ?? false,
    hero_image_path:    cfg.heroImage         ?? null,
    footer_left:        cfg.footerLeft        ?? 'TSSD',
    footer_center:      cfg.footerCenter      ?? '',
    footer_right:       cfg.footerRight       ?? '2026',
    footer_studio:      cfg.footerStudio      ?? 'TRESSDE',
    footer_heading:     cfg.footerHeading     ?? '',
    footer_sub:         cfg.footerSub         ?? '',
  }, { onConflict: 'project_id' })
  if (ce) throw new Error(ce.message)

  // 3. Busca IDs de blocos existentes para saber o que deletar depois
  const { data: existingBlocks } = await supabase
    .from('ap_blocks').select('id').eq('project_id', id)
  const existingIds = new Set((existingBlocks || []).map(b => b.id))
  const newIds = new Set()

  // 4. Upsert blocos + media (insere ANTES de deletar — sem risco de perda)
  for (let bi = 0; bi < (cfg.blocks || []).length; bi++) {
    const b = cfg.blocks[bi]
    const blockId = b.id || generateUUID()
    newIds.add(blockId)

    const { error: be } = await supabase.from('ap_blocks').upsert({
      id: blockId, project_id: id, position: bi,
      title: b.title || '', subtitle: b.subtitle || '',
      tag_a: b.tagA || '', tag_b: b.tagB || '', about: b.about || '',
    }, { onConflict: 'id' })
    if (be) throw new Error(be.message)

    // Deleta mídia antiga deste bloco e re-insere
    await supabase.from('ap_media').delete().eq('block_id', blockId)

    const images = b.images || []
    if (images.length) {
      const mediaRows = images.map((img, ii) => ({
        id:              generateUUID(),
        block_id:        blockId,
        project_id:      id,
        position:        ii,
        type:            img.type            || 'image',
        aspect_ratio:    img.ar              || '16/9',
        storage_path:    img.src             ?? null,
        mux_upload_id:   img.muxUploadId     ?? null,
        mux_asset_id:    img.muxAssetId      ?? null,
        mux_playback_id: img.muxPlaybackId   ?? null,
        mux_status:      img.type === 'video' ? (img.muxStatus ?? 'preparing') : null,
      }))
      const { error: me } = await supabase.from('ap_media').insert(mediaRows)
      if (me) throw new Error(me.message)
    }
  }

  // 5. Deleta apenas blocos que foram removidos da apresentação
  const toDelete = [...existingIds].filter(eid => !newIds.has(eid))
  if (toDelete.length) {
    const { error: de } = await supabase.from('ap_blocks').delete().in('id', toDelete)
    if (de) throw new Error(de.message)
  }

  return { id, slug, name }
}
