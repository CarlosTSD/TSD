import { useState, useRef, useEffect } from 'react'

const PRESETS = [
  { id: 'arri35-anam-35', camera: 'ARRI Alexa 35', cameraType: 'DIGITAL', lens: 'Anamorphic lens', lensType: 'ANAMORPHIC', focal: '35mm', focalNum: '35', aperture: 'f/2.8', recommended: true },
  { id: 'arrilf-anam-40', camera: 'ARRI Alexa Mini LF', cameraType: 'DIGITAL', lens: 'Anamorphic lens', lensType: 'ANAMORPHIC', focal: '40mm', focalNum: '40', aperture: 'f/2', recommended: true },
  { id: 'arri-sphere-50', camera: 'ARRI Alexa', cameraType: 'DIGITAL', lens: 'Spherical lens', lensType: 'SPHERICAL', focal: '50mm', focalNum: '50', aperture: 'f/4', recommended: true },
  { id: 'venice2-prime-24', camera: 'Sony Venice 2', cameraType: 'DIGITAL', lens: 'Prime lens', lensType: 'PRIME', focal: '24mm', focalNum: '24', aperture: 'f/2', recommended: true },
  { id: 'red-cooke-85', camera: 'RED V-Raptor', cameraType: 'DIGITAL', lens: 'Cooke S4', lensType: 'SPHERICAL', focal: '85mm', focalNum: '85', aperture: 'f/2.8', recommended: false },
  { id: 'bm-prime-28', camera: 'Blackmagic URSA', cameraType: 'DIGITAL', lens: 'Prime lens', lensType: 'PRIME', focal: '28mm', focalNum: '28', aperture: 'f/1.8', recommended: false },
  { id: 'panavision-anam-65', camera: 'Panavision DXL2', cameraType: 'DIGITAL', lens: 'Anamorphic lens', lensType: 'ANAMORPHIC', focal: '65mm', focalNum: '65', aperture: 'f/4', recommended: false },
  { id: 'arri-zeiss-35', camera: 'ARRI Alexa', cameraType: 'DIGITAL', lens: 'Zeiss Supreme', lensType: 'SPHERICAL', focal: '35mm', focalNum: '35', aperture: 'f/1.5', recommended: false },
]

function CameraIcon({ size = 28 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <rect x="2" y="9" width="22" height="15" rx="2.5" stroke="currentColor" strokeWidth="1.4" fill="none" opacity="0.85" />
      <circle cx="13" cy="16.5" r="4.5" stroke="currentColor" strokeWidth="1.3" fill="none" />
      <circle cx="13" cy="16.5" r="2" fill="currentColor" opacity="0.4" />
      <rect x="7" y="6" width="5.5" height="3" rx="1" fill="currentColor" opacity="0.4" />
      <path d="M24 13 L29 11 L29 22 L24 20" stroke="currentColor" strokeWidth="1.3" fill="none" strokeLinejoin="round" opacity="0.7" />
      <circle cx="21.5" cy="10.5" r="1" fill="currentColor" opacity="0.45" />
    </svg>
  )
}

function LensIcon({ size = 28 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <ellipse cx="16" cy="16" rx="11" ry="11" stroke="currentColor" strokeWidth="1.4" fill="none" opacity="0.8" />
      <ellipse cx="16" cy="16" rx="7" ry="7" stroke="currentColor" strokeWidth="1" fill="none" opacity="0.45" />
      <ellipse cx="16" cy="16" rx="3.5" ry="3.5" stroke="currentColor" strokeWidth="1" fill="none" opacity="0.35" />
      <circle cx="16" cy="16" r="1.5" fill="currentColor" opacity="0.55" />
      <path d="M5 16h2.5M24.5 16H27M16 5v2.5M16 24.5V27" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" opacity="0.35" />
    </svg>
  )
}

