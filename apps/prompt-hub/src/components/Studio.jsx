import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import TagGroup from './TagGroup'
import CameraPopup, { LENS_DISPLAY } from './CameraPopup'

const LOOK_GROUPS = {
  light: { title: 'Iluminação', green: true, tags: ['Soft natural daylight','Golden hour','Blue hour','Overcast diffused','Hard dramatic','Backlit rim','Studio three-point','Warm ambient interior','Neon practical','Natural moonlight'] },
  grade: { title: 'Color Grade', tags: ['Teal and amber','Soft neutral','Warm cinematic','Cool desaturated','High contrast','Bleach bypass','Kodak film emulation','Fuji film emulation','Black and white'] },
  grain: { title: 'Textura & Grain', tags: ['Film grain','Clean digital','Heavy grain','16mm grain','Super 8 grain'] },
  style: { title: 'Estilo Visual', tags: ['Photorealistic','Cinematic','Commercial ad','Editorial fashion','Documentary','Concept art','3D render','Illustration'] },
  qual: { title: 'Qualidade & Output', tags: ['Ultra-detailed','Sharp focus','8K textures','High production value','Rich skin tones','No motion blur','No extra limbs','HDR','RAW look'] },
}

const DEFAULT_TAGS = {
  light: ['Soft natural daylight'],
  grade: ['Teal and amber'],
  grain: ['Film grain'],
  style: ['Photorealistic','Cinematic','Commercial ad'],
  qual: ['Ultra-detailed','Sharp focus','8K textures','High production value','Rich skin tones','No motion blur','No extra limbs'],
}

const HIGHLIGHT_KEYWORDS = ['ARRI','anamorphic','bokeh','shallow','golden hour','soft natural','cinematic','photorealistic','ultra-detailed','sharp focus','8K','4K','upright','bipedal','two legs','commercial','film grain','teal','amber','diffused','backlit']

function highlightText(text) {
  let h = text.replace(/(@image_\d+)/g, '<span class="pr">$1</span>')
  HIGHLIGHT_KEYWORDS.forEach(k => {
    h = h.replace(new RegExp(`\\b(${k})\\b`, 'gi'), '<span class="kw">$1</span>')
  })
  return h
}

async function callAPI(apiKey, system, message) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-allow-browser': 'true',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-5',
      max_tokens: 1000,
      system,
      messages: [{ role: 'user', content: message }],
    }),
  })
  const d = await r.json()
  if (d.error) throw new Error(d.error.message || 'Erro na API')
  return d.content?.find(b => b.type === 'text')?.text?.trim() || ''
}

