import { useRef, useEffect } from 'react'

const CAMERAS = [
  'ARRI Alexa', 'ARRI Alexa 35', 'ARRI Alexa Mini LF',
  'RED V-Raptor', 'RED Komodo',
  'Sony FX9', 'Sony Venice 2',
  'Blackmagic URSA', 'Canon C70', 'Panavision DXL2',
]

const LENSES = [
  { value: 'Anamorphic lens', label: 'Anamorphic' },
  { value: 'Spherical lens', label: 'Spherical' },
  { value: 'Prime lens', label: 'Prime' },
  { value: 'Zoom lens', label: 'Zoom' },
  { value: 'Tilt-shift lens', label: 'Tilt-Shift' },
  { value: 'Macro lens', label: 'Macro' },
  { value: 'Vintage glass', label: 'Vintage Glass' },
  { value: 'Cooke S4', label: 'Cooke S4' },
  { value: 'Zeiss Supreme', label: 'Zeiss Supreme' },
  { value: 'Leica Summilux', label: 'Leica Summilux' },
]

const ANGLES = [
  'Low angle', 'High angle', "Bird's eye view", "Worm's eye view",
  'Dutch angle', 'POV shot', 'Overhead',
  'Front facing', 'Side profile', '3/4 front', '3/4 back', 'From behind',
]

export const LENS_DISPLAY = Object.fromEntries(LENSES.map(l => [l.value, l.label]))

function Chip({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '3.5px 10px',
        borderRadius: 20,
        border: `1px solid ${active ? 'rgba(245,200,66,0.45)' : 'rgba(255,255,255,0.08)'}`,
        background: active ? 'rgba(245,200,66,0.1)' : 'transparent',
        color: active ? '#f5c842' : 'rgba(255,255,255,0.48)',
        fontSize: 11,
        fontFamily: 'var(--sans)',
        fontWeight: active ? 600 : 400,
        cursor: 'pointer',
        transition: 'all 0.12s',
        whiteSpace: 'nowrap',
        lineHeight: 1.4,
      }}
    >
      {label}
    </button>
  )
}

function Section({ title, children }) {
  return (
    <div>
      <div style={{
        fontSize: 8,
        fontFamily: 'var(--mono)',
        fontWeight: 700,
        letterSpacing: '0.12em',
        color: 'rgba(255,255,255,0.25)',
        marginBottom: 8,
        textTransform: 'uppercase',
      }}>
        {title}
      </div>
      {children}
    </div>
  )
}

export default function CameraPopup({ pos, cam, lens, angle, onToggle, onClose }) {
  const ref = useRef(null)

  useEffect(() => {
    const handler = e => {
      if (ref.current && !ref.current.contains(e.target)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  return (
    <div
      ref={ref}
      style={{
        position: 'fixed',
        top: pos.top,
        left: Math.min(pos.left, window.innerWidth - 396),
        width: 380,
        maxHeight: '72vh',
        overflowY: 'auto',
        zIndex: 400,
        background: 'rgba(14,14,18,0.98)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 14,
        padding: '14px 14px 16px',
        boxShadow: '0 8px 40px rgba(0,0,0,0.65)',
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
      }}
    >
      <Section title="Câmera">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
          {CAMERAS.map(c => (
            <Chip
              key={c}
              label={c}
              active={cam === c}
              onClick={() => onToggle('cam', cam === c ? '' : c)}
            />
          ))}
        </div>
      </Section>

      <div style={{ height: 1, background: 'rgba(255,255,255,0.05)' }} />

      <Section title="Lente">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
          {LENSES.map(l => (
            <Chip
              key={l.value}
              label={l.label}
              active={lens === l.value}
              onClick={() => onToggle('lens', lens === l.value ? '' : l.value)}
            />
          ))}
        </div>
      </Section>

      <div style={{ height: 1, background: 'rgba(255,255,255,0.05)' }} />

      <Section title="Ângulo">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
          {ANGLES.map(a => (
            <Chip
              key={a}
              label={a}
              active={angle === a}
              onClick={() => onToggle('angle', angle === a ? '' : a)}
            />
          ))}
        </div>
      </Section>
    </div>
  )
}