function ApertureIcon({ size = 28 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <circle cx="16" cy="16" r="12" stroke="currentColor" strokeWidth="1.4" fill="none" opacity="0.8" />
      <circle cx="16" cy="16" r="7.5" stroke="currentColor" strokeWidth="1" fill="none" opacity="0.38" />
      <circle cx="16" cy="16" r="3" fill="currentColor" opacity="0.45" />
      <path d="M16 4L13.5 9.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round" opacity="0.4" />
      <path d="M25.2 9L20.5 11.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round" opacity="0.4" />
      <path d="M28 16H22" stroke="currentColor" strokeWidth="1" strokeLinecap="round" opacity="0.4" />
      <path d="M25.2 23L20.5 20.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round" opacity="0.4" />
      <path d="M16 28L13.5 22.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round" opacity="0.4" />
      <path d="M6.8 23L11.5 20.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round" opacity="0.4" />
      <path d="M4 16H10" stroke="currentColor" strokeWidth="1" strokeLinecap="round" opacity="0.4" />
      <path d="M6.8 9L11.5 11.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round" opacity="0.4" />
    </svg>
  )
}

function SetupRow({ setup, active, onSelect, showSave, onSave }) {
  const [hover, setHover] = useState(false)

  const iconColor = active
    ? 'rgba(255,255,255,0.88)'
    : hover
    ? 'rgba(255,255,255,0.55)'
    : 'rgba(255,255,255,0.28)'

  const focalColor = active
    ? 'rgba(255,255,255,0.88)'
    : hover
    ? 'rgba(255,255,255,0.55)'
    : 'rgba(255,255,255,0.28)'

  const rowBg = active
    ? 'rgba(255,255,255,0.048)'
    : hover
    ? 'rgba(255,255,255,0.024)'
    : 'transparent'

  const iconSize = active ? 34 : 26
  const focalSize = active ? 30 : 22

  return (
    <div
      onClick={onSelect}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        padding: active ? '14px 16px 12px' : '9px 16px',
        cursor: 'pointer',
        background: rowBg,
        borderBottom: '1px solid rgba(255,255,255,0.04)',
        transition: 'background 0.12s',
      }}
    >
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 90px 80px', gap: 8, alignItems: 'flex-start' }}>
        {/* Camera */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: active ? 5 : 0 }}>
          <div style={{ color: iconColor, display: 'flex', transition: 'color 0.12s' }}>
            <CameraIcon size={iconSize} />
          </div>
          {active && (
            <>
              <div style={{
                display: 'inline-block',
                fontSize: 7.5,
                fontFamily: 'var(--mono)',
                fontWeight: 700,
                color: 'rgba(255,255,255,0.4)',
                letterSpacing: '0.1em',
                background: 'rgba(255,255,255,0.07)',
                padding: '1.5px 6px',
                borderRadius: 4,
                textTransform: 'uppercase',
                alignSelf: 'flex-start',
              }}>
                {setup.cameraType}
              </div>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.78)', fontFamily: 'var(--sans)', lineHeight: 1.3 }}>
                {setup.camera}
              </div>
            </>
          )}
        </div>

        {/* Lens */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: active ? 5 : 0 }}>
          <div style={{ color: iconColor, display: 'flex', transition: 'color 0.12s' }}>
            <LensIcon size={iconSize} />
          </div>
          {active && (
            <>
              <div style={{
                display: 'inline-block',
                fontSize: 7.5,
                fontFamily: 'var(--mono)',
                fontWeight: 700,
                color: 'rgba(255,255,255,0.4)',
                letterSpacing: '0.1em',
                background: 'rgba(255,255,255,0.07)',
                padding: '1.5px 6px',
                borderRadius: 4,
                textTransform: 'uppercase',
                alignSelf: 'flex-start',
              }}>
                {setup.lensType}
              </div>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.78)', fontFamily: 'var(--sans)', lineHeight: 1.3 }}>
                {setup.lens}
              </div>
            </>
          )}
        </div>

        {/* Focal */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: active ? 5 : 0 }}>
          <div style={{
            fontSize: focalSize,
            fontWeight: 700,
            color: focalColor,
            fontFamily: 'var(--mono)',
            lineHeight: 1,
            transition: 'color 0.12s, font-size 0.12s',
          }}>
            {setup.focalNum}
          </div>
          {active && (
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.38)', fontFamily: 'var(--mono)' }}>mm</div>
          )}
        </div>

        {/* Aperture */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: active ? 5 : 0 }}>
          <div style={{ color: iconColor, display: 'flex', transition: 'color 0.12s' }}>
            <ApertureIcon size={iconSize} />
          </div>
          {active && setup.aperture && (
            <div style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.78)', fontFamily: 'var(--mono)' }}>
              {setup.aperture}
            </div>
          )}
        </div>
      </div>

      {active && showSave && (
        <button
          onClick={e => { e.stopPropagation(); onSave() }}
          style={{
            marginTop: 10,
            background: 'transparent',
            border: 'none',
            color: 'rgba(255,255,255,0.38)',
            fontFamily: 'var(--mono)',
            fontSize: 11,
            cursor: 'pointer',
            padding: 0,
            letterSpacing: '0.04em',
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            transition: 'color 0.12s',
          }}
          onMouseEnter={e => e.currentTarget.style.color = 'rgba(255,255,255,0.7)'}
          onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.38)'}
        >
          + Save setup
        </button>
      )}
    </div>
  )
}

