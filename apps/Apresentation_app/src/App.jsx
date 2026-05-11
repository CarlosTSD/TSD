import { useState, useEffect, useRef, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'
import './index.css'

// ─── Math helpers ─────────────────────────────────────────────────────────────
const clamp = (v, a, b) => Math.max(a, Math.min(b, v))
const easeOut = (t) => 1 - Math.pow(1 - t, 3)

// ─── useIsMobile ──────────────────────────────────────────────────────────────
function useIsMobile(bp = 768) {
  const [m, setM] = useState(() => window.innerWidth < bp)
  useEffect(() => {
    const check = () => setM(window.innerWidth < bp)
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [bp])
  return m
}

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
  fontWeight: 700, fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
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

// ─── FitTitle ─────────────────────────────────────────────────────────────────
// Sem \n manual:  1-2 palavras → 1 linha (largura), 3+ → 2 linhas (altura)
// Com \n manual:  respeita as quebras explícitas (pre-line + display:block),
//                 font escala para que TODAS as linhas caibam na altura esperada
function FitTitle({ text, weight = 500, max: maxPx = 320 }) {
  const wrapRef  = useRef(null)
  const innerRef = useRef(null)
  const [fontPx, setFontPx] = useState(220)

  const hasBreaks    = text.includes('\n')
  const explicitLines = hasBreaks
    ? Math.max(1, text.trim().split('\n').filter(l => l.trim()).length)
    : null
  const words        = text.trim().replace(/\n/g, ' ').split(/\s+/)
  const autoMulti    = !hasBreaks && words.length >= 3
  const multiLine    = hasBreaks || autoMulti
  const targetLines  = hasBreaks ? explicitLines : (autoMulti ? 2 : 1)

  useLayoutEffect(() => {
    if (!wrapRef.current || !innerRef.current) return
    const fit = () => {
      const wrap  = wrapRef.current
      const inner = innerRef.current
      if (!wrap || !inner) return
      let lo = 36, hi = maxPx, best = 36

      if (multiLine) {
        // Altura: todas as linhas (explícitas ou auto) cabem no espaço esperado.
        // display:block + white-space pre-line/normal nunca extravasa na horizontal.
        for (let i = 0; i < 20; i++) {
          const mid = (lo + hi) / 2
          inner.style.fontSize = mid + 'px'
          const h = inner.getBoundingClientRect().height
          if (h <= mid * 0.95 * targetLines + 4) { best = mid; lo = mid } else { hi = mid }
        }
      } else {
        // Largura: cabe na largura do container (1-2 palavras, sem quebra).
        const w = wrap.getBoundingClientRect().width - 2
        for (let i = 0; i < 20; i++) {
          const mid = (lo + hi) / 2
          inner.style.fontSize = mid + 'px'
          if (inner.getBoundingClientRect().width <= w) { best = mid; lo = mid } else { hi = mid }
        }
      }

      inner.style.fontSize = best + 'px'
      setFontPx(best)
    }
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(wrapRef.current)
    return () => ro.disconnect()
  }, [text, maxPx, multiLine, targetLines])

  return (
    <div ref={wrapRef} style={{ width: '100%' }}>
      <h1 ref={innerRef} style={{
        margin: 0, fontSize: fontPx,
        lineHeight: multiLine ? 0.95 : 0.92,
        fontWeight: weight, letterSpacing: '-0.04em',
        // pre-line: respeita \n explícitos E quebra na margem se necessário
        whiteSpace: hasBreaks ? 'pre-line' : (multiLine ? 'normal' : 'nowrap'),
        display: multiLine ? 'block' : 'inline-block',
      }}>
        {text}
      </h1>
    </div>
  )
}

// ─── Hero (fills fixed wrapper in App) ───────────────────────────────────────
function HeroKrishna({ onTextBottom, cfg }) {
  const paraRef = useRef(null)
  const roleRef = useRef(null)
  const small   = useIsMobile(768)

  useEffect(() => {
    if (!paraRef.current) return
    const hero = paraRef.current.closest('[data-hero]')
    const measure = () => {
      const heroTop = hero.getBoundingClientRect().top
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

  const pt = small ? 14 : 18  // paddingTop do info row

  return (
    <div data-hero="" style={{ width: '100%', height: '100%',
      background: cfg.heroBg, color: '#fff', overflow: 'hidden',
      display: 'flex', flexDirection: 'column' }}>

      <TopBar section="TSSD" label={cfg.footerRight} tone="light" />

      {/* ETAPA label */}
      <div className="mono" style={{ padding: '0 32px', marginTop: small ? 10 : 10, fontSize: 14,
        letterSpacing: '0.12em', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 10 }}>
        {cfg.etapaLabel}
        <svg width="34" height="7" viewBox="0 0 48 10" fill="none"
          stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="0" y1="5" x2="38" y2="5" />
          <polyline points="32,1 38,5 32,9" />
        </svg>
      </div>

      {/* Title — auto-fit to full width */}
      <div style={{ padding: '0 32px', marginTop: small ? 12 : 12, marginBottom: small ? 10 : 14 }}>
        <FitTitle text={cfg.heroTitle} />
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: 'rgba(255,255,255,0.4)', flexShrink: 0 }} />

      {/* Description + Cliente/Data/Versão */}
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1.5fr 1fr',
        padding: `0 ${small ? 20 : 32}px`, gap: small ? 16 : 32, alignItems: 'flex-start' }}>
        <p ref={paraRef} style={{ margin: 0, maxWidth: 560,
          fontSize: small ? 13 : 16, lineHeight: 1.45, paddingTop: pt }}>
          {cfg.heroDescricao}
        </p>
        <div style={{ alignSelf: 'stretch',
          borderLeft: '1px solid rgba(255,255,255,0.4)',
          paddingLeft: small ? 14 : 24, paddingTop: pt }}>
          <div ref={roleRef} style={{
            display: 'flex', flexDirection: small ? 'column' : 'row',
            justifyContent: 'flex-end',
            alignItems: small ? 'flex-end' : 'flex-start', gap: small ? 10 : 20 }}>
            <div style={{ fontSize: small ? 12 : 16, lineHeight: 1.7, textAlign: 'right' }}>
              <div>{cfg.heroRole}</div>
              <div>{cfg.heroDate}</div>
            </div>
            {cfg.heroVersion && (
              <div style={{
                border: '2px solid rgba(255,255,255,0.85)',
                borderRadius: 10,
                padding: small ? '3px 10px' : '4px 16px',
                fontSize: small ? 24 : 40,
                fontWeight: 800,
                letterSpacing: '0.02em',
                lineHeight: 1.2,
                flexShrink: 0,
              }}>
                {cfg.heroVersion}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Ícone de expand (duas setas diagonais a 45°) ────────────────────────────
const IconExpand = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none"
    stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="7.5,1 11,1 11,4.5" />
    <line x1="6.5" y1="5.5" x2="11" y2="1" />
    <polyline points="4.5,11 1,11 1,7.5" />
    <line x1="5.5" y1="6.5" x2="1" y2="11" />
  </svg>
)

// ─── Seta diagonal ↘ ─────────────────────────────────────────────────────────
const IconArrowNE = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 20 20" fill="none"
    stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
    <line x1="4" y1="16" x2="16" y2="4" />
    <polyline points="11,4 16,4 16,9" />
  </svg>
)
function ArrowToTop({ size = 20, color }) {
  const [hover, setHover] = useState(false)
  const [active, setActive] = useState(false)
  const scale = active ? 0.82 : hover ? 1.18 : 1
  const rotate = hover ? '-8deg' : '0deg'
  return (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      aria-label="Voltar ao topo"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => { setHover(false); setActive(false) }}
      onMouseDown={() => setActive(true)}
      onMouseUp={() => setActive(false)}
      style={{
        background: 'none', border: 'none', color, cursor: 'pointer',
        padding: 0, display: 'flex', outline: 'none',
        transform: `scale(${scale}) rotate(${rotate})`,
        transition: active
          ? 'transform 0.08s cubic-bezier(0.34,1.56,0.64,1)'
          : 'transform 0.35s cubic-bezier(0.34,1.56,0.64,1)',
        transformOrigin: 'center',
      }}
    >
      <IconArrowNE size={size} />
    </button>
  )
}

// SVG fractal-noise grain tile (256×256, grayscale, tiled as overlay)
const GRAIN_URL = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='256' height='256'%3E%3Cfilter id='g'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='256' height='256' filter='url(%23g)' opacity='1'/%3E%3C/svg%3E\")"

// ─── Banner card: sticky while fading to black; next section slides over it ───
function BannerCard({ onProgress, cfg }) {
  const wrapperRef = useRef(null)
  const bannerRef  = useRef(null)
  const [black, setBlack] = useState(0)
  const small = useIsMobile(768)   // phone only

  // Desktop: 60vh | mobile: 55vh (preenche metade inferior da tela); range sticky mantido
  const bannerH  = small ? '55vh' : '60vh'
  const wrapperH = small ? '125vh' : '130vh'

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
  }, [onProgress, small])

  return (
    <div ref={wrapperRef} style={{ height: wrapperH, position: 'relative',
      background: `linear-gradient(to bottom, transparent ${bannerH}, #000 ${bannerH})` }}>
      <div ref={bannerRef} style={{
        position: 'sticky', top: 0,
        width: '100%', height: bannerH,
        background: '#0a0a0a', borderTopLeftRadius: 32, borderTopRightRadius: 32,
        overflow: 'hidden',
      }}>
        {cfg?.heroImage ? (
          <>
            <img src={cfg.heroImage} alt="" style={{
              width: '100%', height: '100%', objectFit: 'cover', display: 'block',
              filter: cfg.heroBannerFilter ? 'grayscale(1) contrast(1.05)' : 'none',
            }} />
            {cfg.heroBannerFilter && (
              <div style={{
                position: 'absolute', inset: 0, zIndex: 1, pointerEvents: 'none',
                backgroundImage: GRAIN_URL,
                backgroundRepeat: 'repeat',
                backgroundSize: '256px 256px',
                opacity: 0.22,
                mixBlendMode: 'overlay',
              }} />
            )}
          </>
        ) : (
          <GridPlaceholder width="100%" height="100%" variant="dark"
            label="CENTRO" coords="768, 0 // 1536 x 1024" />
        )}
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

// ─── Ícone de alerta persistente (nota salva) ────────────────────────────────
function FbAlert() {
  return (
    <div style={{
      position: 'absolute', top: 10, right: 10,
      width: 30, height: 30, borderRadius: '50%',
      background: '#F5A623',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 4, pointerEvents: 'none',
    }}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
        <path d="M12 4L21.5 20.5H2.5L12 4Z"
          stroke="#2d2e2f" strokeWidth="2.4"
          strokeLinejoin="round" strokeLinecap="round"/>
        <line x1="12" y1="10" x2="12" y2="15.5"
          stroke="#2d2e2f" strokeWidth="2.4" strokeLinecap="round"/>
        <circle cx="12" cy="18.5" r="1.2" fill="#2d2e2f"/>
      </svg>
    </div>
  )
}

// ─── Section: Tela genérica ────────────────────────────────────────────────────
function SectionBlock({ block, fb = {}, onFeedback }) {
  const ref    = useRef(null)
  const p      = useEnter(ref, { offset: 0.2 })
  const mobile = useIsMobile()

  // Migração: string → {src, ar}
  const rawImgs = block.images?.length ? block.images : (block.image ? [block.image] : [])
  const images  = rawImgs.map(i => typeof i === 'string' ? { src: i, ar: '16/9' } : i)
  const n       = images.length
  const hasText = !!(block.title || block.subtitle || block.tagA || block.tagB || block.about)

  const gridCols = (count, mob) => {
    if (mob) {
      if (count <= 1) return '1fr'
      if (count === 3) return 'repeat(3, 1fr)'
      return 'repeat(2, 1fr)'
    }
    if (count <= 1) return '1fr'
    if (count <= 3) return `repeat(${count}, 1fr)`
    if (count <= 4) return 'repeat(2, 1fr)'
    return 'repeat(3, 1fr)'
  }

  const fadeIn = { opacity: p, transition: 'opacity .6s ease, transform .6s ease' }

  // ── Full bleed: só imagens, sem texto ──────────────────────────────────────
  if (!hasText && n > 0) {
    const gap = mobile ? 6 : 8
    return (
      <section ref={ref} style={{ position: 'relative', zIndex: 1, background: '#000',
        padding: mobile ? '12px 5%' : '20px 5%' }}>
        <div style={{ ...fadeIn, transform: `translateY(${(1-p)*40}px)`,
          display: 'grid', gridTemplateColumns: gridCols(n, mobile), gap }}>
          {images.map((img, i) => {
            const fbKey = `${block.id}_${i}`
            const hasFb = !!fb[fbKey]
            return (
              <div key={i} className="img-mask" style={{ overflow: 'hidden', cursor: 'pointer',
                borderRadius: mobile ? 10 : 14,
                ...(n === 1 ? { minHeight: mobile ? '45vh' : '65vh' } : { aspectRatio: img.ar || '16/9' }) }}
                onClick={() => onFeedback?.(fbKey, img.src, img.ar)}>
                <img src={img.src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                <div className="img-overlay">
                  <button className="img-btn-feedback" type="button"
                    onClick={e => { e.stopPropagation(); onFeedback?.(fbKey, img.src, img.ar) }}>
                    Feedback
                  </button>
                </div>
                {hasFb && <FbAlert />}
              </div>
            )
          })}
        </div>
      </section>
    )
  }

  // ── Texto + imagens (ou placeholder) ──────────────────────────────────────
  return (
    <section ref={ref} style={{ position: 'relative', zIndex: 1, background: '#000', color: '#fff',
      padding: mobile ? '48px 20px 64px' : '80px 32px 120px' }}>
      <div style={{ display: 'grid',
        gridTemplateColumns: mobile ? '1fr' : (hasText ? 'minmax(0,20%) minmax(0,80%)' : 'minmax(0,1fr)'),
        gap: mobile ? 24 : 32, alignItems: 'flex-start' }}>

        {hasText && (
          <div style={{ minWidth: 0, paddingTop: 8, overflow: 'hidden',
            ...fadeIn, transform: `translateX(${(1-p)*-40}px)` }}>
            {block.title && (
              <h2 style={{ margin: 0,
                fontSize: mobile ? 'clamp(14px,4vw,22px)' : 'clamp(13px,1.4vw,22px)',
                fontWeight: 500, letterSpacing: '-0.02em', lineHeight: 1.1,
                overflowWrap: 'break-word', wordBreak: 'break-word' }}>
                {block.title}
              </h2>
            )}
            {block.subtitle && (
              <p style={{ margin: '6px 0 14px',
                fontSize: mobile ? 'clamp(11px,2.5vw,14px)' : 'clamp(11px,0.85vw,14px)',
                color: 'rgba(255,255,255,0.7)', lineHeight: 1.4,
                overflowWrap: 'break-word' }}>
                {block.subtitle}
              </p>
            )}
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
              {block.tagA && <span style={{ ...pillLight, fontSize: 9, padding: '3px 8px' }}>{block.tagA}</span>}
              {block.tagB && <span style={{ ...pillDark,  fontSize: 9, padding: '3px 8px' }}>{block.tagB}</span>}
            </div>
            {block.about && (
              <div className="mono" style={{ marginTop: 16 }}>
                <div style={{ fontSize: 9, letterSpacing: '0.14em', fontWeight: 700, marginBottom: 6 }}>ABOUT</div>
                <p style={{ margin: 0, fontSize: 10, lineHeight: 1.55, letterSpacing: '0.04em',
                  textTransform: 'uppercase', color: 'rgba(255,255,255,0.85)',
                  overflowWrap: 'break-word' }}>
                  {block.about}
                </p>
              </div>
            )}
          </div>
        )}

        <div style={{ ...fadeIn, transform: `translateY(${(1-p)*60}px)` }}>
          {n > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: gridCols(n, mobile), gap: mobile ? 6 : 8 }}>
              {images.map((img, i) => {
                const fbKey = `${block.id}_${i}`
                const hasFb = !!fb[fbKey]
                return (
                  <div key={i} className="img-mask" style={{ aspectRatio: img.ar || '16/9', borderRadius: mobile ? 10 : 14, overflow: 'hidden', cursor: 'pointer' }}
                    onClick={() => onFeedback?.(fbKey, img.src, img.ar)}>
                    <img src={img.src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                    <div className="img-overlay">
                      <button className="img-btn-feedback" type="button"
                        onClick={e => { e.stopPropagation(); onFeedback?.(fbKey, img.src, img.ar) }}>
                        Feedback
                      </button>
                    </div>
                    {hasFb && <FbAlert />}
                  </div>
                )
              })}
            </div>
          ) : (
            <div style={{ aspectRatio: '16/9', borderRadius: mobile ? 12 : 16, overflow: 'hidden' }}>
              <GridPlaceholder width="100%" height="100%" variant="dark" label="IMAGE" coords="1920 × 1080" radius={mobile ? 12 : 16} />
            </div>
          )}
        </div>
      </div>
    </section>
  )
}


// ─── FooterHeading: auto-fit ao container, última linha em itálico ───────────
function FooterHeading({ text, color, mobile, maxFontPx = 600 }) {
  const wrapRef = useRef(null)
  const testRef = useRef(null)
  const [fs, setFs]   = useState(80)
  const ff = '"Helvetica Neue", Helvetica, Arial, sans-serif'

  // Desktop: divide por \n | Mobile: divide por palavra (uma por linha)
  const lines  = mobile
    ? text.split(/[\n ]+/).filter(Boolean)
    : text.split('\n').filter(Boolean)
  // Linha mais larga (por nº de chars) determina o tamanho
  const widest = lines.reduce((a, b) => b.length > a.length ? b : a, '')

  useLayoutEffect(() => {
    if (!wrapRef.current || !testRef.current) return
    const fit = () => {
      const w = wrapRef.current.getBoundingClientRect().width - 2
      let lo = 12, hi = maxFontPx, best = 12
      for (let i = 0; i < 24; i++) {
        const mid = (lo + hi) / 2
        testRef.current.style.fontSize = mid + 'px'
        if (testRef.current.getBoundingClientRect().width <= w) { best = mid; lo = mid }
        else hi = mid
      }
      setFs(Math.floor(best))
    }
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(wrapRef.current)
    return () => ro.disconnect()
  }, [widest, maxFontPx])

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <span ref={testRef} style={{
        position: 'absolute', visibility: 'hidden', pointerEvents: 'none',
        whiteSpace: 'nowrap', fontWeight: 400, fontFamily: ff, letterSpacing: '-0.02em',
      }}>{widest}</span>
      {lines.map((line, i) => (
        <div key={i} style={{
          fontSize: fs, fontWeight: 400, color,
          fontStyle: i === lines.length - 1 ? 'italic' : 'normal',
          lineHeight: mobile ? 1.08 : 0.9, letterSpacing: '-0.02em',
          fontFamily: ff, whiteSpace: 'nowrap',
        }}>
          {line}
        </div>
      ))}
    </div>
  )
}

