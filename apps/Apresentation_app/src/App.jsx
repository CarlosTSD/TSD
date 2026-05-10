import { useState, useEffect, useRef, useLayoutEffect } from 'react'
import './index.css'

// ─── Math helpers ─────────────────────────────────────────────────────────────
const clamp = (v, a, b) => Math.max(a, Math.min(b, v))
const easeOut = (t) => 1 - Math.pow(1 - t, 3)

// ─── useEnter: 0→1 as element scrolls into viewport ──────────────────────────
// delay: fraction of vh the element must enter before animation starts (0 = no delay)
function useEnter(ref, { offset = 0.15, delay = 0 } = {}) {
  const [p, setP] = useState(0)
  useEffect(() => {
    if (!ref.current) return
    let raf = null
    let ticking = false
    const calc = () => {
      const r = ref.current.getBoundingClientRect()
      const vh = window.innerHeight
      const entered = vh - r.top          // px element has entered from bottom of viewport
      const delayPx = delay * vh
      if (entered <= delayPx) { setP(0); return }
      const range = vh - vh * offset - delayPx
      const v = range > 0 ? clamp((entered - delayPx) / range, 0, 1) : 1
      setP(easeOut(v))
    }
    calc()
    const onScroll = () => {
      if (ticking) return
      ticking = true
      raf = requestAnimationFrame(() => { calc(); ticking = false })
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [offset, delay, ref])
  return p
}

// ─── GridPlaceholder ──────────────────────────────────────────────────────────
function GridPlaceholder({ width = '100%', height = '100%', label = 'CENTRO', coords = null,
  showCircle = true, showCross = true, variant = 'dark', radius = 0, style = {} }) {
  const ref = useRef(null)
  const [size, setSize] = useState({ w: 0, h: 0 })

  useEffect(() => {
    if (!ref.current) return
    const measure = () => {
      const r = ref.current.getBoundingClientRect()
      setSize({ w: Math.round(r.width), h: Math.round(r.height) })
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(ref.current)
    return () => ro.disconnect()
  }, [])

  const bg   = variant === 'dark' ? '#0a0a0a' : '#f0f0f0'
  const fg   = variant === 'dark' ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)'
  const txt  = variant === 'dark' ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.3)'
  const { w, h } = size
  const cx = w / 2, cy = h / 2
  const r  = Math.min(w, h) * 0.42
  const pid = `chk-${label.replace(/\W/g, '')}`

  return (
    <div ref={ref} style={{ width, height, position: 'relative', borderRadius: radius,
      overflow: 'hidden', background: bg, flexShrink: 0, ...style }}>
      {w > 0 && h > 0 && (
        <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0 }}>
          <defs>
            <pattern id={pid} x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
              <rect x="0" y="0" width="10" height="10" fill={fg} />
              <rect x="10" y="10" width="10" height="10" fill={fg} />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill={`url(#${pid})`} />
          {showCross && <>
            <line x1="0" y1="0" x2={w} y2={h} stroke={fg} strokeWidth="1" />
            <line x1={w} y1="0" x2="0" y2={h} stroke={fg} strokeWidth="1" />
          </>}
          {showCircle && <circle cx={cx} cy={cy} r={r} stroke={fg} strokeWidth="1" fill="none" />}
          <text x={cx} y={cy - (coords ? 8 : 0)} textAnchor="middle" dominantBaseline="middle"
            fill={txt} style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 11,
              letterSpacing: '0.18em', fontWeight: 700 }}>
            {label}
          </text>
          {coords && (
            <text x={cx} y={cy + 16} textAnchor="middle" dominantBaseline="middle"
              fill={txt} style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 9,
                letterSpacing: '0.1em' }}>
              {coords}
            </text>
          )}
        </svg>
      )}
    </div>
  )
}

// ─── Pills ────────────────────────────────────────────────────────────────────
const pillLight = {
  display: 'inline-block', padding: '6px 14px', borderRadius: 9999,
  background: '#fff', color: '#000', fontSize: 11, letterSpacing: '0.18em',
  fontWeight: 700, fontFamily: '"JetBrains Mono", ui-monospace, monospace',
}
const pillDark = {
  ...pillLight, background: '#1a1a1a', color: '#fff',
  border: '1px solid rgba(255,255,255,0.3)',
}