export default function CameraSetupPanel({ currentTags, onApplyPreset }) {
  const [isOpen, setIsOpen] = useState(false)
  const [tab, setTab] = useState('all')
  const [savedSetups, setSavedSetups] = useState([])
  const [activeId, setActiveId] = useState(null)
  const containerRef = useRef(null)
  const btnRef = useRef(null)
  const [panelPos, setPanelPos] = useState({ bottom: 80, left: 14 })

  const camTag = currentTags.cam?.[0] || ''
  const lensTag = currentTags.lens?.[0] || ''
  const focalTag = currentTags.focal?.[0] || ''
  const hasSetup = camTag || lensTag || focalTag

  const matchedId = [...PRESETS, ...savedSetups].find(
    p => p.camera === camTag && p.lens === lensTag && p.focal === focalTag
  )?.id

  const resolvedActiveId = activeId || matchedId

  useEffect(() => {
    if (!isOpen) return
    const handler = e => {
      if (containerRef.current && !containerRef.current.contains(e.target)) setIsOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [isOpen])

  function handleToggle() {
    if (btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect()
      setPanelPos({
        bottom: window.innerHeight - rect.top + 8,
        left: Math.min(rect.left, window.innerWidth - 596),
      })
    }
    setIsOpen(v => !v)
  }

  function applyPreset(setup) {
    setActiveId(setup.id)
    onApplyPreset(setup)
    setIsOpen(false)
  }

  function saveCurrentSetup(setup) {
    const newSetup = {
      ...setup,
      id: `saved-${Date.now()}`,
      saved: true,
    }
    setSavedSetups(prev => [...prev, newSetup])
    setActiveId(newSetup.id)
  }

  const allSetups = tab === 'all'
    ? [...PRESETS, ...savedSetups]
    : tab === 'recommended'
    ? PRESETS.filter(p => p.recommended)
    : savedSetups

  const activeSetup = allSetups.find(s => s.id === resolvedActiveId)

  return (
    <div ref={containerRef}>
      {/* Trigger pill */}
      <button
        ref={btnRef}
        onClick={handleToggle}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 9,
          padding: '7px 11px',
          background: isOpen ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.025)',
          border: `1px solid ${isOpen ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.07)'}`,
          borderRadius: 9,
          cursor: 'pointer',
          transition: 'all 0.15s',
          marginBottom: 8,
          textAlign: 'left',
        }}
        onMouseEnter={e => { if (!isOpen) e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
        onMouseLeave={e => { if (!isOpen) e.currentTarget.style.background = 'rgba(255,255,255,0.025)' }}
      >
        <div style={{ color: 'rgba(255,255,255,0.45)', display: 'flex', flexShrink: 0 }}>
          <CameraIcon size={16} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          {hasSetup ? (
            <>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#edecea', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.2 }}>
                {camTag || '—'}
              </div>
              <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.32)', fontFamily: 'var(--mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 2 }}>
                {[lensTag, focalTag].filter(Boolean).join(', ') || '—'}
              </div>
            </>
          ) : (
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.28)', fontFamily: 'var(--mono)' }}>
              Setup de câmera...
            </div>
          )}
        </div>
        <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.22)', flexShrink: 0, fontFamily: 'var(--mono)' }}>
          {isOpen ? '▲' : '▼'}
        </div>
      </button>

      {/* Floating panel */}
      {isOpen && (
        <div
          style={{
            position: 'fixed',
            bottom: panelPos.bottom,
            left: panelPos.left,
            width: 580,
            maxWidth: 'calc(100vw - 28px)',
            zIndex: 300,
            background: 'rgba(16,16,20,0.97)',
            backdropFilter: 'blur(28px)',
            WebkitBackdropFilter: 'blur(28px)',
            border: '1px solid rgba(255,255,255,0.09)',
            borderRadius: 16,
            overflow: 'hidden',
            boxShadow: '0 -8px 48px rgba(0,0,0,0.65), 0 0 0 1px rgba(255,255,255,0.035) inset',
          }}
        >
          {/* Header */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 14px 0',
            borderBottom: '1px solid rgba(255,255,255,0.05)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              {[
                ['all', 'All'],
                ['recommended', 'Recommended'],
                ['saved', savedSetups.length ? `Saved (${savedSetups.length})` : 'Saved'],
              ].map(([id, label]) => (
                <button
                  key={id}
                  onClick={() => setTab(id)}
                  style={{
                    padding: '6px 13px',
                    marginBottom: -1,
                    border: 'none',
                    borderRadius: '8px 8px 0 0',
                    background: tab === id ? 'rgba(255,255,255,0.93)' : 'transparent',
                    color: tab === id ? '#0a0a0c' : 'rgba(255,255,255,0.38)',
                    fontSize: 12,
                    fontWeight: tab === id ? 700 : 500,
                    cursor: 'pointer',
                    fontFamily: 'var(--sans)',
                    transition: 'all 0.12s',
                    letterSpacing: '-0.01em',
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
            <button
              onClick={() => setIsOpen(false)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'rgba(255,255,255,0.25)',
                cursor: 'pointer',
                fontSize: 13,
                padding: '4px 6px',
                borderRadius: 6,
                marginBottom: 6,
                transition: 'color 0.12s',
              }}
              onMouseEnter={e => e.currentTarget.style.color = 'rgba(255,255,255,0.6)'}
              onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.25)'}
            >
              ✕
            </button>
          </div>

          {/* Column headers */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 90px 80px',
            gap: 8,
            padding: '10px 16px 7px',
            borderBottom: '1px solid rgba(255,255,255,0.04)',
          }}>
            {['CAMERA', 'LENS', 'FOCAL LENGTH', 'APERTURE'].map(h => (
              <div key={h} style={{
                fontSize: 7.5,
                fontFamily: 'var(--mono)',
                fontWeight: 700,
                color: 'rgba(255,255,255,0.22)',
                letterSpacing: '0.1em',
              }}>
                {h}
              </div>
            ))}
          </div>

          {/* Rows */}
          <div style={{ maxHeight: 360, overflowY: 'auto' }}>
            {allSetups.length === 0 ? (
              <div style={{
                padding: '28px 16px',
                textAlign: 'center',
                color: 'rgba(255,255,255,0.2)',
                fontSize: 11,
                fontFamily: 'var(--mono)',
              }}>
                {tab === 'saved' ? 'Nenhum setup salvo ainda' : 'Nenhum setup disponível'}
              </div>
            ) : (
              allSetups.map(setup => (
                <SetupRow
                  key={setup.id}
                  setup={setup}
                  active={setup.id === resolvedActiveId}
                  onSelect={() => applyPreset(setup)}
                  showSave={setup.id === resolvedActiveId && !setup.saved}
                  onSave={() => saveCurrentSetup(setup)}
                />
              ))
            )}
          </div>

          {/* Footer summary */}
          {activeSetup && (
            <div style={{
              padding: '9px 16px',
              borderTop: '1px solid rgba(255,255,255,0.05)',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}>
              <div style={{ color: 'rgba(255,255,255,0.3)', display: 'flex' }}>
                <CameraIcon size={14} />
              </div>
              <div style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'rgba(255,255,255,0.45)' }}>
                <span style={{ color: 'rgba(255,255,255,0.7)', fontWeight: 600 }}>{activeSetup.camera}</span>
                {' · '}
                {activeSetup.lens}
                {activeSetup.focalNum ? `, ${activeSetup.focalNum} mm` : ''}
                {activeSetup.aperture ? `, ${activeSetup.aperture}` : ''}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
