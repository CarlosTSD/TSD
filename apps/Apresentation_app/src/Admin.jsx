import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import './admin.css'

// ─── Paleta (mesma do crono-app v1.1) ─────────────────────────────────────────
const C = {
  main: '#1E0FE8', blueDeep: '#0d06a8', blueGlow: 'rgba(30,15,232,.3)', blueSoft: '#cdd1ff',
  white: '#ffffff', frame: '#ffffff', card: '#f5f5f3', cardLine: '#e8e8e3', bg: '#f0f0eb',
  border: '#e8e8e3', invertBg: '#0d0d0d', invertText: '#ffffff',
  ink: '#0a0a0a', inkSoft: 'rgba(10,10,10,.65)', inkDim: 'rgba(10,10,10,.45)', gray: '#9a9a92',
  green: '#28CDA5', orange: '#F49931', red: '#F9513F',
}
const SHADOW    = '0 1px 2px rgba(10,10,10,.04), 0 8px 24px -8px rgba(10,10,10,.08)'
const SHADOW_LG = '0 24px 60px -20px rgba(10,10,10,.15), 0 2px 8px rgba(10,10,10,.04)'
const SHADOW_BL = '0 12px 40px -12px rgba(30,15,232,.3)'
const R = { sm: 8, md: 12, lg: 18, xl: 24, pill: 999 }

// ─── Storage ───────────────────────────────────────────────────────────────────
const PROJ_KEY = 'tressde:projects'
const LIST_KEY = 'tressde:apr:list'
function loadMap()  { try { return JSON.parse(localStorage.getItem(PROJ_KEY) || '{}') } catch { return {} } }
function loadList() { try { return JSON.parse(localStorage.getItem(LIST_KEY) || '[]') } catch { return [] } }

// "DD.MM.YY" ↔ "YYYY-MM-DD" (formato do input[type=date])
function dateToInput(v = '') {
  const [d, m, y] = (v || '').split('.')
  if (!d || !m || !y) return ''
  return `20${y.padStart(2,'0')}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`
}
function dateFromInput(v = '') {
  if (!v) return ''
  const [y, m, d] = v.split('-')
  return `${d}.${m}.${y.slice(-2)}`
}

// ─── Default config (espelho do App.jsx) ──────────────────────────────────────
const DEFAULT_CFG = {
  etapaLabel:   'ETAPA 01',
  heroTitle:    'Previz / Shader',
  heroDescricao:'I worked closely with Krishna® team to understand their vision, values, and target audience. Through a collaborative process, we developed an effective brand identity.',
  heroRole:     'O Boticario CLASH',
  heroDate:     '10.05.26',
  heroVersion:  'V1',
  heroBg:       '#0015cf',
  heroImage:         null,
  heroBannerFilter:  false,
  blocks: [{
    id: 'block-1', title: 'Tela 1', subtitle: '',
    tagA: '', tagB: '', about: '', images: [],
  }],
  footerLeft: 'TSSD', footerCenter: 'O Boticário', footerRight: 'VFX', footerStudio: 'TRESSDE',
}

// ─── Ícones ────────────────────────────────────────────────────────────────────
const Ico = ({ d, size = 16, stroke = 1.8 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
)
const IconMenu     = () => <Ico d="M3 12h18M3 6h18M3 18h12" />
const IconFolder   = () => <Ico d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />
const IconSave     = () => <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
const IconCopy     = () => <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
const IconPlus     = () => <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
const IconTrash    = () => <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
const IconChevron  = ({ up }) => <svg width={10} height={10} viewBox="0 0 10 10" fill="none"><path d={up ? 'M2 6.5L5 3.5L8 6.5' : 'M2 3.5L5 6.5L8 3.5'} stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
const IconSun      = () => <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>
const IconMoon     = () => <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>
const IconArrow    = () => <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M7 17L17 7M7 7h10v10"/></svg>

// ─── Estilos base de campo ─────────────────────────────────────────────────────
const labelSt = {
  display: 'block', fontSize: 10, fontWeight: 700, letterSpacing: '.1em',
  textTransform: 'uppercase', color: C.inkSoft, marginBottom: 5,
}
const inputSt = {
  width: '100%', background: C.white, border: `1px solid ${C.border}`,
  borderRadius: R.sm, color: C.ink, fontSize: 13, padding: '8px 10px',
  outline: 'none', boxSizing: 'border-box', transition: 'border-color .2s',
}
const textareaSt = { ...inputSt, minHeight: 68, resize: 'vertical', lineHeight: 1.5 }

// ─── SectionHead ──────────────────────────────────────────────────────────────
function SectionHead({ children, right }) {
  return (
    <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.14em', color: C.inkSoft,
      textTransform: 'uppercase', marginBottom: 14,
      display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{ color: C.ink, whiteSpace: 'nowrap' }}>{children}</span>
      <div style={{ flex: 1, height: 1, background: C.cardLine }} />
      {right}
    </div>
  )
}