// ─── TopBar ───────────────────────────────────────────────────────────────────
function TopBar({ section = 'TSSD', label = 'VFX', tone = 'light' }) {
  const color  = tone === 'light' ? '#fff' : '#000'
  const border = tone === 'light' ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)'
  return (
    <div className="mono" style={{ padding: '24px 32px 18px', display: 'flex',
      justifyContent: 'space-between', borderBottom: `1px solid ${border}`,
      fontWeight: 700, fontSize: 13, letterSpacing: '0.18em', color }}>
      <span>{section}</span>
      <span>{label}</span>
    </div>
  )
}

// ─── FitTitle: binary-search font-size to fill container width ────────────────
function FitTitle({ text, symbol = '', weight = 500, max: maxPx = 320 }) {
  const wrapRef  = useRef(null)
  const innerRef = useRef(null)
  const [fontPx, setFontPx] = useState(220)

  useLayoutEffect(() => {
    if (!wrapRef.current || !innerRef.current) return
    const fit = () => {
      const wrap  = wrapRef.current
      const inner = innerRef.current
      if (!wrap || !inner) return
      const max = maxPx, min = 56
      let lo = min, hi = max, best = min
      const w = wrap.clientWidth
      for (let i = 0; i < 18; i++) {
        const mid = (lo + hi) / 2
        inner.style.fontSize = mid + 'px'
        const need = inner.scrollWidth
        if (need <= w) { best = mid; lo = mid } else { hi = mid }
      }
      inner.style.fontSize = best + 'px'
      setFontPx(best)
    }
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(wrapRef.current)
    return () => ro.disconnect()
  }, [text, symbol, maxPx])

  return (
    <div ref={wrapRef} style={{ width: '100%' }}>
      <h1 ref={innerRef} style={{ margin: 0, fontSize: fontPx, lineHeight: 0.92,
        fontWeight: weight, letterSpacing: '-0.04em', whiteSpace: 'nowrap',
        display: 'inline-block', maxWidth: '100%' }}>
        {text}{symbol}
      </h1>
    </div>
  )
}

// ─── Hero (fills fixed wrapper in App) ───────────────────────────────────────
function HeroKrishna({ onTextBottom, cfg }) {
  const paraRef = useRef(null)
  const roleRef = useRef(null)

  useEffect(() => {
    if (!paraRef.current) return
    const hero = paraRef.current.closest('[data-hero]')
    const measure = () => {
      const heroTop = hero.getBoundingClientRect().top   // always 0 (fixed)
      const pBot   = paraRef.current.getBoundingClientRect().bottom
      const rBot   = roleRef.current ? roleRef.current.getBoundingClientRect().bottom : 0
      onTextBottom(Math.max(pBot, rBot) - heroTop)
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(paraRef.current)
    if (roleRef.current) ro.observe(roleRef.current)
    window.addEventListener('resize', measure)
    return () => { ro.disconnect(); window.removeEventListener('resize', measure) }
  }, [onTextBottom])

  return (
    <div data-hero="" style={{ width: '100%', height: '100%',
      background: cfg.heroBg, color: '#fff', overflow: 'hidden',
      display: 'flex', flexDirection: 'column' }}>

      <TopBar section="TSSD" label="VFX" tone="light" />

      {/* ETAPA label */}
      <div className="mono" style={{ padding: '0 32px', marginTop: 16, fontSize: 14,
        letterSpacing: '0.12em', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
        {cfg.etapaLabel}
        <span style={{ display: 'inline-block', width: 28, height: 1, background: '#fff' }} />
        →
      </div>

      {/* Title — auto-fit to full width */}
      <div style={{ padding: '0 32px', marginTop: 24, marginBottom: 24 }}>
        <FitTitle text={cfg.heroTitle} symbol={cfg.heroSymbol} />
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: 'rgba(255,255,255,0.4)', flexShrink: 0 }} />

      {/* Description + Role/Date */}
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1.5fr 1fr',
        padding: '0 32px', gap: 32, alignItems: 'flex-start' }}>
        <p ref={paraRef} style={{ margin: 0, maxWidth: 560, fontSize: 16,
          lineHeight: 1.45, paddingTop: 32 }}>
          {cfg.heroDescricao}
        </p>
        <div style={{ alignSelf: 'stretch', borderLeft: '1px solid rgba(255,255,255,0.4)',
          paddingLeft: 24, fontSize: 16, lineHeight: 1.7, textAlign: 'right',
          paddingTop: 32 }}>
          <div ref={roleRef}>
            <div>Role: {cfg.heroRole}</div>
            <div>Date: {cfg.heroDate}</div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Banner card: sticky while fading to black; next section slides over it ───
function BannerCard({ onProgress }) {
  const wrapperRef = useRef(null)
  const bannerRef  = useRef(null)
  const [black, setBlack] = useState(0)

  useEffect(() => {
    const wrapper = wrapperRef.current
    const banner  = bannerRef.current
    if (!wrapper || !banner) return
    let raf = null
    let ticking = false
    const update = () => {
      const wRect = wrapper.getBoundingClientRect()
      const bRect = banner.getBoundingClientRect()
      const range = wRect.height - bRect.height
      const progress = range > 0 ? clamp(-wRect.top / range, 0, 1) : 0
      setBlack(progress)
      onProgress?.(progress)
    }
    const onScroll = () => {
      if (ticking) return
      ticking = true
      raf = requestAnimationFrame(() => { update(); ticking = false })
    }
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [onProgress])

  return (
    // Wrapper taller than the card → gives the sticky element room to "stick"
    // while the next section scrolls up over it from below.
    // background:'#000' fills the 40vh gap below the sticky banner so the fixed hero never shows through.
    <div ref={wrapperRef} style={{ height: '130vh', position: 'relative',
      background: 'linear-gradient(to bottom, transparent 60vh, #000 60vh)' }}>
      <div ref={bannerRef} style={{
        position: 'sticky', top: 0,
        width: '100%', aspectRatio: '5 / 2', maxHeight: '60vh',
        background: '#0a0a0a', borderTopLeftRadius: 32, borderTopRightRadius: 32,
        overflow: 'hidden',
      }}>
        <GridPlaceholder width="100%" height="100%" variant="dark"
          label="CENTRO" coords="768, 0 // 1536 x 1024" />
        {/* Static vignette */}
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none',
          background: 'linear-gradient(to top, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.55) 22%, rgba(0,0,0,0.15) 50%, rgba(0,0,0,0) 80%)' }} />
        {/* Black fade overlay — driven by scroll */}
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none',
          background: '#000', opacity: Math.min(black * 2, 1) }} />
      </div>
    </div>
  )
}

