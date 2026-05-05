import { useNavigate } from 'react-router-dom'

const TOOLS = [
  {
    id: 'prompt',
    path: '/studio2',
    emoji: '✦',
    name: 'Prompt Studio',
    tag: 'ENGENHARIA · PROMPT',
    desc: 'Gere e refine prompts cinematográficos com IA para Midjourney, Stable Diffusion, Sora e Kling.',
    accent: '#7dd4f8',
    rgb: '125,212,248',
    dark: '#051a26',
    features: ['4 geradores', 'Chat de refinamento', 'Biblioteca de exemplos'],
  },
  {
    id: 'image',
    path: '/image',
    emoji: '🖼️',
    name: 'Image Studio',
    tag: 'GERAÇÃO · IMAGEM',
    desc: 'Gere imagens cinematográficas com Nano Banana, Soul, Flux, Seedream e mais.',
    accent: '#e879f9',
    rgb: '232,121,249',
    dark: '#1a0022',
    features: ['8 modelos Higgsfield', 'Aspect ratio livre', 'Até 4 imagens'],
  },
  {
    id: 'video',
    path: '/video',
    emoji: '🎞️',
    name: 'Video Studio',
    tag: 'GERAÇÃO · VÍDEO',
    desc: 'Gere vídeos cinemáticos com Kling 3.0, Seedance, Google Veo e mais.',
    accent: '#fb923c',
    rgb: '251,146,60',
    dark: '#1a0900',
    features: ['6 modelos Higgsfield', 'Duração configurável', 'Até 15 segundos'],
  },
]