// ─── SideBtn ──────────────────────────────────────────────────────────────────
function SideBtn({ icon, title, active, onClick }) {
  return (
    <button type="button" title={title} onClick={onClick} style={{
      width: 36, height: 36, borderRadius: R.pill,
      background: active ? C.main : 'transparent',
      color: active ? C.white : C.inkSoft,
      border: '1px solid transparent',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      cursor: 'pointer', boxShadow: active ? SHADOW_BL : 'none',
      transition: 'background .25s, color .25s, box-shadow .25s',
    }}
    onMouseOver={e => { if (!active) { e.currentTarget.style.background = C.cardLine; e.currentTarget.style.color = C.ink } }}
    onMouseOut={e  => { if (!active) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = C.inkSoft } }}
    >{icon}</button>
  )
}

// ─── Compressão de imagem via canvas ──────────────────────────────────────────
function compressImage(file, maxPx = 1920, q = 0.85) {
  return new Promise(resolve => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const scale = Math.min(1, maxPx / Math.max(img.width, img.height))
      const w = Math.round(img.width * scale), h = Math.round(img.height * scale)
      const c = document.createElement('canvas')
      c.width = w; c.height = h
      c.getContext('2d').drawImage(img, 0, 0, w, h)
      resolve(c.toDataURL('image/jpeg', q))
    }
    img.src = url
  })
}

const MAX_IMGS = 6

const AR_OPTS = [
  { label: '1:1',  v: '1/1'  },
  { label: '16:9', v: '16/9' },
  { label: '9:16', v: '9/16' },
  { label: '4:5',  v: '4/5'  },
  { label: '3:4',  v: '3/4'  },
]

// Migração: string → {src, ar}
function normImgs(imgs) {
  return (imgs || []).map(i => typeof i === 'string' ? { src: i, ar: '16/9' } : i)
}