// ─── Section: London ──────────────────────────────────────────────────────────
function SectionLondon({ cfg }) {
  const ref  = useRef(null)
  const p = useEnter(ref, { offset: 0.2 })

  return (
    <section ref={ref} style={{ position: 'relative', zIndex: 1,
      background: '#000', color: '#fff', padding: '80px 32px 120px' }}>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 48, alignItems: 'flex-start' }}>
        {/* Left: title + subtitle + pills + about */}
        <div style={{ paddingTop: 8, opacity: p, transform: `translateX(${(1 - p) * -40}px)` }}>
          <h2 style={{ margin: 0, fontSize: 'clamp(48px, 6vw, 96px)', fontWeight: 500,
            letterSpacing: '-0.03em', lineHeight: 0.95 }}>
            {cfg.londonTitle}
          </h2>
          <p style={{ margin: '8px 0 24px', fontSize: 'clamp(20px, 1.6vw, 28px)',
            color: 'rgba(255,255,255,0.7)' }}>
            {cfg.londonSubtitle}
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <span style={pillLight}>{cfg.londonTagA}</span>
            <span style={pillDark}>{cfg.londonTagB}</span>
          </div>
          <div className="mono" style={{ marginTop: 32 }}>
            <div style={{ fontSize: 12, letterSpacing: '0.18em', fontWeight: 700, marginBottom: 12 }}>
              ABOUT
            </div>
            <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, letterSpacing: '0.05em',
              textTransform: 'uppercase', color: 'rgba(255,255,255,0.85)' }}>
              {cfg.londonAbout}
            </p>
          </div>
        </div>

        {/* Right: imagem principal */}
        <div style={{ aspectRatio: '16 / 9', width: '100%', borderRadius: 16,
          overflow: 'hidden', opacity: p, transform: `translateY(${(1 - p) * 60}px)` }}>
          <GridPlaceholder width="100%" height="100%" variant="dark"
            label="IMAGE 01" coords="0, 0 // 1920 x 1080" radius={16} />
        </div>
      </div>
    </section>
  )
}