// ─── Footer ───────────────────────────────────────────────────────────────────
function Footer({ cfg }) {
  const ref    = useRef(null)
  const [vis, setVis] = useState(false)
  const mobile = useIsMobile(768)

  const CREAM = '#f0ead8'
  const LINE  = 'rgba(255,255,255,0.22)'
  const ff    = '"Helvetica Neue", Helvetica, Arial, sans-serif'
  const SIDE  = mobile ? 24 : 44
  const TOP   = mobile ? 28 : 44

  const heading  = cfg.footerHeading || 'WE CREATE\nTHE\nIMPOSSIBLE.'
  const sub      = cfg.footerSub     || '3D, Motion, vfx\nand AI Visual Production'
  const subLines = sub.split('\n')

  // ── Limite responsivo do heading desktop: TRESSDE cortado no máx 5% ──
  const [maxHFont, setMaxHFont] = useState(600)
  useLayoutEffect(() => {
    if (mobile) { setMaxHFont(600); return }
    const calc = () => {
      const vw = window.innerWidth, vh = window.innerHeight
      // estimativa da altura do TRESSDE (7 chars, Helvetica Neue 700)
      const tressdeH = 0.82 * (vw - 88) / (7 * 0.65)
      // espaço mínimo do spacer (clamp igual ao CSS)
      const spacerMin = Math.min(72, Math.max(28, vh * 0.05))
      // área disponível para o heading dentro de 90vh
      // 44(padding) + 72(topbar) + spacerMin + 1(linha) + 36(marginTop TRESSDE) + 95% TRESSDE
      const avail = vh * 0.9 - 44 - 72 - spacerMin - 37 - tressdeH * 0.95
      const nLines = heading.split('\n').filter(Boolean).length || 3
      setMaxHFont(Math.max(60, Math.floor(avail / (nLines * 0.9))))
    }
    calc()
    window.addEventListener('resize', calc)
    return () => window.removeEventListener('resize', calc)
  }, [mobile, heading])

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([e]) => { setVis(e.isIntersecting) },
      { threshold: 0.04 }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  const ease = 'cubic-bezier(0.22,1,0.36,1)'
  const anim = (delay, y = 28) => ({
    opacity: vis ? 1 : 0,
    transform: vis ? 'translateY(0)' : `translateY(${y}px)`,
    transition: `opacity 0.75s ${delay}ms ${ease}, transform 0.75s ${delay}ms ${ease}`,
  })

  return (
    <footer ref={ref} style={{
      position: 'relative', zIndex: 3, overflow: 'hidden',
      height: mobile ? '90svh' : '90vh',
      background: cfg.heroBg, color: CREAM,
      borderTopLeftRadius: 32, borderTopRightRadius: 32,
      padding: `${TOP}px ${SIDE}px 0`,
      fontFamily: ff,
    }}>

      {mobile ? (
        /* ── MOBILE — 3 grupos distribuídos pela altura do rodapé ─────── */
        <div style={{ display: 'flex', flexDirection: 'column',
          height: '100%', justifyContent: 'space-between' }}>

          {/* ① Top bar centralizado */}
          <div style={{ ...anim(0), textAlign: 'center', fontSize: 12,
            fontWeight: 600, letterSpacing: '0.15em' }}>
            {cfg.footerLeft} / {cfg.footerCenter}
          </div>

          {/* ② Heading — word per line */}
          <div style={anim(80)}>
            <FooterHeading text={heading} color={CREAM} mobile />
          </div>

          {/* ③ Bloco inferior: linha + info + linha + TRESSDE */}
          <div>
            <div style={{ ...anim(200), height: 1, background: LINE, marginBottom: 24 }} />

            <div style={{ ...anim(280), marginBottom: 20 }}>
              {subLines.map((l, i) => (
                <div key={i} style={{ fontSize: 15, lineHeight: 1.55 }}>{l}</div>
              ))}
            </div>

            <div style={{ ...anim(360), display: 'flex', justifyContent: 'space-between',
              alignItems: 'center', marginBottom: 20 }}>
              <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.04em' }}>
                {cfg.footerRight}
              </span>
              <ArrowToTop size={20} color={CREAM} />
            </div>

            <div style={{ height: 1, background: LINE, marginBottom: 28 }} />

            <div style={{ ...anim(500, 60), lineHeight: 0.82,
              marginLeft: -SIDE, marginRight: -SIDE, marginBottom: '-0.3em' }}>
              <FitTitle text={cfg.footerStudio} weight={700} max={700} />
            </div>
          </div>
        </div>

      ) : (
        /* ── DESKTOP — flex column, TRESSDE travado na base ─────────────── */
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          {/* Top bar */}
          <div style={{ ...anim(0), display: 'flex', justifyContent: 'space-between',
            alignItems: 'center', marginBottom: 52,
            fontSize: 13, fontWeight: 600, letterSpacing: '0.15em' }}>
            <span>{cfg.footerLeft} / {cfg.footerCenter}</span>
            <span>{cfg.footerRight}</span>
          </div>

          {/* Heading esquerda + subtítulo/seta direita */}
          <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: 40, flexShrink: 0 }}>
            <div style={anim(100)}>
              <FooterHeading text={heading} color={CREAM} mobile={false} maxFontPx={maxHFont} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column',
              justifyContent: 'space-between', alignItems: 'flex-end',
              paddingTop: 4, minHeight: 140 }}>
              <div style={{ ...anim(220), textAlign: 'right' }}>
                {subLines.map((l, i) => (
                  <div key={i} style={{ fontSize: 16, lineHeight: 1.55 }}>{l}</div>
                ))}
              </div>
              <div style={anim(380)}>
                <ArrowToTop size={22} color={CREAM} />
              </div>
            </div>
          </div>

          {/* Spacer — respiro mínimo entre heading e linha/TRESSDE */}
          <div style={{ flex: 1, minHeight: 'clamp(28px, 5vh, 72px)' }} />

          {/* Única linha horizontal no desktop — logo acima do TRESSDE */}
          <div style={{ flex: '0 0 1px', background: LINE }} />

          {/* Nome do estúdio — 36px abaixo da linha, leve crop na base */}
          <div style={{
            lineHeight: 0.82, color: CREAM,
            marginTop: 36, flexShrink: 0,
            marginLeft: -SIDE, marginRight: -SIDE,
            marginBottom: '-0.12em',
            ...anim(440, 60),
          }}>
            <FitTitle text={cfg.footerStudio} weight={700} max={700} />
          </div>
        </div>
      )}
    </footer>
  )
}