// ─── BlockEditor ──────────────────────────────────────────────────────────────
function BlockEditor({ block, index, onChange, onDelete }) {
  const [open,   setOpen]   = useState(index === 0)
  const [arOpen, setArOpen] = useState(null)   // índice da imagem com picker aberto
  const fileRef  = useRef(null)
  const dragFrom = useRef(null)

  const images = normImgs(block.images?.length ? block.images : (block.image ? [block.image] : []))

  async function handleFiles(files) {
    const slots = MAX_IMGS - images.length
    if (slots <= 0) return
    const compressed = await Promise.all(Array.from(files).slice(0, slots).map(f => compressImage(f)))
    onChange({ ...block, images: [...images, ...compressed.map(src => ({ src, ar: '16/9' }))], image: undefined })
  }

  function removeImage(idx) {
    onChange({ ...block, images: images.filter((_, i) => i !== idx), image: undefined })
    if (arOpen === idx) setArOpen(null)
  }

  function changeAR(idx, ar) {
    onChange({ ...block, images: images.map((img, i) => i === idx ? { ...img, ar } : img), image: undefined })
    setArOpen(null)
  }

  function reorder(from, to) {
    if (from === to || from == null) return
    const arr = [...images]
    const [item] = arr.splice(from, 1)
    arr.splice(to, 0, item)
    onChange({ ...block, images: arr, image: undefined })
  }

  return (
    <div style={{ border: `1px solid ${C.cardLine}`, borderRadius: R.md, marginBottom: 8,
      background: C.white, transition: 'border-color .2s' }}>

      {/* Header */}
      <div onClick={() => setOpen(o => !o)} style={{
        padding: '10px 10px 10px 14px', display: 'flex', alignItems: 'center', gap: 10,
        cursor: 'pointer', userSelect: 'none' }}>
        <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: C.ink }}>
          {`Tela ${index + 1}`}
        </span>
        <button type="button" title="Remover tela" onClick={e => { e.stopPropagation(); onDelete() }}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.inkDim,
            display: 'flex', padding: 4, borderRadius: 6, transition: 'color .15s, background .15s' }}
          onMouseOver={e => { e.currentTarget.style.color = C.red; e.currentTarget.style.background = '#fee' }}
          onMouseOut={e  => { e.currentTarget.style.color = C.inkDim; e.currentTarget.style.background = 'none' }}>
          <IconTrash />
        </button>
        <span style={{ color: C.inkDim, display: 'flex' }}><IconChevron up={open} /></span>
      </div>

      {open && (
        <div style={{ padding: '2px 12px 14px', borderTop: `1px solid ${C.cardLine}` }}
          onClick={() => setArOpen(null)}>

          <label style={{ ...labelSt, marginTop: 12 }}>Título</label>
          <input style={inputSt} value={block.title || ''}
            onChange={e => onChange({ ...block, title: e.target.value })} />

          <label style={{ ...labelSt, marginTop: 10 }}>Subtítulo</label>
          <input style={inputSt} value={block.subtitle || ''}
            onChange={e => onChange({ ...block, subtitle: e.target.value })} />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 10 }}>
            <div>
              <label style={labelSt}>Tag A</label>
              <input style={inputSt} value={block.tagA || ''}
                onChange={e => onChange({ ...block, tagA: e.target.value })} />
            </div>
            <div>
              <label style={labelSt}>Tag B</label>
              <input style={inputSt} value={block.tagB || ''}
                onChange={e => onChange({ ...block, tagB: e.target.value })} />
            </div>
          </div>

          <label style={{ ...labelSt, marginTop: 10 }}>Sobre (ABOUT)</label>
          <textarea style={textareaSt} value={block.about || ''}
            onChange={e => onChange({ ...block, about: e.target.value })} />

          {/* ── Imagens ────────────────────────────────────────────────── */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, marginBottom: 6 }}>
            <label style={{ ...labelSt, margin: 0 }}>Imagens</label>
            <span style={{ fontSize: 10, color: C.inkDim }}>{images.length}/{MAX_IMGS}</span>
          </div>

          {images.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginBottom: 8 }}>
              {images.map((img, i) => (
                <div key={i}
                  draggable
                  onDragStart={e => { dragFrom.current = i; e.dataTransfer.effectAllowed = 'move' }}
                  onDragOver={e => e.preventDefault()}
                  onDrop={e => { e.preventDefault(); reorder(dragFrom.current, i); dragFrom.current = null }}
                  onDragEnd={() => { dragFrom.current = null }}
                  style={{ position: 'relative', aspectRatio: '16/9', borderRadius: R.sm,
                    cursor: 'grab', userSelect: 'none' }}>

                  {/* Imagem */}
                  <div style={{ position: 'absolute', inset: 0, borderRadius: R.sm, overflow: 'hidden', background: C.card }}>
                    <img src={img.src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                  </div>

                  {/* Remover */}
                  <button type="button" onClick={e => { e.stopPropagation(); removeImage(i) }} style={{
                    position: 'absolute', top: 4, right: 4,
                    width: 20, height: 20, borderRadius: '50%',
                    background: 'rgba(0,0,0,0.65)', border: 'none', cursor: 'pointer',
                    color: '#fff', fontSize: 10, fontWeight: 700,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2,
                  }}>✕</button>

                  {/* Badge de formato */}
                  <button type="button"
                    onClick={e => { e.stopPropagation(); setArOpen(arOpen === i ? null : i) }}
                    style={{
                      position: 'absolute', bottom: 4, left: 4, zIndex: 2,
                      background: 'rgba(0,0,0,0.72)', color: '#fff',
                      border: 'none', borderRadius: 4, fontSize: 9, fontWeight: 800,
                      padding: '2px 6px', cursor: 'pointer', letterSpacing: '.06em',
                      fontFamily: 'inherit',
                    }}>
                    {(img.ar || '16/9').replace('/', ':')}
                  </button>

                  {/* Picker de formato */}
                  {arOpen === i && (
                    <div onClick={e => e.stopPropagation()}
                      style={{
                        position: 'absolute', bottom: 26, left: 0, zIndex: 100,
                        background: C.frame, borderRadius: R.sm, boxShadow: SHADOW_LG,
                        padding: 5, display: 'flex', flexDirection: 'column', gap: 2, minWidth: 72,
                      }}>
                      {AR_OPTS.map(opt => (
                        <button key={opt.v} type="button" onClick={() => changeAR(i, opt.v)}
                          style={{
                            padding: '5px 8px', borderRadius: 4, border: 'none', cursor: 'pointer',
                            fontSize: 11, fontWeight: 700, textAlign: 'left', fontFamily: 'inherit',
                            background: img.ar === opt.v ? C.main : 'transparent',
                            color: img.ar === opt.v ? '#fff' : C.ink,
                          }}>
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {images.length < MAX_IMGS && (
            <>
              <input ref={fileRef} type="file" accept="image/*" multiple style={{ display: 'none' }}
                onChange={e => { handleFiles(e.target.files); e.target.value = '' }} />
              <button type="button" onClick={() => fileRef.current?.click()} style={{
                width: '100%', padding: '10px 0',
                border: `1.5px dashed ${C.cardLine}`, borderRadius: R.md,
                background: 'transparent', cursor: 'pointer', color: C.inkSoft,
                fontFamily: 'inherit', fontSize: 12, fontWeight: 600,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                transition: 'border-color .2s, color .2s' }}
                onMouseOver={e => { e.currentTarget.style.borderColor = C.main; e.currentTarget.style.color = C.main }}
                onMouseOut={e  => { e.currentTarget.style.borderColor = C.cardLine; e.currentTarget.style.color = C.inkSoft }}>
                <IconPlus /> Adicionar Imagem
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Admin ─────────────────────────────────────────────────────────────────────
export default function Admin() {
  const [list,        setList]        = useState(loadList)
  const [currentId,  setCurrentId]   = useState(null)
  const [projectName,setProjectName] = useState('')
  const [cfg,        setCfg]         = useState(DEFAULT_CFG)
  const [showSidebar,setShowSidebar] = useState(true)
  const [showDrawer, setShowDrawer]  = useState(false)
  const [toast,      setToast]       = useState(null)
  const [theme,      setTheme]       = useState(() => {
    try { return localStorage.getItem('tressde:apr:theme') || 'light' } catch { return 'light' }
  })
  const iframeRef  = useRef(null)
  const heroImgRef = useRef(null)
  const toastTimer = useRef(null)

  // Tema
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    try { localStorage.setItem('tressde:apr:theme', theme) } catch {}
  }, [theme])

  // Sincroniza cfg → iframe em tempo real
  useEffect(() => {
    const frame = iframeRef.current
    if (!frame) return
    const send = () => frame.contentWindow?.postMessage({ type: '__apr_cfg', cfg }, '*')
    frame.addEventListener('load', send)
    send()
    return () => frame.removeEventListener('load', send)
  }, [cfg])

  // Toast
  function toast$(msg, type = 'success') {
    if (toastTimer.current) clearTimeout(toastTimer.current)
    setToast({ msg, type })
    toastTimer.current = setTimeout(() => setToast(null), 2500)
  }

  // Helpers
  function set(k, v) { setCfg(c => ({ ...c, [k]: v })) }

  function addBlock() {
    const id = `block-${Date.now()}`
    setCfg(c => {
      const next = (c.blocks || []).length + 1
      return { ...c, blocks: [...(c.blocks || []),
        { id, title: `Tela ${next}`, subtitle: '', tagA: '', tagB: '', about: '', images: [] }
      ]}
    })
  }
  function updateBlock(id, b) {
    setCfg(c => ({ ...c, blocks: (c.blocks || []).map(bl => bl.id === id ? b : bl) }))
  }
  function deleteBlock(id) {
    setCfg(c => ({ ...c, blocks: (c.blocks || []).filter(bl => bl.id !== id) }))
  }

  // Núcleo de persistência — usado por save, copyLink e duplicate
  function persist(overrideId = null, overrideName = null, overrideCfg = null) {
    const id      = overrideId || currentId || `p_${Date.now()}`
    const name    = (overrideName !== null ? overrideName : projectName).trim() || cfg.heroTitle || 'Sem nome'
    const savedCfg = overrideCfg || cfg
    const existing = list.find(p => p.id === id)
    const slug    = existing?.slug
      || (name.toLowerCase().replace(/[^\w]+/g, '-').replace(/^-|-$/g, '') + '-' + id.slice(-6))

    const map = loadMap()
    map[slug] = { cfg: savedCfg, name, savedAt: new Date().toISOString() }
    localStorage.setItem(PROJ_KEY, JSON.stringify(map))

    const item    = { id, slug, name, savedAt: new Date().toISOString() }
    const updated = [item, ...list.filter(p => p.id !== id)]
    localStorage.setItem(LIST_KEY, JSON.stringify(updated))
    setList(updated)
    setCurrentId(id)
    return { id, slug, name, link: `${window.location.origin}/#p=${slug}` }
  }

  function save() {
    const { name } = persist()
    toast$(`"${name}" salvo`)
  }

  function duplicate() {
    const baseName = projectName.trim() || cfg.heroTitle || 'Sem nome'
    const newName  = `${baseName} — cópia`
    const newId    = `p_${Date.now()}`

    const vMatch = (cfg.heroVersion || 'V1').toUpperCase().match(/^V(\d+)$/)
    const nextVersion = vMatch ? `V${parseInt(vMatch[1]) + 1}` : (cfg.heroVersion || 'V1')
    const newCfg = { ...cfg, heroVersion: nextVersion }

    const { name } = persist(newId, newName, newCfg)
    setCfg(newCfg)
    setProjectName(newName)
    toast$(`"${name}" duplicado → ${nextVersion}`)
  }

  // Carregar projeto
  function loadProject(id) {
    const item = list.find(p => p.id === id)
    if (!item) return
    const data = loadMap()[item.slug]
    if (!data?.cfg) return
    setCfg({ ...DEFAULT_CFG, ...data.cfg, blocks: data.cfg.blocks || DEFAULT_CFG.blocks })
    setProjectName(data.name || item.name || '')
    setCurrentId(id)
    setShowDrawer(false)
    toast$(`"${item.name}" carregado`, 'info')
  }

  function getSlug() { return list.find(p => p.id === currentId)?.slug }
  function getLink() {
    const slug = getSlug()
    return slug ? `${window.location.origin}/#p=${slug}` : null
  }

  async function copyLink() {
    const { name, link } = persist()
    try { await navigator.clipboard.writeText(link); toast$(`"${name}" salvo · Link copiado`) }
    catch { toast$('Falha ao copiar', 'error') }
  }

  function openPreview() {
    const { link } = persist()
    window.open(link, '_blank')
  }

  const link = getLink()
  const themeColors = theme === 'dark'
    ? { ...C, frame: '#1a1a1a', card: '#262626', cardLine: '#2e2e2e', bg: '#0a0a0a',
        ink: '#fff', inkSoft: 'rgba(255,255,255,.7)', inkDim: 'rgba(255,255,255,.45)',
        white: '#1a1a1a', border: '#2e2e2e' }
    : C
  const T = themeColors

  return (
    <div style={{ minHeight: '100vh', background: T.bg, color: T.ink, padding: 20, transition: 'background .35s, color .35s' }}>
      <div style={{ background: T.frame, borderRadius: R.xl + 4, border: `1px solid ${T.cardLine}`,
        boxShadow: SHADOW_LG, overflow: 'hidden', minHeight: 'calc(100vh - 40px)',
        display: 'flex', flexDirection: 'column', transition: 'background .35s' }}>

        {/* Toast */}
        {toast && createPortal(
          <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 99999, pointerEvents: 'none',
            background: toast.type === 'success' ? C.green : toast.type === 'info' ? C.main : C.red,
            color: '#fff', padding: '11px 18px', borderRadius: 10,
            boxShadow: SHADOW_LG, fontSize: 13, fontWeight: 700,
            animation: 'toast-in .22s ease-out' }}>
            {toast.msg}
          </div>,
          document.body
        )}

        {/* ── Header ─────────────────────────────────────────────────────────── */}
        <header style={{ background: T.frame, borderBottom: `1px solid ${T.cardLine}`,
          padding: '0 2.5rem', height: 72, flexShrink: 0,
          display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: 16,
          transition: 'background .35s' }}>

          <div style={{ fontWeight: 700, fontSize: 20, letterSpacing: '-.03em', color: T.ink }}>tressde</div>

          <div style={{ fontSize: 17, fontWeight: 600, letterSpacing: '-.02em', color: T.ink, whiteSpace: 'nowrap' }}>
            Apresentation Admin
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifySelf: 'end' }}>
            <button onClick={openPreview} style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              fontSize: 11, padding: '6px 12px',
              background: T.invertBg, color: T.invertText,
              borderRadius: R.pill, border: 'none', letterSpacing: '.08em',
              fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
            }}>
              PRÉVIA <IconArrow />
            </button>
            <div style={{ fontSize: 11, padding: '6px 12px', background: T.card,
              color: T.inkSoft, borderRadius: R.pill, letterSpacing: '.08em', fontWeight: 600 }}>
              v1.0 · ADMIN
            </div>
          </div>
        </header>

        {/* ── Body ──────────────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>

          {/* Side Rail */}
          <div style={{ flexShrink: 0, padding: '18px 14px 18px 18px', background: T.frame, transition: 'background .35s' }}>
            <aside style={{ width: 56, padding: '10px 0',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
              background: T.card, border: `1px solid ${T.cardLine}`,
              borderRadius: R.xl, height: 'fit-content', transition: 'background .35s' }}>

              <SideBtn icon={<IconMenu />} title="Formulário" active={showSidebar}
                onClick={() => setShowSidebar(s => !s)} />
              <SideBtn icon={<IconFolder />} title="Projetos salvos" active={showDrawer}
                onClick={() => setShowDrawer(s => !s)} />

              {/* Tema toggle */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                border: `1px solid ${T.cardLine}`, borderRadius: R.pill, padding: 3, marginTop: 6 }}>
                {[['light', <IconSun />], ['dark', <IconMoon />]].map(([mode, icon]) => (
                  <button key={mode} type="button" onClick={() => setTheme(mode)}
                    title={mode === 'light' ? 'Modo claro' : 'Modo escuro'}
                    style={{ width: 26, height: 26, borderRadius: R.pill,
                      background: theme === mode ? C.main : 'transparent',
                      color: theme === mode ? '#fff' : T.inkDim,
                      border: 'none', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      boxShadow: theme === mode ? SHADOW_BL : 'none', transition: 'all .25s' }}>
                    {icon}
                  </button>
                ))}
              </div>
            </aside>
          </div>

          {/* Drawer de projetos */}
          {showDrawer && createPortal(
            <>
              <div onClick={() => setShowDrawer(false)}
                style={{ position: 'fixed', inset: 0, zIndex: 199 }} />
              <div style={{ position: 'fixed', top: 84, left: 100, width: 340, maxHeight: '70vh',
                background: C.white, border: `1px solid ${C.cardLine}`,
                borderRadius: R.xl, boxShadow: SHADOW_LG, zIndex: 200,
                display: 'flex', flexDirection: 'column', overflow: 'hidden',
                animation: 'toast-in .22s ease-out' }}>
                <div style={{ padding: '16px 18px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${C.cardLine}` }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: C.ink }}>Projetos salvos</span>
                  <span style={{ fontSize: 11, color: C.inkDim }}>{list.length} {list.length === 1 ? 'item' : 'itens'}</span>
                </div>
                <div style={{ flex: 1, overflowY: 'auto', padding: '8px 10px 12px',
                  display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {list.length === 0
                    ? <p style={{ color: C.inkDim, fontSize: 13, textAlign: 'center', padding: '32px 0' }}>
                        Nenhum projeto salvo ainda.
                      </p>
                    : list.map(p => (
                      <button key={p.id} onClick={() => loadProject(p.id)} style={{
                        width: '100%', textAlign: 'left', padding: '10px 14px',
                        background: p.id === currentId ? `${C.main}10` : C.white,
                        border: `1px solid ${p.id === currentId ? C.main : C.cardLine}`,
                        borderRadius: R.md, cursor: 'pointer', fontFamily: 'inherit',
                        transition: 'border-color .2s, background .2s' }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: C.ink }}>{p.name}</div>
                        <div style={{ fontSize: 10, color: C.inkDim, marginTop: 2, fontFamily: 'monospace' }}>
                          /#p={p.slug}
                        </div>
                      </button>
                    ))
                  }
                </div>
              </div>
            </>,
            document.body
          )}

          {/* ── Sidebar ──────────────────────────────────────────────────────── */}
          <aside style={{
            width: showSidebar ? 380 : 0, flexShrink: 0,
            padding: showSidebar ? '1.5rem' : 0,
            margin: showSidebar ? '16px 0' : 0,
            borderRadius: R.xl, border: showSidebar ? `1px solid ${T.cardLine}` : 'none',
            background: T.card, overflowY: 'auto', overflowX: 'hidden',
            transition: 'width .3s ease, padding .3s ease, background .35s',
          }}>

            {/* PROJETO */}
            <div style={{ marginBottom: 24 }}>
              <SectionHead>Projeto</SectionHead>
              <label style={labelSt}>Nome do projeto</label>
              <input style={inputSt} placeholder="Ex: Krishna — Branding"
                value={projectName} onChange={e => setProjectName(e.target.value)} />
            </div>

            {/* HERO */}
            <div style={{ marginBottom: 24 }}>
              <SectionHead>Hero</SectionHead>

              <label style={labelSt}>Etapa</label>
              <input style={inputSt} value={cfg.etapaLabel}
                onChange={e => set('etapaLabel', e.target.value)} />

              <div style={{ marginTop: 10 }}>
                <label style={labelSt}>Título</label>
                <textarea
                  style={{ ...textareaSt, resize: 'none', lineHeight: 1.4 }}
                  rows={Math.max(2, (cfg.heroTitle || '').split('\n').length)}
                  value={cfg.heroTitle}
                  onChange={e => set('heroTitle', e.target.value)}
                  placeholder={'Linha 1\nLinha 2'}
                />
              </div>

              <label style={{ ...labelSt, marginTop: 10 }}>Descrição</label>
              <textarea style={textareaSt} value={cfg.heroDescricao}
                onChange={e => set('heroDescricao', e.target.value)} />

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 72px', gap: 8, marginTop: 10 }}>
                <div>
                  <label style={labelSt}>Cliente</label>
                  <input style={inputSt} value={cfg.heroRole}
                    onChange={e => set('heroRole', e.target.value)} />
                </div>
                <div>
                  <label style={labelSt}>Data</label>
                  <input type="date" style={{ ...inputSt, cursor: 'pointer' }}
                    value={dateToInput(cfg.heroDate)}
                    onChange={e => set('heroDate', dateFromInput(e.target.value))} />
                </div>
                <div>
                  <label style={labelSt}>Versão</label>
                  <input style={inputSt} value={cfg.heroVersion || ''}
                    onChange={e => set('heroVersion', e.target.value)} />
                </div>
              </div>

              <label style={{ ...labelSt, marginTop: 10 }}>Cor de fundo</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input type="color" value={cfg.heroBg} onChange={e => set('heroBg', e.target.value)}
                  style={{ width: 36, height: 36, border: `1px solid ${C.border}`,
                    borderRadius: R.sm, padding: 2, background: C.white, flexShrink: 0 }} />
                <input style={{ ...inputSt, flex: 1 }} value={cfg.heroBg}
                  onChange={e => set('heroBg', e.target.value)} />
              </div>

              <label style={{ ...labelSt, marginTop: 12 }}>Capa</label>
              {cfg.heroImage ? (
                <>
                  <div style={{ position: 'relative', borderRadius: R.sm, overflow: 'hidden', aspectRatio: '16/9' }}>
                    <img src={cfg.heroImage} alt="" style={{
                      width: '100%', height: '100%', objectFit: 'cover', display: 'block',
                      filter: cfg.heroBannerFilter ? 'grayscale(1) contrast(1.05)' : 'none',
                    }} />
                    <button type="button" onClick={() => set('heroImage', null)} style={{
                      position: 'absolute', top: 6, right: 6,
                      width: 22, height: 22, borderRadius: '50%',
                      background: 'rgba(0,0,0,0.65)', border: 'none', cursor: 'pointer',
                      color: '#fff', fontSize: 11, fontWeight: 700,
                      display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
                  </div>
                  {/* Filtro toggle */}
                  <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                    {[['Original', false], ['P&B + Grain', true]].map(([label, val]) => (
                      <button key={label} type="button"
                        onClick={() => set('heroBannerFilter', val)}
                        style={{
                          flex: 1, padding: '7px 0', borderRadius: R.sm,
                          border: `1.5px solid ${cfg.heroBannerFilter === val ? C.main : C.border}`,
                          background: cfg.heroBannerFilter === val ? C.main : C.white,
                          color: cfg.heroBannerFilter === val ? '#fff' : C.inkSoft,
                          fontSize: 11, fontWeight: 700, letterSpacing: '.05em',
                          cursor: 'pointer', fontFamily: 'inherit', transition: 'all .15s',
                        }}>
                        {label}
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <input ref={heroImgRef} type="file" accept="image/*" style={{ display: 'none' }}
                    onChange={async e => {
                      const f = e.target.files[0]
                      if (f) { const img = await compressImage(f); set('heroImage', img) }
                      e.target.value = ''
                    }} />
                  <button type="button" onClick={() => heroImgRef.current?.click()} style={{
                    width: '100%', padding: '10px 0',
                    border: `1.5px dashed ${C.cardLine}`, borderRadius: R.md,
                    background: 'transparent', cursor: 'pointer', color: C.inkSoft,
                    fontFamily: 'inherit', fontSize: 12, fontWeight: 600,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    transition: 'border-color .2s, color .2s' }}
                    onMouseOver={e => { e.currentTarget.style.borderColor = C.main; e.currentTarget.style.color = C.main }}
                    onMouseOut={e  => { e.currentTarget.style.borderColor = C.cardLine; e.currentTarget.style.color = C.inkSoft }}>
                    <IconPlus /> Adicionar Capa
                  </button>
                </>
              )}
            </div>

            {/* BLOCOS */}
            <div style={{ marginBottom: 24 }}>
              <SectionHead right={
                <button type="button" onClick={addBlock} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  padding: '3px 9px', background: C.main, color: '#fff',
                  border: 'none', borderRadius: R.pill, fontSize: 10, fontWeight: 700,
                  letterSpacing: '.06em', cursor: 'pointer', textTransform: 'uppercase',
                  fontFamily: 'inherit' }}>
                  <IconPlus /> Tela
                </button>
              }>Telas</SectionHead>

              {(cfg.blocks || []).map((block, i) => (
                <BlockEditor key={block.id} block={block} index={i}
                  onChange={b => updateBlock(block.id, b)}
                  onDelete={() => deleteBlock(block.id)} />
              ))}

              {(!cfg.blocks || cfg.blocks.length === 0) && (
                <p style={{ color: C.inkDim, fontSize: 12, textAlign: 'center', padding: '16px 0' }}>
                  Nenhuma tela. Clique em "+ Tela" para adicionar.
                </p>
              )}
            </div>

            {/* RODAPÉ */}
            <div style={{ marginBottom: 24 }}>
              <SectionHead>Rodapé</SectionHead>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                <div>
                  <label style={labelSt}>Esquerda</label>
                  <input style={inputSt} value={cfg.footerLeft}
                    onChange={e => set('footerLeft', e.target.value)} />
                </div>
                <div>
                  <label style={labelSt}>Centro</label>
                  <input style={inputSt} value={cfg.footerCenter}
                    onChange={e => set('footerCenter', e.target.value)} />
                </div>
                <div>
                  <label style={labelSt}>Direita</label>
                  <input style={inputSt} value={cfg.footerRight}
                    onChange={e => set('footerRight', e.target.value)} />
                </div>
              </div>

              <label style={{ ...labelSt, marginTop: 10 }}>Nome do estúdio</label>
              <input style={inputSt} value={cfg.footerStudio}
                onChange={e => set('footerStudio', e.target.value)} />
            </div>

            {/* AÇÕES */}
            <SectionHead>Ações</SectionHead>

            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <button type="button" onClick={save} style={{
                flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                background: C.main, border: 'none', borderRadius: R.pill, color: '#fff',
                fontWeight: 600, fontSize: 13, padding: '11px 16px', cursor: 'pointer',
                fontFamily: 'inherit', boxShadow: SHADOW_BL,
                transition: 'background .2s, box-shadow .2s' }}
                onMouseOver={e => { e.currentTarget.style.background = C.blueDeep; e.currentTarget.style.boxShadow = '0 18px 40px -10px rgba(30,15,232,.5)' }}
                onMouseOut={e  => { e.currentTarget.style.background = C.main;     e.currentTarget.style.boxShadow = SHADOW_BL }}>
                <IconSave /> Salvar
              </button>

              <button type="button" onClick={copyLink} style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                background: T.white, border: `1px solid ${T.cardLine}`,
                borderRadius: R.pill, color: T.ink,
                fontWeight: 600, fontSize: 13, padding: '11px 16px',
                cursor: 'pointer', fontFamily: 'inherit',
                transition: 'background .2s' }}>
                <IconCopy /> Link
              </button>
            </div>

            <button type="button" onClick={duplicate} style={{
              width: '100%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7,
              background: T.card, border: `1px solid ${T.cardLine}`,
              borderRadius: R.pill, color: T.inkSoft,
              fontWeight: 600, fontSize: 13, padding: '9px 16px',
              cursor: 'pointer', fontFamily: 'inherit', marginBottom: 10,
              transition: 'background .2s, color .2s' }}
              onMouseOver={e => { e.currentTarget.style.background = T.cardLine; e.currentTarget.style.color = T.ink }}
              onMouseOut={e  => { e.currentTarget.style.background = T.card;     e.currentTarget.style.color = T.inkSoft }}>
              <IconCopy /> Duplicar
            </button>

            {link && (
              <p style={{ fontSize: 10, color: C.inkDim, textAlign: 'center',
                lineHeight: 1.5, wordBreak: 'break-all', fontFamily: 'monospace' }}>
                {link}
              </p>
            )}
          </aside>

          {/* ── Preview (iframe) ─────────────────────────────────────────────── */}
          <main style={{ flex: 1, padding: '16px 18px 16px 12px', minWidth: 0 }}>
            <div style={{ width: '100%', height: '100%', borderRadius: R.xl,
              overflow: 'hidden', border: `1px solid ${T.cardLine}`, boxShadow: SHADOW_LG }}>
              <iframe
                ref={iframeRef}
                src="/"
                title="Apresentation Preview"
                style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
              />
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}