// ─── Footer ───────────────────────────────────────────────────────────────────
function Footer({ cfg, translateOffset = 0 }) {
  return (
    <footer style={{
      position: 'relative', zIndex: 3, height: '70vh', overflow: 'hidden',
      background: cfg.heroBg, color: '#fff',
      borderTopLeftRadius: 32, borderTopRightRadius: 32,
      marginTop: `calc(-${translateOffset}vh - 32px)`,
    }}>
      {/* Top bar — 3 colunas, sem linha separadora */}
      <div className="mono" style={{
        padding: '24px 32px', display: 'flex', justifyContent: 'space-between',
        alignItems: 'center', fontWeight: 700, fontSize: 13, letterSpacing: '0.18em',
      }}>
        <span>{cfg.footerLeft}</span>
        <span>{cfg.footerCenter}</span>
        <span>{cfg.footerRight}</span>
      </div>

      {/* Nome do estúdio — borda a borda, ancorado na base, sangra levemente */}
      <div style={{
        position: 'absolute', bottom: '-6vh', left: '5%', right: '5%', lineHeight: 0.82,
      }}>
        <FitTitle text={cfg.footerStudio} weight={700} max={600} />
      </div>
    </footer>
  )
}

// ─── Default config ───────────────────────────────────────────────────────────
const DEFAULT_CFG = {
  etapaLabel:   'ETAPA 01',
  heroTitle:    'Krishna',
  heroSymbol:   '®',
  heroDescricao:'I worked closely with Krishna® team to understand their vision, values, and target audience. Through a collaborative process, we developed an effective brand identity.',
  heroRole:     'Branding / UI.UX / Motion',
  heroDate:     'Nov, 2088',
  heroBg:       '#3300FF',

  londonTitle:    'London',
  londonSubtitle: 'Mega-City One',
  londonTagA:     'ARCHITECTURE',
  londonTagB:     '2032',
  londonAbout:    'Established in 2032, Mega-City One was conceived as an answer to the massive overcrowding plaguing the cities of North America. Originally designed to house 350 million citizens, the population of Mega-City One soon swelled to an astounding 800 million people.',

  footerLeft:   'TSSD',
  footerCenter: 'O Boticário',
  footerRight:  'VFX',
  footerStudio: 'TRESSDE',
}

// ─── useCfg: reads config from sessionStorage / localStorage#slug / postMessage ─
function useCfg() {
  const [cfg, setCfg] = useState(() => {
    try {
      const hash = (window.location.hash || '').match(/p=([^&]+)/)
      if (hash) {
        const map = JSON.parse(localStorage.getItem('tressde:projects') || '{}')
        if (map[hash[1]]?.cfg) return { ...DEFAULT_CFG, ...map[hash[1]].cfg }
      }
      const sess = sessionStorage.getItem('tressde:previewCfg')
      if (sess) return { ...DEFAULT_CFG, ...JSON.parse(sess) }
    } catch (_) {}
    return DEFAULT_CFG
  })

  useEffect(() => {
    const onMsg = (e) => {
      if (e.data?.type === '__apr_cfg' && e.data.cfg)
        setCfg(c => ({ ...c, ...e.data.cfg }))
    }
    window.addEventListener('message', onMsg)
    try { window.parent?.postMessage({ type: '__apr_ready' }, '*') } catch (_) {}
    return () => window.removeEventListener('message', onMsg)
  }, [])

  return cfg
}

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  const cfg = useCfg()
  const [textBottom, setTextBottom] = useState(null)
  const [vh, setVh] = useState(window.innerHeight)
  const [bannerProgress, setBannerProgress] = useState(0)

  useEffect(() => {
    const onR = () => setVh(window.innerHeight)
    window.addEventListener('resize', onR)
    return () => window.removeEventListener('resize', onR)
  }, [])

  const GAP = vh * 0.10
  const spacerHeight = textBottom != null ? textBottom + GAP : vh * 0.52

  return (
    <div>
      <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100vh', zIndex: 1 }}>
        <HeroKrishna onTextBottom={setTextBottom} cfg={cfg} />
      </div>

      <div style={{ height: spacerHeight }} />

      <div style={{ position: 'relative', zIndex: 2 }}>
        <BannerCard onProgress={setBannerProgress} />
        {/* marginTop:-70vh → London começa na borda do banner (sem corte).
            translateY negativo adiciona velocidade extra de subida (1.5× o scroll),
            fazendo London cobrir o banner de baixo para cima simultaneamente ao fade. */}
        <div data-screen-label="02-london" style={{
          marginTop: '-70vh', position: 'relative', zIndex: 2,
          background: '#000',
          transform: `translateY(${-bannerProgress * 35}vh)`,
        }}>
          <SectionLondon cfg={cfg} />
        </div>
        <Footer cfg={cfg} translateOffset={bannerProgress * 35} />
      </div>
    </div>
  )
}