// ─── Feedback storage (por slug do projeto) ───────────────────────────────────
function useFeedback() {
  const slug = ((window.location.hash || '').match(/p=([^&]+)/) || [])[1] || '_local'
  const key  = `tressde:fb:${slug}`
  const [fb, setFb] = useState(() => {
    try { return JSON.parse(localStorage.getItem(key) || '{}') } catch { return {} }
  })
  const save = (imgKey, text) => {
    const next = { ...fb, [imgKey]: text }
    setFb(next)
    try { localStorage.setItem(key, JSON.stringify(next)) } catch {}
  }
  return { fb, save }
}

// ─── Lightbox: imagem fullscreen + painel de feedback ────────────────────────
function FeedbackPanelContent({ draft, onChange, onSave, onClose, mobile }) {
  const ff = '"Helvetica Neue", Helvetica, Arial, sans-serif'
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%',
      padding: mobile ? '14px 16px 20px' : '20px', gap: 12, fontFamily: ff }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <span style={{ color: '#fff', fontSize: 13, fontWeight: 700, letterSpacing: '-0.01em' }}>Feedback</span>
        <button onClick={onClose} style={{ background: 'none', border: 'none',
          color: 'rgba(255,255,255,0.45)', cursor: 'pointer', fontSize: 16,
          lineHeight: 1, padding: 4, fontFamily: ff }}>✕</button>
      </div>
      <textarea
        autoFocus
        value={draft}
        onChange={e => onChange(e.target.value)}
        placeholder="Escreva sua anotação sobre esta imagem…"
        style={{
          flex: 1, width: '100%', minHeight: mobile ? 80 : 0,
          background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 8, color: '#fff', fontSize: 13, lineHeight: 1.65,
          padding: '10px 12px', resize: mobile ? 'vertical' : 'none',
          outline: 'none', fontFamily: ff,
        }}
      />
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexShrink: 0 }}>
        <button onClick={onClose} style={{
          padding: '8px 16px', borderRadius: 8,
          border: '1px solid rgba(255,255,255,0.2)',
          background: 'transparent', color: 'rgba(255,255,255,0.65)',
          cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: ff,
        }}>Cancelar</button>
        <button onClick={onSave} style={{
          padding: '8px 20px', borderRadius: 8, border: 'none',
          background: '#0015cf', color: '#fff',
          cursor: 'pointer', fontSize: 12, fontWeight: 700, fontFamily: ff,
        }}>Salvar</button>
      </div>
    </div>
  )
}