export default function Studio() {
  const navigate = useNavigate()

  const [apiKey, setApiKey] = useState(() => localStorage.getItem('nb_apikey') || '')
  const [model, setModel] = useState('both')
  const [leftTab, setLeftTab] = useState('cena')
  const [rightTab, setRightTab] = useState('out')

  const [scene, setScene] = useState('')
  const [chars, setChars] = useState('')
  const [env, setEnv] = useState('')
  const [rules, setRules] = useState('')
  const [neg, setNeg] = useState('')
  const [ratio, setRatio] = useState('')
  const [res, setRes] = useState('')

  const [tags, setTags] = useState(DEFAULT_TAGS)
  const [refs, setRefs] = useState([])
  const [isDragging, setIsDragging] = useState(false)

  const [camPopup, setCamPopup] = useState(false)
  const [camPopupPos, setCamPopupPos] = useState({ top: 0, left: 0 })
  const camTriggerRef = useRef(null)

  const [prompts, setPrompts] = useState({ nb2: '', pro: '' })
  const [status, setStatus] = useState({ nb2: 'idle', pro: 'idle' })
  const [errors, setErrors] = useState({ nb2: '', pro: '' })
  const [hasOutput, setHasOutput] = useState(false)
  const [hist, setHist] = useState([])
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState(false)

  const fileInputRef = useRef(null)

  useEffect(() => {
    if (apiKey) localStorage.setItem('nb_apikey', apiKey)
  }, [apiKey])

  const keyStatus = apiKey.length === 0 ? '' : (apiKey.startsWith('sk-ant-') && apiKey.length > 20 ? 'ok' : 'bad')

  function toggleTag(group, tag, single) {
    setTags(prev => {
      const current = prev[group] || []
      if (single) return { ...prev, [group]: current.includes(tag) ? [] : [tag] }
      return { ...prev, [group]: current.includes(tag) ? current.filter(t => t !== tag) : [...current, tag] }
    })
  }

  function handleFiles(files) {
    Array.from(files).forEach(f => {
      if (!f.type.startsWith('image/')) return
      const reader = new FileReader()
      reader.onload = e => {
        setRefs(prev => [...prev, {
          id: Date.now() + Math.random(),
          name: f.name,
          url: e.target.result,
          role: '',
          pres: '',
          type: 'character',
        }])
      }
      reader.readAsDataURL(f)
    })
  }

  function updateRef(id, field, value) {
    setRefs(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r))
  }

  function openCamPopup() {
    if (camTriggerRef.current) {
      const rect = camTriggerRef.current.getBoundingClientRect()
      const spaceBelow = window.innerHeight - rect.bottom
      const popupH = 380
      if (spaceBelow < popupH && rect.top > popupH) {
        setCamPopupPos({ top: rect.top - popupH - 6, left: rect.left })
      } else {
        setCamPopupPos({ top: rect.bottom + 6, left: rect.left })
      }
    }
    setCamPopup(v => !v)
  }

  function buildRefsBlock() {
    if (!refs.length) return ''
    const lines = ['REFERENCE IMAGES:']
    refs.forEach((r, i) => {
      if (r.type === 'color') {
        lines.push(`  @image_${i + 1} = COLOR/LOOK REFERENCE — palette and visual style only`)
      } else {
        lines.push(`  @image_${i + 1} = ${r.role || 'reference image ' + (i + 1)} — PRESERVE: ${r.pres || 'all visual characteristics'}`)
      }
    })
    lines.push('')
    const charRefs = refs.filter(r => r.type !== 'color')
    const colorRefs = refs.filter(r => r.type === 'color')
    if (charRefs.length) {
      lines.push('CRITICAL: embed character @image_N tags inline next to each subject. Example: "the father lion @image_1 standing upright..."')
    }
    if (colorRefs.length) {
      const colorTags = refs
        .map((r, i) => ({ r, tag: `@image_${i + 1}` }))
        .filter(({ r }) => r.type === 'color')
        .map(({ tag }) => tag)
        .join(', ')
      lines.push(`COLOR REFS (${colorTags}): do NOT embed inline. Conclude prompt with: "Color palette and cinematic look inspired by ${colorTags}."`)
    }
    return lines.join('\n')
  }

  function buildMessage() {
    let msg = 'Generate an optimized image prompt:\n\n'
    if (scene) msg += `SCENE: ${scene}\n`
    if (chars) msg += `CHARACTERS: ${chars}\n`
    if (env) msg += `ENVIRONMENT: ${env}\n`
    const t = tags
    if (t.cam?.length) msg += `CAMERA BODY: ${t.cam.join(', ')}\n`
    if (t.lens?.length) msg += `LENS TYPE: ${t.lens.join(', ')}\n`
    if (t.angle?.length) msg += `CAMERA ANGLE: ${t.angle.join(', ')}\n`
    if (t.light?.length) msg += `LIGHTING: ${t.light.join(', ')}\n`
    if (t.grade?.length) msg += `COLOR GRADE: ${t.grade.join(', ')}\n`
    if (t.grain?.length) msg += `TEXTURE: ${t.grain.join(', ')}\n`
    if (t.style?.length) msg += `VISUAL STYLE: ${t.style.join(', ')}\n`
    if (t.qual?.length) msg += `QUALITY: ${t.qual.join(', ')}\n`
    if (ratio) msg += `ASPECT RATIO: ${ratio}\n`
    if (res) msg += `RESOLUTION: ${res}\n`
    if (rules) msg += `MANDATORY RULES: ${rules}\n`
    const rb = buildRefsBlock()
    if (rb) msg += `\n${rb}\n`
    if (neg) msg += `\nAVOID: ${neg}\n`
    return msg
  }

  function buildSystem(name, id) {
    const isPro = id === 'nano_banana_2'
    const hasRefs = refs.length > 0
    const hasColorRefs = refs.some(r => r.type === 'color')
    const colorTags = refs
      .map((r, i) => ({ r, tag: `@image_${i + 1}` }))
      .filter(({ r }) => r.type === 'color')
      .map(({ tag }) => tag)
      .join(', ')

    return `You are an expert AI image prompt engineer for ${name} (ID: ${id}) on Higgsfield AI, powered by Google.

MODEL:
${isPro ? 'Nano Banana Pro (nano_banana_2): ultimate quality, max detail, best for complex multi-character cinematic scenes, 4K, strong at maintaining visual consistency with @image_N reference tags.' : 'Nano Banana 2 (nano_banana_flash): fast, photorealistic, excellent for commercial cinematic work, lifestyle, fashion. Supports @image_N reference tags for consistency.'}

ESTABLISHED PROJECT STYLE (apply unless overridden):
This tool is used for a hyperrealistic cinematic project featuring anthropomorphic lion-people characters. The established look is: ARRI Alexa + anamorphic lens + soft diffused natural daylight (no harsh orange cast) + teal-and-amber color grade + film grain texture + shallow depth of field + photorealistic commercial quality.

CHARACTER RULES (always apply):
- All characters are anthropomorphic lion-people — human body proportions with lion head, mane, fur, and features
- Always bipedal — standing, walking, sitting upright on two legs
- Always fully clothed in human clothing
- Children/young characters = anthropomorphic lion-character kids with human child proportions — NEVER "lion cubs", NEVER quadruped, NEVER on all fours
- When referencing children, use: "young anthropomorphic lion-character children, bipedal, fully clothed, human-sized proportions"

${hasRefs ? `REFERENCE SYSTEM:\n${refs.length} image(s) uploaded, mapped to @image_N tags.\nCHARACTER REFS: place @image_N inline immediately after the subject they represent.\nCorrect: "the father lion @image_3 standing upright..." — Wrong: listing refs at the end.${hasColorRefs ? `\n\nCOLOR/LOOK REFS (${colorTags}): palette references ONLY. Do NOT embed inline. Conclude the prompt with: "Color palette and cinematic look inspired by ${colorTags}."` : ''}` : ''}

PROMPT STRUCTURE:
1. Shot type + camera + lens (if specified)
2. Main subject + @image_N tag inline
3. Secondary subjects + @image_N tags
4. Composition and spatial layout
5. Environment/background
6. Lighting
7. Color grade + texture
8. Style + quality closing tags${hasColorRefs ? '\n9. Color palette reference line' : ''}

RULES:
- Output ONLY the prompt — no labels, preamble, quotes, explanation
- English only
- 150–220 words
- Cinematic and specific — describe what the LENS sees
- Always state "standing upright on two legs" or "bipedal" for characters
- Character @image_N tags inline next to subject
- Do NOT include aspect ratio, resolution, or negative prompts`
  }

  async function generate() {
    if (busy) return
    if (!scene && !chars && !env) { alert('Preencha ao menos a descrição da cena!'); return }
    if (!apiKey || !apiKey.startsWith('sk-ant-')) {
      alert('Configure a API Key da Anthropic no campo no topo (começa com sk-ant-)')
      return
    }
    setBusy(true)
    setHasOutput(true)
    setRightTab('out')
    const doNb2 = model === 'both' || model === 'nb2'
    const doPro = model === 'both' || model === 'pro'
    setStatus({ nb2: doNb2 ? 'loading' : 'idle', pro: doPro ? 'loading' : 'idle' })
    setErrors({ nb2: '', pro: '' })
    setPrompts({ nb2: '', pro: '' })
    const msg = buildMessage()
    try {
      const [t1, t2] = await Promise.all([
        doNb2 ? callAPI(apiKey, buildSystem('Nano Banana 2', 'nano_banana_flash'), msg) : Promise.resolve(''),
        doPro ? callAPI(apiKey, buildSystem('Nano Banana Pro', 'nano_banana_2'), msg) : Promise.resolve(''),
      ])
      setStatus({ nb2: doNb2 ? 'done' : 'idle', pro: doPro ? 'done' : 'idle' })
      setPrompts({ nb2: t1, pro: t2 })
      setHist(prev => [{ time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }), scene: (scene || chars).substring(0, 70), nb2: t1, pro: t2 }, ...prev])
    } catch (e) {
      const errMsg = e.message || 'Erro desconhecido'
      setErrors({ nb2: doNb2 ? errMsg : '', pro: doPro ? errMsg : '' })
      setStatus({ nb2: doNb2 ? 'error' : 'idle', pro: doPro ? 'error' : 'idle' })
    }
    setBusy(false)
  }

  async function regen(m) {
    setStatus(prev => ({ ...prev, [m]: 'loading' }))
    setErrors(prev => ({ ...prev, [m]: '' }))
    const name = m === 'pro' ? 'Nano Banana Pro' : 'Nano Banana 2'
    const id = m === 'pro' ? 'nano_banana_2' : 'nano_banana_flash'
    try {
      const t = await callAPI(apiKey, buildSystem(name, id), buildMessage())
      setStatus(prev => ({ ...prev, [m]: 'done' }))
      setPrompts(prev => ({ ...prev, [m]: t }))
    } catch (e) {
      setErrors(prev => ({ ...prev, [m]: e.message }))
      setStatus(prev => ({ ...prev, [m]: 'error' }))
    }
  }

  function copyPrompt(m) {
    const text = prompts[m]
    if (!text) return
    const showToast = () => { setToast(true); setTimeout(() => setToast(false), 2200) }
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(showToast).catch(() => fallbackCopy(text, showToast))
    } else {
      fallbackCopy(text, showToast)
    }
  }

  function fallbackCopy(text, cb) {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.cssText = 'position:absolute;top:-9999px;left:-9999px;opacity:0'
    document.body.appendChild(ta)
    ta.focus(); ta.select()
    try { if (document.execCommand('copy')) cb() } catch {}
    document.body.removeChild(ta)
  }

  function loadHistory(item) {
    setPrompts({ nb2: item.nb2, pro: item.pro })
    setStatus({ nb2: item.nb2 ? 'done' : 'idle', pro: item.pro ? 'done' : 'idle' })
    setHasOutput(true)
    setRightTab('out')
  }

  const legendColors = ['#f5c842','#5de5aa','#a78bfa','#fb923c','#60a5fa','#f87171']
  const showNb2 = model === 'both' || model === 'nb2'
  const showPro = model === 'both' || model === 'pro'

  const camVal = tags.cam?.[0] || ''
  const lensVal = tags.lens?.[0] || ''
  const angleVal = tags.angle?.[0] || ''
  const lensLabel = LENS_DISPLAY[lensVal] || lensVal
  const hasCam = camVal || lensVal || angleVal

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      {/* HEADER */}
      <header className="studio-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => navigate('/')} style={{ background: 'transparent', border: '1px solid var(--b2)', borderRadius: 6, color: 'var(--mu)', fontFamily: 'var(--mono)', fontSize: 10, cursor: 'pointer', padding: '4px 10px' }}>← Hub</button>
          <div className="logo">
            <div className="logo-icon">🍌</div>
            <div>
              <div className="logo-name">Nano Banana Prompt Studio</div>
              <div className="logo-sub">@image_N · câmera · lentes · ângulos · look cinemático</div>
            </div>
          </div>
        </div>

        <div className="hcenter">
          <span className="hcenter-label">API KEY</span>
          <input type="password" placeholder="sk-ant-api03-..." value={apiKey} onChange={e => setApiKey(e.target.value)} />
          <div className={`key-dot ${keyStatus}`} />
        </div>

        <div className="mtoggle">
          {[['both','NB2 + Pro'],['nb2','Nano Banana 2'],['pro','Nano Banana Pro']].map(([val, label]) => (
            <button key={val} className={`mbtn${model === val ? ' active' : ''}`} onClick={() => setModel(val)}>{label}</button>
          ))}
        </div>
      </header>

      {/* WORKSPACE */}
      <div className="workspace" style={{ flex: 1, minHeight: 0 }}>
        {/* LEFT PANEL */}
        <div className="lpanel">
          <div className="ltabs">
            {[['cena','✏ Cena'],['look','🎨 Look']].map(([id, label]) => (
              <button key={id} className={`ltab${leftTab === id ? ' active' : ''}`} onClick={() => setLeftTab(id)}>
                {label}
                {id === 'cena' && refs.length > 0 && <span className="lbadge">{refs.length}</span>}
              </button>
            ))}
          </div>

          {/* ── CENA TAB ── */}
          <div className={`ltab-c${leftTab === 'cena' ? ' active' : ''}`}>
            <div className="field">
              <div className="flabel">Descrição da cena <span className="req">obrigatório</span></div>
              <textarea rows={4} placeholder="Ex: Pai leão de costas, dentro da sala..." value={scene} onChange={e => setScene(e.target.value)} />
              <div className="hint">{scene.length} caracteres</div>
            </div>

            <div className="field">
              <div className="flabel">Personagens</div>
              <textarea rows={2} placeholder="Ex: Pai leão adulto, camisa azul..." value={chars} onChange={e => setChars(e.target.value)} />
            </div>

            <div className="field">
              <div className="flabel">Cenário / Ambiente</div>
              <textarea rows={2} placeholder="Ex: Sala de estar moderna..." value={env} onChange={e => setEnv(e.target.value)} />
            </div>

            {/* CAMERA SELECTOR */}
            <div className="field">
              <div className="flabel">Câmera, Lente e Ângulo</div>
              <button
                ref={camTriggerRef}
                onClick={openCamPopup}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 7,
                  padding: '7px 10px',
                  background: camPopup ? 'rgba(245,200,66,0.05)' : 'var(--s2)',
                  border: `1px solid ${camPopup ? 'rgba(245,200,66,0.3)' : 'var(--b2)'}`,
                  borderRadius: 'var(--r)',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  textAlign: 'left',
                  minHeight: 36,
                }}
              >
                {hasCam ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, flex: 1, flexWrap: 'wrap' }}>
                    {camVal && (
                      <span style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--y)', background: 'var(--yd)', padding: '2px 8px', borderRadius: 20, border: '1px solid var(--yb)', whiteSpace: 'nowrap' }}>
                        {camVal}
                      </span>
                    )}
                    {lensVal && (
                      <span style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--m2)', background: 'var(--s3)', padding: '2px 8px', borderRadius: 20, border: '1px solid var(--b2)', whiteSpace: 'nowrap' }}>
                        {lensLabel}
                      </span>
                    )}
                    {angleVal && (
                      <span style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--m2)', background: 'var(--s3)', padding: '2px 8px', borderRadius: 20, border: '1px solid var(--b2)', whiteSpace: 'nowrap' }}>
                        {angleVal}
                      </span>
                    )}
                  </div>
                ) : (
                  <span style={{ fontSize: 11, color: 'var(--mu)', fontFamily: 'var(--mono)', flex: 1 }}>+ Câmera, Lente e Ângulo</span>
                )}
                <span style={{ fontSize: 8, color: 'var(--mu)', fontFamily: 'var(--mono)', flexShrink: 0 }}>
                  {camPopup ? '▲' : '▼'}
                </span>
              </button>
            </div>

            {/* INLINE REFS */}
            <div className="field">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div className="flabel">
                  Referências
                  {refs.length > 0 && <span className="lbadge" style={{ marginLeft: 5 }}>{refs.length}</span>}
                </div>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    padding: '2px 9px',
                    background: 'transparent',
                    border: '1px solid var(--b2)',
                    borderRadius: 20,
                    color: 'var(--m2)',
                    fontFamily: 'var(--mono)',
                    fontSize: 9,
                    cursor: 'pointer',
                    transition: 'all 0.12s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--yb)'; e.currentTarget.style.color = 'var(--y)' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--b2)'; e.currentTarget.style.color = 'var(--m2)' }}
                >
                  + Adicionar
                </button>
                <input ref={fileInputRef} type="file" style={{ display: 'none' }} multiple accept="image/*" onChange={e => { handleFiles(e.target.files); e.target.value = '' }} />
              </div>

              {refs.length === 0 ? (
                <div
                  className={`dropz${isDragging ? ' drag' : ''}`}
                  style={{ padding: '12px 10px', marginTop: 5 }}
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={e => { e.preventDefault(); setIsDragging(false); handleFiles(e.dataTransfer.files) }}
                >
                  <div style={{ fontSize: 14, marginBottom: 3 }}>📂</div>
                  <div className="dz-sub" style={{ fontSize: 9 }}>Arraste ou clique · personagens, paleta de cor, look</div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 5 }}>
                  {refs.map((r, i) => (
                    <RefCard
                      key={r.id}
                      ref_={r}
                      index={i}
                      onUpdate={updateRef}
                      onRemove={id => setRefs(prev => prev.filter(x => x.id !== id))}
                    />
                  ))}
                </div>
              )}
            </div>

            <div className="hr" />

            <div className="field">
              <div className="flabel">Regras & restrições</div>
              <textarea rows={2} placeholder="Ex: Porta de vidro fechada..." value={rules} onChange={e => setRules(e.target.value)} />
            </div>
            <div className="field">
              <div className="flabel">Negative prompt</div>
              <textarea rows={2} placeholder="Ex: blurry, deformed, low quality..." value={neg} onChange={e => setNeg(e.target.value)} />
            </div>
          </div>

          {/* ── LOOK TAB ── */}
          <div className={`ltab-c${leftTab === 'look' ? ' active' : ''}`}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
              <div className="look-badge"><div className="look-dot" />Look padrão ativo</div>
              <span style={{ fontSize: 10, color: 'var(--mu)', fontFamily: 'var(--mono)' }}>projeto leão</span>
            </div>
            {Object.entries(LOOK_GROUPS).map(([key, { title, green, tags: tagList }]) => (
              <TagGroup key={key} title={title} group={key} tags={tagList} selected={tags[key] || []} onToggle={toggleTag} single={false} green={green} />
            ))}
            <div className="two">
              <select value={ratio} onChange={e => setRatio(e.target.value)}>
                <option value="">Aspect Ratio...</option>
                <option value="16:9">16:9 — Widescreen</option>
                <option value="9:16">9:16 — Vertical</option>
                <option value="1:1">1:1 — Quadrado</option>
                <option value="4:3">4:3 — Clássico</option>
                <option value="3:4">3:4 — Retrato</option>
                <option value="21:9">21:9 — Cinemascope</option>
                <option value="3:2">3:2 — Foto</option>
                <option value="2.39:1">2.39:1 — Anamorphic</option>
              </select>
              <select value={res} onChange={e => setRes(e.target.value)}>
                <option value="">Resolução...</option>
                <option value="1k">1K</option>
                <option value="2k">2K</option>
                <option value="4k">4K Ultra HD</option>
              </select>
            </div>
            <div className="tip">
              <div className="tip-i">🎬</div>
              <div>Look padrão: <strong style={{ color: 'var(--y)' }}>ARRI Alexa + Anamorphic + Soft natural daylight + Teal & Amber + Film grain</strong>.</div>
            </div>
          </div>

          <div className="gfooter">
            <button className="btn-gen" disabled={busy} onClick={generate}>
              {busy ? (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  <span className="spin" style={{ width: 11, height: 11, borderWidth: 2, borderColor: 'rgba(0,0,0,0.15)', borderTopColor: '#0a0a0c' }} />
                  Gerando...
                </span>
              ) : (
                <>✦ Gerar Prompts <span className="gen-arrow">→</span></>
              )}
            </button>
          </div>
        </div>

        {/* RIGHT PANEL */}
        <div className="rpanel">
          <div className="rtabs">
            {[['out','Prompts Gerados'],['hist','Histórico']].map(([id, label]) => (
              <button key={id} className={`rtab${rightTab === id ? ' active' : ''}`} onClick={() => setRightTab(id)}>{label}</button>
            ))}
          </div>
          <div className="rcontent">
            {rightTab === 'out' && (
              <>
                {!hasOutput ? (
                  <div className="emptyout">
                    <div className="empty-frame">
                      <div className="empty-frame-b" />
                      <div className="empty-label">Nano Banana Studio</div>
                      <div className="empty-title">O que você filmaria<br />com orçamento infinito?</div>
                      <div className="empty-sub">
                        Descreva a cena, configure câmera e look,<br />
                        adicione referências <strong>@image_N</strong> e clique<br />
                        <strong>Gerar Prompts</strong>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="outsec">
                    {refs.length > 0 && (
                      <div className="legend">
                        {refs.map((r, i) => (
                          <div key={r.id} className="legitem">
                            <span style={{ color: r.type === 'color' ? 'var(--p)' : legendColors[i % legendColors.length], fontWeight: 700 }}>
                              {r.type === 'color' ? '🎨' : `@image_${i + 1}`}
                            </span>
                            <span>{r.role || (r.type === 'color' ? 'cor/look' : 'sem papel')}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {showNb2 && <OutputCard name="Nano Banana 2" subId="nano_banana_flash · rápido & fotorrealista" pro={false} status={status.nb2} prompt={prompts.nb2} error={errors.nb2} onRegen={() => regen('nb2')} onCopy={() => copyPrompt('nb2')} />}
                    {showPro && <OutputCard name="Nano Banana Pro" subId="nano_banana_2 · qualidade máxima" pro status={status.pro} prompt={prompts.pro} error={errors.pro} onRegen={() => regen('pro')} onCopy={() => copyPrompt('pro')} />}
                  </div>
                )}
              </>
            )}

            {rightTab === 'hist' && (
              <div className="hlist">
                {hist.length === 0 ? (
                  <div className="emptyout" style={{ minHeight: 160 }}>
                    <div className="empty-frame" style={{ padding: '30px 50px' }}>
                      <div className="empty-frame-b" />
                      <div className="empty-label" style={{ marginBottom: 8 }}>Histórico</div>
                      <div className="empty-sub">Nenhuma geração ainda</div>
                    </div>
                  </div>
                ) : hist.map((h, i) => (
                  <div key={i} className="hcard" onClick={() => loadHistory(h)}>
                    <div className="hmeta">
                      <div className="htime">{h.time}</div>
                      <div className="hbadges">
                        {h.nb2 && <span className="hb nb2">NB2</span>}
                        {h.pro && <span className="hb pro">Pro</span>}
                      </div>
                    </div>
                    <div className="hprev">{h.scene}...</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {camPopup && (
        <CameraPopup
          pos={camPopupPos}
          cam={camVal}
          lens={lensVal}
          angle={angleVal}
          onToggle={(group, value) => toggleTag(group, value, true)}
          onClose={() => setCamPopup(false)}
        />
      )}

      <div className={`toast${toast ? ' show' : ''}`}>✓ Copiado!</div>
    </div>
  )
}

function RefCard({ ref_, index, onUpdate, onRemove }) {
  const isColor = ref_.type === 'color'
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '44px 1fr 20px',
      gap: 8,
      padding: '8px',
      background: 'var(--s2)',
      border: '1px solid var(--b2)',
      borderRadius: 'var(--r)',
      alignItems: 'start',
    }}>
      {/* Thumbnail */}
      <div style={{ width: 44, height: 44, borderRadius: 6, overflow: 'hidden', border: '1px solid var(--b2)', position: 'relative' }}>
        <img src={ref_.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          textAlign: 'center',
          background: 'rgba(0,0,0,0.78)',
          fontSize: 7, fontWeight: 700, fontFamily: 'var(--mono)',
          color: isColor ? 'var(--p)' : 'var(--y)',
          padding: '2px 0', letterSpacing: '0.04em',
        }}>
          {isColor ? '🎨' : `@img${index + 1}`}
        </div>
      </div>

      {/* Fields */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        {/* Type toggle */}
        <div style={{ display: 'flex', gap: 3 }}>
          {[['character', '👤 Personagem'], ['color', '🎨 Cor/Look']].map(([type, label]) => {
            const active = ref_.type === type
            const isColorType = type === 'color'
            return (
              <button
                key={type}
                onClick={() => onUpdate(ref_.id, 'type', type)}
                style={{
                  padding: '2px 7px',
                  borderRadius: 20,
                  border: `1px solid ${active ? (isColorType ? 'rgba(192,132,252,0.4)' : 'var(--yb)') : 'var(--b1)'}`,
                  background: active ? (isColorType ? 'var(--pd)' : 'var(--yd)') : 'transparent',
                  color: active ? (isColorType ? 'var(--p)' : 'var(--y)') : 'var(--mu)',
                  fontSize: 9,
                  fontFamily: 'var(--mono)',
                  fontWeight: active ? 700 : 400,
                  cursor: 'pointer',
                  transition: 'all 0.12s',
                }}
              >
                {label}
              </button>
            )
          })}
        </div>

        {/* Name / role */}
        <input
          type="text"
          placeholder={isColor ? 'Ex: paleta warm cinematic...' : 'Quem é? Ex: Pai leão...'}
          value={ref_.role}
          onChange={e => onUpdate(ref_.id, 'role', e.target.value)}
          style={{
            width: '100%', background: 'var(--s3)', border: '1px solid var(--b1)',
            borderRadius: 6, padding: '3px 8px',
            fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--tx)',
            outline: 'none', height: 24,
          }}
        />

        {/* Preserve — only for character refs */}
        {!isColor && (
          <textarea
            placeholder="Preservar: juba, roupa, cor..."
            value={ref_.pres}
            onChange={e => onUpdate(ref_.id, 'pres', e.target.value)}
            style={{
              width: '100%', background: 'var(--s3)', border: '1px solid var(--b1)',
              borderRadius: 6, padding: '3px 8px',
              fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--tx)',
              outline: 'none', resize: 'none', minHeight: 30, lineHeight: 1.5,
            }}
          />
        )}
      </div>

      {/* Remove */}
      <button
        onClick={() => onRemove(ref_.id)}
        style={{
          width: 20, height: 20, borderRadius: '50%',
          background: 'transparent', border: '1px solid var(--b2)',
          color: 'var(--mu)', fontSize: 9, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'all 0.12s', flexShrink: 0,
        }}
        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(248,113,113,0.1)'; e.currentTarget.style.borderColor = 'rgba(248,113,113,0.4)'; e.currentTarget.style.color = 'var(--red)' }}
        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'var(--b2)'; e.currentTarget.style.color = 'var(--mu)' }}
      >
        ✕
      </button>
    </div>
  )
}

function OutputCard({ name, subId, pro, status, prompt, error, onRegen, onCopy }) {
  return (
    <div className={`ocard ${status === 'loading' ? 'loading' : status === 'done' ? 'done' : ''}`}>
      <div className="och">
        <div className="ocl">
          <div className={`ocdot${pro ? ' pro' : ''}`} />
          <div>
            <div className="ocname">{name}</div>
            <div className="ocid">{subId}</div>
          </div>
        </div>
        <div className="ocacts">
          <button className="bsm" onClick={onRegen}>↺ Refazer</button>
          <button className="bsm cp" onClick={onCopy}>Copiar</button>
        </div>
      </div>
      <div className="ocbody">
        {status === 'loading' && (
          <div className="ldstate">
            <div className={`spin${pro ? ' pro' : ''}`} />
            Gerando{pro ? ' (Pro)' : ''}...
          </div>
        )}
        {status === 'error' && (
          <span style={{ color: 'var(--red)', fontFamily: 'var(--mono)', fontSize: 12 }}>Erro: {error}</span>
        )}
        {status === 'done' && prompt && (
          <div className="ptxt" dangerouslySetInnerHTML={{ __html: highlightText(prompt) }} />
        )}
      </div>
    </div>
  )
}