export default function Hub() {
  const navigate = useNavigate()

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0c', color: '#edecea', fontFamily: "'Inter', sans-serif" }}>

      {/* Header */}
      <header style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '16px 40px',
        borderBottom: '1px solid rgba(255,255,255,.05)',
        background: 'rgba(10,10,12,.9)',
        backdropFilter: 'blur(16px)',
        position: 'sticky', top: 0, zIndex: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            fontSize: '20px', fontWeight: 900, letterSpacing: '-0.03em',
            background: 'linear-gradient(135deg, rgba(255,255,255,.92) 0%, rgba(255,255,255,.4) 100%)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>TSD</div>
          <div style={{ width: 1, height: 16, background: 'rgba(255,255,255,.1)' }} />
          <div style={{ fontSize: 11, fontFamily: "'DM Mono', monospace", color: 'rgba(255,255,255,.3)', letterSpacing: '0.1em' }}>
            STUDIO HUB
          </div>
        </div>
        <div style={{
          fontSize: 9, fontFamily: "'DM Mono', monospace", color: 'rgba(255,255,255,.25)',
          background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.07)',
          padding: '4px 10px', borderRadius: 20, letterSpacing: '0.06em',
        }}>
          v2.0 · HIGGSFIELD AI
        </div>
      </header>

      {/* Hero */}
      <div style={{ textAlign: 'center', padding: '80px 40px 64px', position: 'relative' }}>
        {/* Subtle glow */}
        <div style={{
          position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
          width: 600, height: 300,
          background: 'radial-gradient(ellipse at top, rgba(125,212,248,.06) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />

        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          fontSize: 10, fontFamily: "'DM Mono', monospace", letterSpacing: '0.12em',
          color: '#7dd4f8',
          background: 'rgba(125,212,248,.08)', border: '1px solid rgba(125,212,248,.2)',
          padding: '5px 14px', borderRadius: 20, marginBottom: 24,
        }}>
          <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#7dd4f8', display: 'inline-block', animation: 'pulse 2s infinite' }} />
          SELECIONE UMA FERRAMENTA
        </div>

        <h1 style={{
          fontSize: 'clamp(36px, 6vw, 64px)', fontWeight: 800,
          letterSpacing: '-0.04em', lineHeight: 1.05, marginBottom: 16,
        }}>
          Seu studio de<br />
          <span style={{
            background: 'linear-gradient(135deg, #e879f9 0%, #7dd4f8 50%, #fb923c 100%)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>
            criação com IA.
          </span>
        </h1>
        <p style={{ fontSize: 15, color: 'rgba(255,255,255,.38)', lineHeight: 1.7, maxWidth: 420, margin: '0 auto' }}>
          Gere imagens, vídeos e prompts cinematográficos com os melhores modelos do mercado.
        </p>
      </div>

      {/* Tools grid */}
      <div style={{ maxWidth: 1000, margin: '0 auto', padding: '0 40px 80px' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: 20,
        }}>
          {TOOLS.map(tool => (
            <button
              key={tool.id}
              onClick={() => navigate(tool.path)}
              style={{
                all: 'unset',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                gap: 20,
                padding: 28,
                borderRadius: 20,
                border: `1px solid rgba(255,255,255,.06)`,
                background: 'rgba(255,255,255,.02)',
                textAlign: 'left',
                position: 'relative',
                overflow: 'hidden',
                transition: 'border-color .2s, transform .2s, box-shadow .2s',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = `rgba(${tool.rgb},.3)`
                e.currentTarget.style.transform = 'translateY(-3px)'
                e.currentTarget.style.boxShadow = `0 12px 40px rgba(0,0,0,.4), 0 0 40px rgba(${tool.rgb},.06)`
                e.currentTarget.querySelector('.tool-glow').style.opacity = '1'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = 'rgba(255,255,255,.06)'
                e.currentTarget.style.transform = 'translateY(0)'
                e.currentTarget.style.boxShadow = 'none'
                e.currentTarget.querySelector('.tool-glow').style.opacity = '0'
              }}
            >
              {/* Glow overlay */}
              <div className="tool-glow" style={{
                position: 'absolute', inset: 0, pointerEvents: 'none', opacity: 0, transition: 'opacity .3s',
                background: `radial-gradient(ellipse at top left, rgba(${tool.rgb},.1) 0%, transparent 60%)`,
              }} />

              {/* Top row */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div style={{
                  width: 48, height: 48, borderRadius: 14,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 22,
                  background: `rgba(${tool.rgb},.1)`,
                  border: `1px solid rgba(${tool.rgb},.15)`,
                }}>
                  {tool.emoji}
                </div>
                <div style={{
                  fontSize: 9, fontFamily: "'DM Mono', monospace", letterSpacing: '0.08em',
                  color: tool.accent,
                  background: `rgba(${tool.rgb},.1)`,
                  border: `1px solid rgba(${tool.rgb},.2)`,
                  padding: '4px 8px', borderRadius: 20,
                }}>
                  {tool.tag}
                </div>
              </div>

              {/* Content */}
              <div>
                <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 8 }}>
                  {tool.name}
                </div>
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,.4)', lineHeight: 1.6 }}>
                  {tool.desc}
                </div>
              </div>

              {/* Features */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {tool.features.map(f => (
                  <span key={f} style={{
                    fontSize: 10, fontFamily: "'DM Mono', monospace",
                    color: 'rgba(255,255,255,.35)',
                    background: 'rgba(255,255,255,.04)',
                    border: '1px solid rgba(255,255,255,.07)',
                    padding: '3px 8px', borderRadius: 20,
                  }}>
                    {f}
                  </span>
                ))}
              </div>

              {/* CTA */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto' }}>
                <span style={{
                  fontSize: 12, fontWeight: 600,
                  color: tool.accent,
                }}>
                  Abrir studio
                </span>
                <span style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: 28, height: 28, borderRadius: 8,
                  background: `rgba(${tool.rgb},.12)`,
                  border: `1px solid rgba(${tool.rgb},.2)`,
                  fontSize: 13, color: tool.accent,
                }}>
                  ↗
                </span>
              </div>
            </button>
          ))}
        </div>

        {/* Extras section */}
        <div style={{ marginTop: 48 }}>
          <div style={{
            fontSize: 9, fontFamily: "'DM Mono', monospace", color: 'rgba(255,255,255,.2)',
            letterSpacing: '0.1em', textTransform: 'uppercase',
            display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20,
          }}>
            <span>outros geradores</span>
            <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,.05)' }} />
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {[
              { label: 'Nano Banana Classic', path: '/studio', badge: 'STUDIO' },
              { label: 'Kling 3.0 Omni', path: '/studio3', badge: 'VÍDEO PROMPT' },
            ].map(item => (
              <button key={item.path} onClick={() => navigate(item.path)} style={{
                all: 'unset', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 16px', borderRadius: 12,
                border: '1px solid rgba(255,255,255,.06)',
                background: 'rgba(255,255,255,.02)',
                transition: 'border-color .15s, background .15s',
              }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,.12)'; e.currentTarget.style.background = 'rgba(255,255,255,.04)' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,.06)'; e.currentTarget.style.background = 'rgba(255,255,255,.02)' }}
              >
                <span style={{ fontSize: 12, fontWeight: 500, color: 'rgba(255,255,255,.55)' }}>{item.label}</span>
                <span style={{
                  fontSize: 8, fontFamily: "'DM Mono', monospace", letterSpacing: '0.07em',
                  color: 'rgba(255,255,255,.3)',
                  background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.08)',
                  padding: '2px 6px', borderRadius: 10,
                }}>{item.badge}</span>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,.25)' }}>→</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer style={{
        textAlign: 'center', padding: '20px 40px',
        borderTop: '1px solid rgba(255,255,255,.04)',
        fontSize: 9, fontFamily: "'DM Mono', monospace", color: 'rgba(255,255,255,.18)', letterSpacing: '0.06em',
      }}>
        TSD STUDIO HUB · HIGGSFIELD AI · 2026
      </footer>
    </div>
  )
}