function ImageLightbox({ src, ar, fbKey, fb, onSave, onClose }) {
  const mobile = useIsMobile(768)
  const [draft, setDraft] = useState(fb[fbKey] || '')
  const [dims, setDims] = useState({ vw: window.innerWidth, vh: window.innerHeight })

  useEffect(() => {
    const onR = () => setDims({ vw: window.innerWidth, vh: window.innerHeight })
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('resize', onR)
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('resize', onR)
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [onClose])

  const handleSave = () => onSave(fbKey, draft)

  // Desktop: compute exact px dimensions from AR and viewport
  const PANEL_W = 320, GAP = 20, PAD = 64
  const maxH = dims.vh * 0.92
  const maxImgW = dims.vw - PANEL_W - GAP - PAD
  const [arW, arH] = (ar || '16/9').split('/').map(Number)
  const ratio = arW / arH
  let imgW = maxH * ratio
  let imgH = maxH
  if (imgW > maxImgW) { imgW = maxImgW; imgH = imgW / ratio }
  imgW = Math.round(imgW); imgH = Math.round(imgH)

  return createPortal(
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.92)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: mobile ? 0 : 32,
    }}>
      {mobile ? (
        /* ── Mobile: imagem + painel abaixo (sem sobreposição) ── */
        <div onClick={e => e.stopPropagation()} style={{
          width: '90%', display: 'flex', flexDirection: 'column',
          maxHeight: '100vh', overflow: 'hidden', borderRadius: 14,
        }}>
          <div style={{ width: '100%', aspectRatio: ar || '16/9', overflow: 'hidden', flexShrink: 0 }}>
            <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          </div>
          <div style={{
            background: '#111', borderTop: '1px solid rgba(255,255,255,0.12)',
            flexShrink: 0, overflowY: 'auto',
          }}>
            <FeedbackPanelContent
              draft={draft} onChange={setDraft}
              onSave={handleSave} onClose={onClose} mobile
            />
          </div>
        </div>
      ) : (
        /* ── Desktop: painel ESQUERDO (50% da altura da imagem) + imagem DIREITA ── */
        <div onClick={e => e.stopPropagation()} style={{ display: 'flex', alignItems: 'center', gap: GAP }}>
          <div style={{
            width: PANEL_W, height: Math.max(200, Math.round(imgH * 0.5)), flexShrink: 0,
            background: '#111', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 12, overflow: 'hidden',
            display: 'flex', flexDirection: 'column',
          }}>
            <FeedbackPanelContent
              draft={draft} onChange={setDraft}
              onSave={handleSave} onClose={onClose} mobile={false}
            />
          </div>
          <div style={{ width: imgW, height: imgH, borderRadius: 12, overflow: 'hidden', flexShrink: 0 }}>
            <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          </div>
        </div>
      )}
    </div>,
    document.body
  )
}

// ─── Default config ───────────────────────────────────────────────────────────
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

  blocks: [
    {
      id: 'block-1',
      title: 'Tela 1',
      subtitle: '',
      tagA: '',
      tagB: '',
      about: '',
      images: [],
    },
  ],

  footerLeft:    'TSSD',
  footerCenter:  'O Boticário',
  footerRight:   '2026',
  footerStudio:  'TRESSDE',
  footerHeading: 'WE CREATE\nTHE\nIMPOSSIBLE.',
  footerSub:     '3D, Motion, vfx\nand AI Visual Production',
}

// ─── useCfg: reads config from sessionStorage / localStorage#slug / postMessage ─
function readFromStorage() {
  try {
    const hash = (window.location.hash || '').match(/p=([^&]+)/)
    if (hash) {
      const map = JSON.parse(localStorage.getItem('tressde:projects') || '{}')
      if (map[hash[1]]?.cfg) return { ...DEFAULT_CFG, ...map[hash[1]].cfg }
    }
    const sess = sessionStorage.getItem('tressde:previewCfg')
    if (sess) return { ...DEFAULT_CFG, ...JSON.parse(sess) }
  } catch (_) {}
  return null
}

function useCfg() {
  const [cfg, setCfg] = useState(() => readFromStorage() || DEFAULT_CFG)

  useEffect(() => {
    const reload = () => {
      const next = readFromStorage()
      if (next) setCfg(next)
    }

    const onMsg = (e) => {
      if (e.data?.type === '__apr_cfg' && e.data.cfg)
        setCfg(c => ({ ...c, ...e.data.cfg }))
    }
    const onStorage = (e) => { if (e.key === 'tressde:projects') reload() }

    window.addEventListener('message', onMsg)
    window.addEventListener('storage', onStorage)
    window.addEventListener('focus', reload)
    try { window.parent?.postMessage({ type: '__apr_ready' }, '*') } catch (_) {}

    return () => {
      window.removeEventListener('message', onMsg)
      window.removeEventListener('storage', onStorage)
      window.removeEventListener('focus', reload)
    }
  }, [])

  return cfg
}

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  const cfg = useCfg()
  const { fb, save } = useFeedback()
  const [textBottom, setTextBottom] = useState(null)
  const [vh, setVh] = useState(window.innerHeight)
  const [bannerProgress, setBannerProgress] = useState(0)
  const [lightbox, setLightbox] = useState(null)  // { fbKey, src, ar }
  const footerRef = useRef(null)
  const [footerFade, setFooterFade] = useState(0)

  useEffect(() => {
    const onR = () => setVh(window.innerHeight)
    window.addEventListener('resize', onR)
    return () => window.removeEventListener('resize', onR)
  }, [])

  // Scroll-driven fade: tracks when footer enters viewport
  useEffect(() => {
    let raf = null
    let ticking = false
    const update = () => {
      if (!footerRef.current) return
      const rect = footerRef.current.getBoundingClientRect()
      const currentVh = window.innerHeight
      setFooterFade(clamp((currentVh - rect.top) / (currentVh * 0.6), 0, 1))
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
  }, [])

  const isMob = useIsMobile(768)
  const GAP = vh * (isMob ? 0.04 : 0.10)
  const spacerHeight = textBottom != null ? textBottom + GAP : vh * 0.52

  const handleFeedback = (fbKey, src, ar) => setLightbox({ fbKey, src, ar })
  const handleLightboxSave = (fbKey, text) => { save(fbKey, text); setLightbox(null) }

  return (
    <div>
      <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100vh', zIndex: 1 }}>
        <HeroKrishna onTextBottom={setTextBottom} cfg={cfg} />
      </div>

      <div style={{ height: spacerHeight }} />

      <div style={{ position: 'relative', zIndex: 2 }}>
        <BannerCard onProgress={setBannerProgress} cfg={cfg} />
        {/* Todos os blocos sobem juntos com parallax 1.5×.
            Bloco 0 tem marginTop:-70vh para começar na borda do banner. */}
        <div style={{ transform: `translateY(${-bannerProgress * 35}vh)`, position: 'relative', zIndex: 2 }}>
          {(cfg.blocks || []).map((block, i) => (
            <div key={block.id} style={{ background: '#000', marginTop: i === 0 ? '-70vh' : 0 }}>
              <SectionBlock block={block} fb={fb} onFeedback={handleFeedback} />
            </div>
          ))}
          {/* Solid black spacer — last section is 100% visible before footer enters */}
          <div style={{ height: '30vh', background: '#000', pointerEvents: 'none' }} />
          {/* Scroll-driven overlay — fades last section to black as footer enters */}
          <div style={{
            position: 'absolute', inset: 0,
            background: '#000', opacity: footerFade,
            pointerEvents: 'none', zIndex: 5,
          }} />
        </div>
        {/* Footer wrapper: background #000 garante que os cantos arredondados do rodapé
            apareçam contra preto, não contra o Hero (mesma cor) atrás */}
        <div ref={footerRef} style={{ marginTop: `calc(-${bannerProgress * 35}vh)`, background: '#000' }}>
          <Footer cfg={cfg} />
        </div>
      </div>

      {lightbox && (
        <ImageLightbox
          src={lightbox.src}
          ar={lightbox.ar}
          fbKey={lightbox.fbKey}
          fb={fb}
          onSave={handleLightboxSave}
          onClose={() => setLightbox(null)}
        />
      )}
    </div>
  )
}
