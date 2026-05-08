import { useState, useMemo, useRef, useLayoutEffect, useEffect } from 'react'
import { createPortal } from 'react-dom'
import {
  buildSchedule, calendarDates, isoToDate, dateToIso,
  DIAS_PT, MESES_PT, STATUS_LIST, STATUS_COLORS,
  DEFAULT_PHASES, PHASE_META
} from './scheduleEngine'
import { exportXLSX } from './exportXLSX'
import { exportPNG, exportPDF } from './exportImage'
import { buildShareUrl, openShareChannel } from './shareLink'
import './index.css'

const TODAY = dateToIso(new Date())
const IN_30 = dateToIso(new Date(Date.now() + 30*24*3600*1000))

// ── Feriados nacionais brasileiros (fixos + Páscoa via Gauss) ────────────────
function easterDate(year) {
  const a = year % 19
  const b = Math.floor(year / 100), c = year % 100
  const d = Math.floor(b / 4), e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19*a + b - d - g + 15) % 30
  const i = Math.floor(c / 4), k = c % 4
  const L = (32 + 2*e + 2*i - h - k) % 7
  const m = Math.floor((a + 11*h + 22*L) / 451)
  const month = Math.floor((h + L - 7*m + 114) / 31)
  const day = ((h + L - 7*m + 114) % 31) + 1
  return new Date(year, month - 1, day)
}
function brHolidays(year) {
  const easter = easterDate(year)
  const goodFriday    = new Date(easter); goodFriday.setDate(easter.getDate() - 2)
  const corpusChristi = new Date(easter); corpusChristi.setDate(easter.getDate() + 60)
  return [
    `${year}-01-01`,
    dateToIso(goodFriday),
    `${year}-04-21`,
    `${year}-05-01`,
    dateToIso(corpusChristi),
    `${year}-09-07`,
    `${year}-10-12`,
    `${year}-11-02`,
    `${year}-11-15`,
    `${year}-12-25`,
  ]
}
const _Y = new Date().getFullYear()
const DEFAULT_HOLIDAYS = [...brHolidays(_Y), ...brHolidays(_Y + 1)]

// ── Templates de projeto ─────────────────────────────────────────────────────
// Cada template define apenas as `phases`. As datas/nomes/descrição são
// preenchidas pelo usuário. Mescladas com DEFAULT_PHASES no apply pra garantir
// que campos novos (kvStill etc) tenham defaults.
const TEMPLATES = {
  branco: {
    label: 'Em branco',
    desc: 'todas etapas desmarcadas',
    phases: {}, // só DEFAULT_PHASES
  },
  ai: {
    label: 'AI',
    desc: 'iteração rápida, 2 prévias',
    phases: {
      prevBaixa: { enabled: true, qty: 2, versions: [
        { dur: 3, horario: '12h', feedbackDelay: 0 },
        { dur: 3, horario: '12h', feedbackDelay: 0 },
      ]},
      ajuste:    { enabled: true, qty: 1, versions: [{ dur: 2, horario: '9h',  feedbackDelay: 0 }] },
      render:    { enabled: true, qty: 1, versions: [{ dur: 2, horario: '18h' }] },
    },
  },
  '3d': {
    label: '3D',
    desc: 'blocagem + 3 prévias + render',
    phases: {
      blocagem:  { enabled: true, qty: 1, versions: [{ dur: 5, horario: '9h',  feedbackDelay: 0 }] },
      prevBaixa: { enabled: true, qty: 3, versions: [
        { dur: 5, horario: '12h', feedbackDelay: 0 },
        { dur: 5, horario: '12h', feedbackDelay: 0 },
        { dur: 5, horario: '12h', feedbackDelay: 0 },
      ]},
      ajuste:    { enabled: true, qty: 1, versions: [{ dur: 3, horario: '9h',  feedbackDelay: 0 }] },
      render:    { enabled: true, qty: 1, versions: [{ dur: 4, horario: '18h' }] },
    },
  },
  vfx: {
    label: 'VFX',
    desc: 'previz + 3 prévias + comp',
    phases: {
      previzStill: { enabled: true, qty: 1, versions: [{ dur: 3, horario: '12h', feedbackDelay: 0 }] },
      blocagem:    { enabled: true, qty: 1, versions: [{ dur: 5, horario: '9h',  feedbackDelay: 0 }] },
      prevBaixa:   { enabled: true, qty: 3, versions: [
        { dur: 5, horario: '12h', feedbackDelay: 0 },
        { dur: 5, horario: '12h', feedbackDelay: 0 },
        { dur: 5, horario: '12h', feedbackDelay: 0 },
      ]},
      ajuste:      { enabled: true, qty: 1, versions: [{ dur: 3, horario: '9h',  feedbackDelay: 0 }] },
      render:      { enabled: true, qty: 1, versions: [{ dur: 5, horario: '18h' }] },
    },
  },
  animacao: {
    label: 'Animação',
    desc: 'previz + 4 prévias polidas',
    phases: {
      previzStill: { enabled: true, qty: 1, versions: [{ dur: 5, horario: '12h', feedbackDelay: 0 }] },
      blocagem:    { enabled: true, qty: 1, versions: [{ dur: 7, horario: '9h',  feedbackDelay: 0 }] },
      prevBaixa:   { enabled: true, qty: 4, versions: [
        { dur: 5, horario: '12h', feedbackDelay: 0 },
        { dur: 5, horario: '12h', feedbackDelay: 0 },
        { dur: 5, horario: '12h', feedbackDelay: 0 },
        { dur: 5, horario: '12h', feedbackDelay: 0 },
      ]},
      ajuste:      { enabled: true, qty: 1, versions: [{ dur: 4, horario: '9h',  feedbackDelay: 0 }] },
      render:      { enabled: true, qty: 1, versions: [{ dur: 5, horario: '18h' }] },
    },
  },
}
const TEMPLATE_KEYS = ['branco', 'ai', '3d', 'vfx', 'animacao']

// ── Persistência local de cronogramas ────────────────────────────────────────
const STORAGE_KEY = 'crono-app-v1.1:schedules'
function loadSchedules() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') }
  catch { return [] }
}
function persistSchedules(list) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
    return { ok: true }
  } catch (err) {
    console.error('Falha ao salvar cronograma no localStorage:', err)
    return { ok: false, err }
  }
}
function genScheduleId() {
  // helper module-level pra escapar do react-hooks/purity (Date.now é impuro)
  return `s_${Date.now()}`
}
// snapshot do "Em branco" salvo anteriormente (formato: { phases, statusOverrides })
const TEMPLATE_BRANCO_KEY = 'crono-app-v1.1:template-branco'
function loadBrancoOverride() {
  try {
    const raw = localStorage.getItem(TEMPLATE_BRANCO_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (parsed && parsed.phases) return parsed
    return { phases: parsed, statusOverrides: {} }
  } catch { return null }
}
function fmtSavedAt(iso) {
  const d = new Date(iso)
  const pad = n => String(n).padStart(2, '0')
  return `${pad(d.getDate())}/${pad(d.getMonth()+1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// ── Icons (inline SVG) ───────────────────────────────────────────────────────
const IconFolder = ({size=14}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z"/>
  </svg>
)
const IconSave = ({size=14}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
    <polyline points="17 21 17 13 7 13 7 21"/>
    <polyline points="7 3 7 8 15 8"/>
  </svg>
)
const IconPlus = ({size=12}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <line x1="12" y1="5" x2="12" y2="19"/>
    <line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
)
const IconTrash = ({size=13}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"/>
    <path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6"/>
    <path d="M10 11v6M14 11v6"/>
    <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
  </svg>
)
const IconClose = ({size=14}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <line x1="6" y1="6" x2="18" y2="18"/>
    <line x1="18" y1="6" x2="6" y2="18"/>
  </svg>
)
const IconDownload = ({size=14}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
    <polyline points="7 10 12 15 17 10"/>
    <line x1="12" y1="15" x2="12" y2="3"/>
  </svg>
)
const IconChevron = ({size=10}) => (
  <svg width={size} height={size} viewBox="0 0 10 10" fill="none">
    <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)
const IconCopy = ({size=14}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="9" width="13" height="13" rx="2"/>
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
  </svg>
)
const IconSearch = ({size=18}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
    <circle cx="11" cy="11" r="7"/><path d="M21 21l-5-5"/>
  </svg>
)
const IconMenu = ({size=18}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
    <path d="M3 12h18M3 6h18M3 18h12"/>
  </svg>
)
const IconCheckSquare = ({size=18}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8 12l3 3 5-5"/>
  </svg>
)
const IconUsers = ({size=18}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
    <circle cx="9" cy="8" r="3"/><path d="M3 20c0-3 3-5 6-5s6 2 6 5"/><circle cx="17" cy="9" r="2.5"/><path d="M16 20c0-2 2-4 4-4"/>
  </svg>
)
const IconSettings = ({size=18}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
    <circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 00-.1-1.2l2-1.5-2-3.4-2.3.9c-.6-.5-1.3-.9-2-1.2L14 3h-4l-.6 2.6c-.7.3-1.4.7-2 1.2l-2.3-.9-2 3.4 2 1.5A7 7 0 005 12c0 .4 0 .8.1 1.2l-2 1.5 2 3.4 2.3-.9c.6.5 1.3.9 2 1.2L10 21h4l.6-2.6c.7-.3 1.4-.7 2-1.2l2.3.9 2-3.4-2-1.5c.1-.4.1-.8.1-1.2z"/>
  </svg>
)
const IconSun = ({size=14}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
    <circle cx="12" cy="12" r="4"/>
    <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>
  </svg>
)
const IconMoon = ({size=14}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/>
  </svg>
)

// ── Design tokens (paleta brand) ─────────────────────────────────────────────
const C = {
  // Marca
  main:      '#1E0FE8',
  sub:       '#cdd1ff',
  blueSoft:  '#cdd1ff',
  blueDeep:  '#0d06a8',
  blueGlow:  'rgba(30,15,232,.3)',
  // Superfícies
  white:     '#ffffff',
  frame:     '#ffffff',
  card:      '#f5f5f3',
  card2:     '#fafaf7',
  cardLine:  '#e8e8e3',
  bg:        '#f0f0eb',
  border:    '#e8e8e3',
  // Inversão (cards escuros sobre tema claro)
  invertBg:   '#0d0d0d',
  invertCard: '#1a1a1a',
  invertLine: '#262626',
  invertText: '#ffffff',
  // Texto
  ink:       '#0a0a0a',
  ink2:      '#1a1a1a',
  inkSoft:   'rgba(10,10,10,.65)',
  inkDim:    'rgba(10,10,10,.45)',
  gray:      '#9a9a92',
  // Status (semânticos — mantidos pra legibilidade do cronograma)
  state1:    '#28CDA5',
  state2:    '#48CE76',
  state3:    '#F7CE46',
  state4:    '#F49931',
  state5:    '#F9513F',
}
const GRAD_BRAND = `linear-gradient(90deg, ${C.main} 0%, ${C.blueSoft} 100%)`
const SHADOW     = '0 1px 2px rgba(10,10,10,.04), 0 8px 24px -8px rgba(10,10,10,.08)'
const SHADOW_LG  = '0 24px 60px -20px rgba(10,10,10,.15), 0 2px 8px rgba(10,10,10,.04)'
const SHADOW_BLUE = '0 12px 40px -12px rgba(30,15,232,.3)'
// Raios padrão
const R = { sm: 8, md: 14, lg: 20, xl: 24, xxl: 32, pill: 999 }
// Tintes vermelho-pastel pra células fora do range
const PAST_TINT    = '#FEE7E3'
const HOLIDAY_TINT = '#FED7CC'

const DEFAULT_CONFIG = {
  cliente: '',
  nomeProjeto: '',
  descricao: '',
  entregas: '', // texto livre, itens separados por /
  dataInicio: TODAY,
  dataFim: IN_30,
  holidays: DEFAULT_HOLIDAYS, // feriados nacionais BR (anos atual e próximo)
  phases: DEFAULT_PHASES,
}

// ── Gantt preview component ──────────────────────────────────────────────────
function GanttPreview({ config, tasks, onTaskChange, innerRef, version, readonly }) {
  // calendário vai até max(deadline, última tarefa) + 1 semana — assim,
  // quando as tarefas extrapolam o deadline, o calendário acompanha;
  // quando reduzem, o calendário volta a 1 semana após o deadline
  const dates = useMemo(()=>{
    let startIso = config.dataInicio
    let endIso = config.dataFim
    for (const t of tasks) {
      if (t.dIni < startIso) startIso = t.dIni
      if (t.dFim > endIso)   endIso   = t.dFim
    }
    return calendarDates(startIso, endIso)
  }, [config.dataInicio, config.dataFim, tasks])

  const months = useMemo(()=>{
    const groups = []
    let cur = null
    dates.forEach((d,i)=>{
      const key = `${d.getFullYear()}-${d.getMonth()}`
      if(key !== cur){
        groups.push({label: MESES_PT[d.getMonth()+1], start:i, count:1})
        cur=key
      } else {
        groups[groups.length-1].count++
      }
    })
    return groups
  },[dates])

  // agrupa tarefas por fase: nova fase começa quando faseNum não é null;
  // tarefas seguintes (versões/feedbacks/aprovação) entram no grupo anterior
  const phaseGroups = useMemo(()=>{
    const groups = []
    let current = null
    for (const t of tasks) {
      if (t.faseNum != null) {
        current = { faseNum: t.faseNum, faseNome: t.faseNome, tasks: [t] }
        groups.push(current)
      } else if (current) {
        current.tasks.push(t)
      } else {
        current = { faseNum: null, faseNome: null, tasks: [t] }
        groups.push(current)
      }
    }
    return groups
  }, [tasks])

  const DAY_W  = 32
  const COL_W  = 540
  const FASE_W = 180

  // índice da coluna do deadline no array dates (-1 se fora do range)
  const deadlineIdx = useMemo(() =>
    dates.findIndex(d => dateToIso(d) === config.dataFim),
    [dates, config.dataFim])

  const holidaySet = useMemo(() => new Set(config.holidays || []),
    [config.holidays])
  const isHolidayDate = (d) => holidaySet.has(dateToIso(d))

  return (
    <div style={{
      overflowX:'auto',
      background:C.frame,
      borderRadius:R.xl,
      border:`1px solid ${C.cardLine}`,
      boxShadow:SHADOW_LG,
    }}>
      <div ref={innerRef} style={{minWidth: COL_W + dates.length*DAY_W, fontSize:11}}>

        {/* Header — azul sólido com glow decorativo */}
        <div style={{display:'flex', background:C.main, height:48, alignItems:'center', position:'relative', overflow:'hidden'}}>
          <div style={{
            position:'absolute', top:'-50%', right:'-15%',
            width:'45%', height:'200%',
            background:'radial-gradient(circle, rgba(255,255,255,.18), transparent 65%)',
            pointerEvents:'none',
          }}/>
          <div style={{width:COL_W, paddingLeft:20, position:'relative',
                       fontWeight:700, fontSize:18, color:C.white, letterSpacing:'-.02em'}}>
            tressde
          </div>
          <div style={{flex:1, height:'100%', display:'flex',
                       alignItems:'center', justifyContent:'center', position:'relative',
                       fontWeight:600, fontSize:15,
                       color:'rgba(255,255,255,.92)', letterSpacing:'.06em', textTransform:'uppercase'}}>
            Cronograma
          </div>
        </div>

        {/* Descrição — nome em destaque + descrição abaixo. A versão aparece
            colada no nome (_v01) quando a fase tem um schedule salvo. */}
        <div style={{
          background:C.white, padding:'14px 20px',
          borderBottom:`1px solid ${C.border}`,
          display:'flex', flexDirection:'column', gap:3,
        }}>
          <div style={{
            color: config.nomeProjeto ? C.ink : C.inkDim,
            fontSize:16, fontWeight:800, fontStyle:'italic',
            letterSpacing:'-.01em',
            lineHeight:1.2,
          }}>
            {config.nomeProjeto || 'Nome do projeto'}
            {config.nomeProjeto && version && (
              <span style={{
                color: C.main, marginLeft: 8, fontWeight: 800,
              }}>_v{String(version).padStart(2, '0')}</span>
            )}
          </div>
          {config.descricao && (
            <div style={{
              color:C.inkSoft, fontSize:12, fontStyle:'italic', fontWeight:500,
              lineHeight:1.4,
            }}>
              {config.descricao}
            </div>
          )}
        </div>

        <div style={{height:4, background:C.main}}/>

        {/* Meses */}
        <div style={{display:'flex', background:C.white, height:22}}>
          <div style={{width:COL_W, borderRight:`1px solid ${C.border}`}}/>
          {months.map((m,i)=>(
            <div key={i} style={{
              width: m.count * DAY_W,
              borderRight:`1px solid ${C.border}`,
              display:'flex', alignItems:'center', justifyContent:'center',
              color:C.ink, fontWeight:700, fontSize:10, letterSpacing:'.06em'
            }}>{m.label.toUpperCase()}</div>
          ))}
        </div>

        {/* Linha 1 — labels (FASE/TAREFA/STATUS) + dias da semana (SEG/TER/...) */}
        <div style={{display:'flex', background:C.white, height:22}}>
          <div style={{
            width:FASE_W, color:C.inkSoft, fontSize:9, fontWeight:700, letterSpacing:'.1em',
            display:'flex', alignItems:'center', justifyContent:'center',
            borderRight:`1px solid ${C.border}`,
          }}>FASE</div>
          <div style={{flex:1, color:C.inkSoft, fontSize:9, fontWeight:700, letterSpacing:'.1em',
                       display:'flex', alignItems:'center', paddingLeft:10,
                       borderRight:`1px solid ${C.border}`}}>TAREFA</div>
          <div style={{width:120, color:C.inkSoft, fontSize:9, fontWeight:700, letterSpacing:'.1em',
                       display:'flex', alignItems:'center', justifyContent:'center',
                       borderRight:`1px solid ${C.border}`}}>STATUS</div>
          {dates.map((d,i)=>{
            const isFds = d.getDay()===0||d.getDay()===6
            const isHol = isHolidayDate(d)
            const dow   = d.getDay()===0?6:d.getDay()-1
            const atDeadline = i === deadlineIdx
            let bg = C.white
            let fg = C.inkDim
            if (isHol) { bg = HOLIDAY_TINT; fg = C.state5 }
            else if (isFds) { bg = C.invertBg; fg = C.white }
            return (
              <div key={i} style={{
                width:DAY_W, height:'100%', background: bg,
                borderRight: atDeadline ? `2px solid ${C.state5}` : `1px solid ${C.border}`,
                display:'flex', alignItems:'center', justifyContent:'center',
                color: fg, fontSize:9, fontWeight:600
              }}>{DIAS_PT[dow]}</div>
            )
          })}
        </div>

        {/* Linha 2 — números dos dias (lado esquerdo vazio) */}
        <div style={{display:'flex', background:C.white, height:14, borderBottom:`1px solid ${C.border}`}}>
          <div style={{width:COL_W, borderRight:`1px solid ${C.border}`}}/>
          {dates.map((d,i)=>{
            const isFds = d.getDay()===0||d.getDay()===6
            const isHol = isHolidayDate(d)
            const past  = deadlineIdx >= 0 && i > deadlineIdx
            const atDeadline = i === deadlineIdx
            let bg = C.white
            let fg = C.inkDim
            if (isHol) { bg = HOLIDAY_TINT; fg = C.state5 }
            else if (isFds) { bg = C.invertBg; fg = C.white }
            if (past && !isHol && !isFds) bg = PAST_TINT
            return (
              <div key={i} style={{
                width:DAY_W, height:'100%', background: bg,
                borderRight: atDeadline ? `2px solid ${C.state5}` : `1px solid ${C.border}`,
                display:'flex', alignItems:'center', justifyContent:'center',
                color: fg, fontSize:9, fontWeight:600
              }}>{d.getDate()}</div>
            )
          })}
        </div>

        {/* Phase groups — fase block como retângulo contornado;
            tarefas com flex:'1 1 auto' pra preencher altura sem brancos */}
        {phaseGroups.map((group, gi) => {
          return (
            <div key={gi} style={{
              display:'flex',
              background:C.white,
            }}>
              {/* wrapper do fase block — padding apertado pra caber em 30px de altura */}
              <div style={{
                width:FASE_W, flexShrink:0,
                padding:'1px 6px 1px 4px',
                borderRight:`1px solid ${C.border}`,
                background:C.white,
                display:'flex',
              }}>
                {/* retângulo da fase com número e nome lado a lado */}
                <div style={{
                  flex:1,
                  background: group.faseNum != null ? C.card : C.card2,
                  border:`1px solid ${C.cardLine}`,
                  borderRadius:8,
                  display:'flex', alignItems:'center', justifyContent:'center',
                  gap:10, padding:'3px 10px',
                }}>
                  {group.faseNum != null && (
                    <>
                      <span style={{
                        fontSize:15, fontWeight:700, color:C.ink,
                        lineHeight:1, fontVariantNumeric:'tabular-nums',
                        letterSpacing:'-.02em',
                      }}>{group.faseNum}</span>
                      <span style={{
                        fontSize:11, fontWeight:600, color:C.inkSoft,
                        lineHeight:1.1, letterSpacing:'.01em',
                      }}>{group.faseNome}</span>
                    </>
                  )}
                </div>
              </div>

              {/* tasks column — flex:1 pra ocupar largura, tasks com flex:auto vertical */}
              <div style={{flex:1, display:'flex', flexDirection:'column', minWidth:0}}>
                {group.tasks.map((task, ti) => {
                  const dIni = isoToDate(task.dIni)
                  const dFim = isoToDate(task.dFim)
                  const sc   = STATUS_COLORS[task.status]||{bg:C.gray,fg:C.ink}
                  return (
                    <div key={ti} style={{
                      display:'flex', minHeight:30,
                      flex:'1 1 auto',
                      alignItems:'stretch',
                    }}>
                      <div style={{flex:1, background:task.cor, padding:'5px 10px',
                                   color:C.white, fontSize:9, fontWeight:700,
                                   letterSpacing:'.02em',
                                   display:'flex', alignItems:'center',
                                   whiteSpace:'normal', wordBreak:'break-word',
                                   minWidth:0, lineHeight:1.35,
                                   textShadow:'0 1px 0 rgba(0,0,0,.08)'}}>
                        {task.nome}
                      </div>

                      {readonly ? (
                        // Modo export — div estática (html2canvas renderiza
                        // <select> com texto quebrado tipo "A REAL IZAR").
                        <div style={{
                          width:120,
                          display:'flex', alignItems:'stretch', justifyContent:'center',
                          padding:'4px 6px',
                        }}>
                          <span style={{
                            background:sc.bg, color:sc.fg,
                            fontSize:10, fontWeight:700, letterSpacing:'.04em',
                            padding:'0 12px', borderRadius:8,
                            display:'inline-flex', alignItems:'center', justifyContent:'center',
                            flex:1,
                          }}>{task.status}</span>
                        </div>
                      ) : (
                        <div style={{
                          width:120,
                          display:'flex', alignItems:'stretch', justifyContent:'center',
                          padding:'4px 6px',
                        }}>
                          <select
                            value={task.status}
                            onChange={e=> onTaskChange(task.id, e.target.value)}
                            style={{
                              width:'100%',
                              background:sc.bg, color:sc.fg,
                              border:'none', fontSize:10, fontWeight:700,
                              cursor:'pointer',
                              padding:'0 10px', borderRadius:8,
                              textAlign:'center', textAlignLast:'center', outline:'none',
                              appearance:'none', WebkitAppearance:'none',
                              letterSpacing:'.04em', fontFamily:'inherit',
                            }}
                          >
                            {STATUS_LIST.map(s=>(
                              <option key={s} value={s} style={{background:C.white,color:C.ink}}>{s}</option>
                            ))}
                          </select>
                        </div>
                      )}

                      {(() => {
                        // helper — célula é "ativa" (parte da pílula) se está
                        // dentro do range da tarefa e não é FDS/feriado.
                        const isActive = (idx) => {
                          if (idx < 0 || idx >= dates.length) return false
                          const dd = dates[idx]
                          const fds = dd.getDay()===0||dd.getDay()===6
                          const hol = isHolidayDate(dd)
                          return !fds && !hol && dd>=dIni && dd<=dFim
                        }
                        // primeira/última célula ativa de TODA a tarefa — bordas
                        // arredondadas só nas pontas da tarefa, retas nas
                        // emendas com FDS/feriado pra dar continuidade visual
                        let firstActiveIdx = -1, lastActiveIdx = -1
                        for (let k = 0; k < dates.length; k++) {
                          if (isActive(k)) {
                            if (firstActiveIdx < 0) firstActiveIdx = k
                            lastActiveIdx = k
                          }
                        }
                        return dates.map((d,i)=>{
                          const isFds  = d.getDay()===0||d.getDay()===6
                          const isHol  = isHolidayDate(d)
                          const inRange = d>=dIni && d<=dFim
                          const isLast  = d.toDateString()===dFim.toDateString()
                          const past   = deadlineIdx >= 0 && i > deadlineIdx
                          const afterDeadline = i === deadlineIdx + 1 && deadlineIdx >= 0
                          const active = isActive(i)
                          const radL = active && i === firstActiveIdx ? 8 : 0
                          const radR = active && i === lastActiveIdx  ? 8 : 0
                          const isPillEnds = radL && radR // tarefa de 1 dia útil
                          // Divisória sutil entre dias FDS adjacentes (sáb→dom)
                          const prevDate = i > 0 ? dates[i-1] : null
                          const prevIsFds = prevDate && (prevDate.getDay()===0 || prevDate.getDay()===6)
                          const fdsDivider = isFds && prevIsFds
                          let bg
                          let fg = C.white
                          if (isHol)          { bg = HOLIDAY_TINT; fg = C.state5 }
                          else if (isFds)     { bg = '#bcbcb6';    fg = C.white  }
                          else if (inRange)   { bg = task.cor                    }
                          else if (past)      { bg = PAST_TINT;    fg = 'transparent' }
                          else                { bg = C.white;      fg = 'transparent' }
                          return (
                            <div key={i} style={{
                              width:DAY_W,
                              display:'flex', alignItems:'center', justifyContent:'center',
                              borderLeft: afterDeadline && !active
                                ? `2px solid ${C.state5}`
                                : (fdsDivider
                                    ? '1px solid rgba(255,255,255,.35)'
                                    : ((active || isFds) ? 'none' : `1px solid ${C.cardLine}`)),
                            }}>
                              <div style={{
                                width:'100%', height:'100%',
                                background: bg,
                                borderRadius: `${radL}px ${radR}px ${radR}px ${radL}px`,
                                display:'flex', alignItems:'center', justifyContent:'center',
                                fontSize:8, fontWeight:700,
                                color: inRange ? fg : (isFds ? fg : 'transparent'),
                                boxShadow: isPillEnds ? `0 2px 6px ${task.cor}55` : 'none',
                              }}>
                                {inRange && isLast && task.horario ? task.horario : ''}
                              </div>
                            </div>
                          )
                        })
                      })()}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}

        {/* Legenda */}
        <div style={{display:'flex', gap:6, padding:'14px 16px',
                     background:C.bg, borderTop:`1px solid ${C.border}`,
                     flexWrap:'wrap'}}>
          {[
            ['ATRASADO',     C.state5, C.white],
            ['EM ANDAMENTO', C.state4, C.white],
            ['CONCLUÍDO',    C.state1, C.white],
            ['A REALIZAR',   C.gray,   C.ink],
            ['FIM DE SEMANA','#bcbcb6', C.white],
            ['FERIADO',      HOLIDAY_TINT, C.state5],
          ].map(([l,bg,fg])=>(
            <div key={l} style={{
              background:bg, color:fg, padding:'4px 12px',
              fontSize:9, fontWeight:700, borderRadius:99,
              letterSpacing:'.05em',
            }}>{l}</div>
          ))}
        </div>

      </div>
    </div>
  )
}

// ── Stepper (− N +) ──────────────────────────────────────────────────────────
function Stepper({ value, min=1, max=9, onChange }) {
  const dec = () => onChange(Math.max(min, value-1))
  const inc = () => onChange(Math.min(max, value+1))
  const btn = (active) => ({
    background:'transparent', border:'none',
    color: active ? C.main : C.inkDim,
    fontSize:18, fontWeight:600,
    width:28, height:'100%',
    cursor: active ? 'pointer' : 'not-allowed',
    lineHeight:1, padding:0,
    display:'flex', alignItems:'center', justifyContent:'center',
  })
  return (
    <div style={{display:'inline-flex', alignItems:'stretch',
                 border:`1px solid ${C.border}`, borderRadius:7,
                 background:C.white, height:28, flexShrink:0}}>
      <button type="button" onClick={dec} disabled={value<=min} style={btn(value>min)}>–</button>
      <span style={{
        minWidth:30, padding:'0 8px', textAlign:'center',
        color:C.ink, fontSize:13, fontWeight:700,
        borderLeft:`1px solid ${C.border}`, borderRight:`1px solid ${C.border}`,
        display:'flex', alignItems:'center', justifyContent:'center',
        fontVariantNumeric:'tabular-nums',
      }}>{value}</span>
      <button type="button" onClick={inc} disabled={value>=max} style={btn(value<max)}>+</button>
    </div>
  )
}

// ── Controles de uma versão (dias + horário + atraso fb) ─────────────────────
function VersionControls({ ver, onChange, hasFeedback }) {
  const fbDelay = ver.feedbackDelay || 0
  return (
    <div style={{
      display:'grid', gridTemplateColumns:'70px 1fr',
      rowGap:8, columnGap:12, alignItems:'center',
    }}>
      <span style={miniLabel}>Dias</span>
      <div style={{display:'flex', alignItems:'center', gap:8}}>
        <Stepper value={ver.dur} min={1} max={999}
                 onChange={v => onChange({...ver, dur: v})}/>
        <span style={{color:C.inkDim, fontSize:9}}>dias úteis</span>
      </div>

      <span style={miniLabel}>Horário</span>
      <div style={{display:'flex', gap:4}}>
        {['9h','12h','18h'].map(h=>{
          const active = ver.horario === h
          return (
            <button key={h} type="button"
              onClick={()=>onChange({...ver, horario: h})}
              style={{
                height:26, padding:'0 12px',
                background: active ? C.main : C.white,
                color: active ? C.white : C.inkSoft,
                border:`1px solid ${active ? C.main : C.border}`,
                borderRadius:7, fontSize:11,
                fontWeight:700, cursor:'pointer', lineHeight:1,
              }}>{h}</button>
          )
        })}
      </div>

      {hasFeedback && (
        <>
          <span style={miniLabel} title="Atraso do cliente no retorno do feedback">
            Atraso fb
          </span>
          <div style={{display:'flex', alignItems:'center', gap:8}}>
            <Stepper value={fbDelay} min={0} max={30}
                     onChange={v => onChange({...ver, feedbackDelay: v})}/>
            <span style={{
              color: fbDelay > 0 ? C.state4 : C.inkDim,
              fontSize:9,
              fontWeight: fbDelay > 0 ? 700 : 500,
            }}>
              {fbDelay > 0
                ? `+${fbDelay} ${fbDelay === 1 ? 'dia útil' : 'dias úteis'}`
                : 'cliente no prazo'}
            </span>
          </div>
        </>
      )}
    </div>
  )
}

function pad2(n) { return String(n).padStart(2,'0') }

// ── Phase config card (colapsável) ───────────────────────────────────────────
function PhaseField({ label, color, hasFeedback, hasOwnDates, config, onChange }) {
  const [expanded, setExpanded] = useState(false)
  // Guarda contra config undefined (saves antigos sem fases novas).
  // Hook acima do return pra respeitar regras de hooks.
  if (!config) return null
  const enabled  = !!config.enabled
  const qty      = config.qty || 1
  const versions = Array.isArray(config.versions) && config.versions.length
    ? config.versions
    : [{ dur: 5, horario: '12h' }]

  // sincroniza versions[] com qty: ao aumentar, copia config da última;
  // ao diminuir, descarta as últimas
  function updateQty(newQty) {
    const next = [...versions]
    while (next.length < newQty) {
      const last = next[next.length - 1] || { dur: 5, horario: '12h' }
      next.push({...last})
    }
    while (next.length > newQty) next.pop()
    onChange({...config, qty: newQty, versions: next})
  }

  function updateVersion(idx, ver) {
    const next = versions.map((v, i) => i === idx ? ver : v)
    onChange({...config, versions: next})
  }
  return (
    <div style={{
      background: C.frame,
      border: `1px solid ${C.cardLine}`,
      borderRadius: 14,
      padding: expanded ? '12px 14px 14px 14px' : '8px 8px 8px 14px',
      marginBottom: 8,
      transition: 'background .2s, border-color .2s, padding .25s, box-shadow .8s cubic-bezier(.19,1,.22,1), transform .8s cubic-bezier(.19,1,.22,1)',
      boxShadow: 'none',
    }}
    onMouseEnter={e=>{
      e.currentTarget.style.transform='translateY(-1px)'
      e.currentTarget.style.boxShadow='0 8px 20px -10px rgba(10,10,10,.10)'
      e.currentTarget.style.borderColor=C.gray
    }}
    onMouseLeave={e=>{
      e.currentTarget.style.transform='translateY(0)'
      e.currentTarget.style.boxShadow='none'
      e.currentTarget.style.borderColor=C.cardLine
    }}>
      <div
        onClick={() => setExpanded(x => !x)}
        role="button"
        tabIndex={0}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            setExpanded(x => !x)
          }
        }}
        style={{
          display:'flex', alignItems:'center', gap:12,
          cursor:'pointer', userSelect:'none',
          opacity: enabled ? 1 : 0.45,
          transition:'opacity .2s',
        }}
      >
        <input
          type="checkbox" checked={enabled}
          onClick={e => e.stopPropagation()}
          onChange={e => onChange({...config, enabled: e.target.checked})}
          style={{accentColor: C.main, width:14, height:14, cursor:'pointer', margin:0,
                  flexShrink:0}}
        />
        <span style={{
          width:11, height:11, borderRadius:'50%', background:color,
          boxShadow:`0 0 0 3px ${color}22`,
          display:'inline-block', flexShrink:0,
        }}/>
        <span style={{
          flex:1, color:C.ink, fontSize:13,
          fontWeight:600, letterSpacing:'-.01em',
          whiteSpace:'nowrap',
          overflow:'hidden', textOverflow:'ellipsis',
        }}>{label}</span>

        <span
          aria-hidden="true"
          style={{
            width:30, height:30, flexShrink:0,
            color:C.inkSoft,
            background: expanded ? C.main : 'transparent',
            border: expanded ? '1px solid transparent' : `1px solid ${C.cardLine}`,
            borderRadius:999,
            display:'flex', alignItems:'center', justifyContent:'center',
            transform: expanded ? 'rotate(45deg)' : 'rotate(-45deg)',
            transition:'transform .25s, background .25s, color .25s, border-color .25s',
          }}
        >
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
            <path d="M3 9L9 3M9 3H4.5M9 3V7.5" stroke={expanded ? '#fff' : 'currentColor'} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </span>
      </div>

      {expanded && (
        <div style={{
          marginTop:12, paddingTop:10, paddingLeft:6,
          borderTop:`1px solid ${C.border}`,
          opacity: enabled ? 1 : 0.55,
        }}>
          {/* Datas próprias da etapa — só pra fases independentes do projeto (KV) */}
          {hasOwnDates && (
            <div style={{
              background: C.bg,
              border: `1px solid ${C.border}`,
              borderRadius: 8,
              padding: '8px 10px',
              marginBottom: 10,
            }}>
              <div style={{
                fontSize:9, fontWeight:800, color:C.main,
                letterSpacing:'.1em', marginBottom:8,
              }}>DATAS DA ETAPA</div>
              <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:8}}>
                <div>
                  <label style={{...miniLabel, marginBottom:4, display:'block'}}>Início</label>
                  <input type="date"
                    value={config.dataInicio || ''}
                    onChange={e => onChange({...config, dataInicio: e.target.value})}
                    style={{
                      width:'100%', background:C.white,
                      border:`1px solid ${C.border}`, borderRadius:6,
                      color:C.ink, fontSize:11, padding:'5px 8px',
                      outline:'none', boxSizing:'border-box',
                    }}/>
                </div>
                <div>
                  <label style={{...miniLabel, marginBottom:4, display:'block'}}>Deadline</label>
                  <input type="date"
                    value={config.dataFim || ''}
                    onChange={e => onChange({...config, dataFim: e.target.value})}
                    style={{
                      width:'100%', background:C.white,
                      border:`1px solid ${C.border}`, borderRadius:6,
                      color:C.ink, fontSize:11, padding:'5px 8px',
                      outline:'none', boxSizing:'border-box',
                    }}/>
                </div>
              </div>
              <p style={{
                color:C.inkDim, fontSize:9, marginTop:6, marginBottom:0,
                lineHeight:1.4,
              }}>
                deixe em branco pra usar as datas do projeto principal
              </p>
            </div>
          )}

          {/* Versões — Stepper único da fase */}
          <div style={{
            display:'grid', gridTemplateColumns:'70px 1fr',
            columnGap:12, alignItems:'center',
            marginBottom: qty > 1 ? 12 : 8,
          }}>
            <span style={miniLabel}>Versões</span>
            <div style={{display:'flex', alignItems:'center', gap:8}}>
              <Stepper value={qty} min={1} max={9}
                       onChange={v => updateQty(v)}/>
              {hasFeedback && qty > 1 && (
                <span style={{color:C.inkDim, fontSize:9}}>
                  {qty}× + feedback
                </span>
              )}
            </div>
          </div>

          {/* Controles por versão */}
          {qty === 1 ? (
            <VersionControls
              ver={versions[0]}
              hasFeedback={hasFeedback}
              onChange={v => updateVersion(0, v)}
            />
          ) : (
            versions.map((ver, i) => (
              <div key={i} style={{
                background: C.bg,
                border: `1px solid ${C.border}`,
                borderRadius: 8,
                padding: '8px 10px',
                marginBottom: 6,
              }}>
                <div style={{
                  fontSize:9, fontWeight:800, color:C.main,
                  letterSpacing:'.1em', marginBottom:8,
                }}>V{pad2(i+1)}</div>
                <VersionControls
                  ver={ver}
                  hasFeedback={hasFeedback}
                  onChange={v => updateVersion(i, v)}
                />
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}

// ── Calendário mensal — grid 7 colunas, células circulares ───────────────────
function MonthCalendar({ year, month, tasks, holidays, deadline, today }) {
  // semana começa no domingo: dom=0..sab=6 nativo do JS
  const firstDow = new Date(year, month, 1).getDay()
  const padStart = firstDow
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const padEnd = (7 - ((padStart + daysInMonth) % 7)) % 7
  const cells = [
    ...Array(padStart).fill(null),
    ...Array.from({length: daysInMonth}, (_, i) => i + 1),
    ...Array(padEnd).fill(null),
  ]
  const holidaySet = new Set(holidays || [])
  const taskRanges = tasks.map(t => ({
    ini: t.dIni, fim: t.dFim, cor: t.cor, status: t.status,
  }))
  const pad2 = n => String(n).padStart(2,'0')
  const isoFor = d => `${year}-${pad2(month+1)}-${pad2(d)}`
  return (
    <div style={{display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:6}}>
      {/* Cabeçalho dias da semana — domingo primeiro */}
      {['DOM','SEG','TER','QUA','QUI','SEX','SAB'].map(d => (
        <div key={d} style={{
          fontSize:9, fontWeight:600, color:C.inkDim,
          letterSpacing:'.12em', textAlign:'center', paddingBottom:2,
        }}>{d}</div>
      ))}
      {cells.map((day, i) => {
        if (day == null) {
          return <div key={i} style={{aspectRatio:'1', background:'transparent'}}/>
        }
        const iso = isoFor(day)
        const dt  = new Date(year, month, day)
        const isFds = dt.getDay() === 0 || dt.getDay() === 6
        const isHol = holidaySet.has(iso)
        const isToday = iso === today
        const isDeadline = iso === deadline
        const taskHere = taskRanges.find(r => iso >= r.ini && iso <= r.fim)
        let bg = C.frame
        let fg = C.ink
        let border = `1px solid ${C.cardLine}`
        let shadow = 'none'
        // FDS sempre pretos com texto branco (regra do projeto)
        if (isFds) {
          bg = C.invertBg; fg = C.white; border = '1px solid transparent'
        }
        // Hoje: azul preenchido (sobrescreve FDS)
        if (isToday) {
          bg = C.main; fg = C.white; border = '1px solid transparent'
          shadow = SHADOW_BLUE
        } else if (isDeadline) {
          bg = C.invertBg; fg = C.white; border = '1px solid transparent'
        } else if (taskHere && !isFds) {
          // sutil tom da fase só nos dias úteis
          border = `2px solid ${taskHere.cor}55`
        } else if (isHol && !isFds) {
          bg = HOLIDAY_TINT; fg = C.state5; border = '1px solid transparent'
        }
        return (
          <div key={i} style={{
            aspectRatio:'1', borderRadius:R.pill,
            background: bg, color: fg, border,
            display:'flex', alignItems:'center', justifyContent:'center',
            fontSize:12, fontWeight: isToday ? 700 : 500,
            boxShadow: shadow,
            fontVariantNumeric:'tabular-nums',
          }}>{day}</div>
        )
      })}
    </div>
  )
}

// ── Section heading ──────────────────────────────────────────────────────────
function SectionHead({ children, right }) {
  // se `right` for string, embrulha em span com tipografia de heading;
  // se for elemento React (botão etc), renderiza direto
  const renderedRight = typeof right === 'string'
    ? <span style={{color:C.inkDim, fontWeight:600, fontSize:10, letterSpacing:'.08em', textTransform:'uppercase'}}>{right}</span>
    : right
  return (
    <div style={{
      fontSize:11, fontWeight:600, letterSpacing:'.14em',
      color:C.ink, textTransform:'uppercase',
      marginBottom:14, display:'flex', alignItems:'center', gap:12,
    }}>
      <span>{children}</span>
      <div style={{flex:1, height:1, background:C.cardLine}}/>
      {right && renderedRight}
    </div>
  )
}

// ── Export frame (PDF/PNG em 16:9 1920×1080) ─────────────────────────────────
function PreviewModal({ onClose, children }) {
  const stageRef   = useRef(null)
  const contentRef = useRef(null)
  useLayoutEffect(() => {
    const stage = stageRef.current
    const content = contentRef.current
    if (!stage || !content) return
    const apply = () => {
      const s = stage.clientWidth / 1920
      content.style.transform = `scale(${s})`
    }
    apply()
    const ro = new ResizeObserver(apply)
    ro.observe(stage)
    return () => ro.disconnect()
  }, [])
  return createPortal(
    <div
      onClick={onClose}
      style={{
        position:'fixed', inset:0,
        background:'rgba(22,24,30,.78)',
        zIndex:99990,
        display:'flex', alignItems:'center', justifyContent:'center',
        padding:24,
      }}
    >
      <button
        type="button"
        onClick={onClose}
        style={{
          position:'absolute', top:16, right:16,
          width:36, height:36, borderRadius:'50%',
          border:'none', background:C.white, color:C.ink,
          fontSize:18, fontWeight:700, cursor:'pointer',
          boxShadow:SHADOW,
        }}
        aria-label="Fechar preview"
      >×</button>
      <div
        ref={stageRef}
        onClick={e=>e.stopPropagation()}
        style={{
          width: 'min(92vw, calc((100vh - 48px) * 1.7778))',
          aspectRatio: '1920 / 1080',
          boxShadow: SHADOW_LG,
          borderRadius: 8,
          overflow: 'hidden',
          background: '#efefef',
        }}
      >
        <div ref={contentRef} style={{
          width: 1920, height: 1080,
          transformOrigin: 'top left',
        }}>
          {children}
        </div>
      </div>
    </div>,
    document.body
  )
}

function ExportFrame({
  frameRef, name, version, savedAt,
  reducoesAfterDeadline, stats,
  children,
}) {
  const wrapperRef = useRef(null)
  // dim = dimensões VISUAIS do Gantt depois da escala (pra alinhar header /
  // notificação / stats com a mesma largura horizontal)
  const [dim, setDim] = useState({width: 0, height: 0, scale: 1})

  useLayoutEffect(() => {
    const wrapper = wrapperRef.current
    if (!wrapper) return
    wrapper.style.transform = 'none'
    const naturalW = wrapper.scrollWidth
    const naturalH = wrapper.scrollHeight
    if (naturalW === 0 || naturalH === 0) return

    // Budget vertical: respiro grande no topo, pequeno embaixo, agrupamento
    // compacto entre header + notificação + Gantt + stats
    const HORIZ_PAD = 28
    const TOP_BREATH = 32
    const BOT_BREATH = 24
    const HEADER_H   = 48
    const NOTIF_H    = reducoesAfterDeadline ? 56 : 0
    const STATS_H    = 110
    const GAP        = 14
    const numGaps    = (reducoesAfterDeadline ? 3 : 2) // header→[notif]→gantt→stats

    const targetW = 1920 - HORIZ_PAD * 2
    const targetH = 1080 - TOP_BREATH - BOT_BREATH - HEADER_H - NOTIF_H - STATS_H - GAP * numGaps

    const sx = targetW / naturalW
    const sy = targetH / naturalH
    const s  = Math.min(sx, sy, 1)
    setDim({
      width:  Math.round(naturalW * s),
      height: Math.round(naturalH * s),
      scale:  s,
    })
  }, [reducoesAfterDeadline])

  const fmt = iso => {
    const d = new Date(iso)
    const pad = n => String(n).padStart(2, '0')
    return `${pad(d.getDate())}/${pad(d.getMonth()+1)}/${d.getFullYear()}`
  }
  const v = String(version || 1).padStart(2, '0')

  const STAT_CARDS = [
    ['TOTAL DE TAREFAS', stats.total,       C.main],
    ['CONCLUÍDAS',       stats.concluidas,  C.state1],
    ['EM ANDAMENTO',     stats.emAndamento, C.state4],
    ['A REALIZAR',       stats.aRealizar,   C.gray],
    ['ATRASADAS',        stats.atrasadas,   C.state5],
  ]

  // largura comum pros blocos (header / notif / gantt / stats) — alinhamento
  // horizontal pedido. Antes da medição usa fallback de '100%'.
  const rowW = dim.width ? `${dim.width}px` : '100%'

  return (
    <div ref={frameRef} style={{
      width:1920, height:1080,
      background:'#efefef',
      paddingTop:32, paddingBottom:24, paddingLeft:28, paddingRight:28,
      display:'flex', flexDirection:'column',
      alignItems:'center',
      gap:14,
      boxSizing:'border-box',
      fontFamily:"'Helvetica Neue', Helvetica, Arial, sans-serif",
      color:C.ink,
    }}>
      {/* Header — projeto + versão + data */}
      <div style={{
        width: rowW,
        display:'flex', alignItems:'center', justifyContent:'space-between',
        gap:24,
      }}>
        <div style={{fontSize:34, fontWeight:700, letterSpacing:'-.02em', color:C.ink}}>
          {name}
          <span style={{opacity:.35, margin:'0 14px', fontWeight:400}}>/</span>
          Cronograma_v{v}
        </div>
        <div style={{
          fontSize:18, fontWeight:500,
          color:C.inkSoft,
          fontVariantNumeric:'tabular-nums',
        }}>{fmt(savedAt)}</div>
      </div>

      {/* Notificação laranja — Reduções estendem após entrega */}
      {reducoesAfterDeadline && (
        <div style={{
          width: rowW,
          background:C.state4, color:'#fff',
          padding:'14px 22px', borderRadius:12,
          display:'flex', alignItems:'center', gap:14,
          fontSize:17, fontWeight:700,
          boxShadow:`0 4px 14px ${C.state4}33`,
          boxSizing:'border-box',
        }}>
          <span style={{
            width:28, height:28, borderRadius:'50%', flexShrink:0,
            background:'#fff', color:C.state4,
            display:'flex', alignItems:'center', justifyContent:'center',
            fontSize:15, fontWeight:800,
          }}>i</span>
          <span>Reduções e Formatos serão entregues após a entrega do material final.</span>
        </div>
      )}

      {/* Gantt — wrapper com tamanho visual já escalado, transform faz o
          conteúdo natural caber dentro */}
      <div style={{
        width: dim.width  ? `${dim.width}px`  : 'auto',
        height: dim.height ? `${dim.height}px` : 'auto',
        overflow: 'hidden',
        flexShrink: 0,
      }}>
        <div ref={wrapperRef} style={{
          transform: `scale(${dim.scale})`,
          transformOrigin: 'top left',
          width: 'fit-content',
        }}>
          {children}
        </div>
      </div>

      {/* Stats — 5 cards com mesma largura dos blocos acima */}
      <div style={{
        width: rowW,
        display:'grid', gridTemplateColumns:'repeat(5, 1fr)', gap:14,
        height:110, flexShrink:0,
      }}>
        {STAT_CARDS.map(([label, value, color]) => (
          <div key={label} style={{
            background:'#fff',
            borderRadius:14, padding:'16px 22px',
            position:'relative', overflow:'hidden',
            display:'flex', flexDirection:'column', justifyContent:'center',
          }}>
            <div style={{
              position:'absolute', top:0, left:0, right:0, height:4,
              background:color,
            }}/>
            <div style={{
              color:C.inkSoft, fontSize:11, fontWeight:700, letterSpacing:'.08em',
              marginBottom:6,
            }}>{label}</div>
            <div style={{
              color:C.ink, fontSize:42, fontWeight:800,
              letterSpacing:'-.03em', lineHeight:1,
            }}>{value}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [config, setConfig] = useState(DEFAULT_CONFIG)

  const liveTasks = useMemo(()=>{
    if(!config.dataInicio || !config.dataFim) return []
    try { return buildSchedule(config) } catch { return [] }
  }, [config])

  // overrides keyed by task name (estável quando fases mudam)
  const [statusOverrides, setStatusOverrides] = useState({})

  // Sincroniza qualquer aba da landing aberta no mesmo browser:
  // a cada mudança no cronograma, faz broadcast com os dados atuais.
  useEffect(() => {
    const ch = openShareChannel()
    if (!ch) return
    ch.postMessage({ type: 'update', config, statusOverrides })
    return () => ch.close()
  }, [config, statusOverrides])

  const displayTasks = useMemo(()=>{
    return liveTasks.map(t => ({
      ...t,
      status: statusOverrides[t.id] ?? t.status
    }))
  },[liveTasks, statusOverrides])

  // Reduções podem ser entregues após o material final — não disparam alerta
  // vermelho, mas sinalizam um informativo laranja
  const isReducao = (t) => t.nome.startsWith('REDUÇÕES')
  // KV tem datas próprias — também não conta no overflow do projeto principal
  const isKv = (t) => t.id?.startsWith('kvStill') || t.id?.startsWith('kvFinal')

  const overflowDays = useMemo(()=>{
    if (!displayTasks.length) return 0
    let lastIso = config.dataFim
    for (const t of displayTasks) {
      if (isReducao(t) || isKv(t)) continue
      if (t.dFim > lastIso) lastIso = t.dFim
    }
    if (lastIso <= config.dataFim) return 0
    const ms = isoToDate(lastIso).getTime() - isoToDate(config.dataFim).getTime()
    return Math.round(ms / (24*3600*1000))
  }, [displayTasks, config.dataFim])

  const reducoesAfterDeadline = useMemo(()=>{
    return displayTasks.some(t => isReducao(t) && t.dFim > config.dataFim)
  }, [displayTasks, config.dataFim])

  function handleTaskStatusChange(taskId, val) {
    if (!taskId) return
    setStatusOverrides(prev => ({...prev, [taskId]: val}))
  }

  function set(k,v){ setConfig(c=>({...c,[k]:v})) }
  function setPhase(key, cfg) {
    setConfig(c => ({...c, phases: {...c.phases, [key]: cfg}}))
  }

  // Persistência: cronogramas salvos no localStorage
  const [schedules, setSchedules]   = useState(() => loadSchedules())
  const [currentId, setCurrentId]   = useState(null)
  const [showDrawer, setShowDrawer] = useState(false)
  // Sidebar do formulário do projeto (toggle pelo botão menu da side rail)
  const [showProjectForm, setShowProjectForm] = useState(true)
  // Tema (light/dark) — persistido no localStorage e aplicado via data-theme
  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem('crono-app-v1.1:theme') || 'light' }
    catch { return 'light' }
  })
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    try { localStorage.setItem('crono-app-v1.1:theme', theme) } catch {}
  }, [theme])

  // Menu de Novo projeto (templates)
  const newBtnRef = useRef(null)
  const [showNewMenu, setShowNewMenu] = useState(false)
  const [newMenuPos,  setNewMenuPos]  = useState({top: 0, left: 0})

  // snapshot do "Em branco" salvo previamente (carrega do localStorage; aplica ao
  // clicar em "Em branco" no menu, mas não é mais editável via UI)
  const brancoOverride = useMemo(() => loadBrancoOverride(), [])
  function getTemplate(key) {
    if (key === 'branco' && brancoOverride) {
      return {
        ...TEMPLATES.branco,
        phases: brancoOverride.phases,
        statusOverrides: brancoOverride.statusOverrides || {},
      }
    }
    return TEMPLATES[key]
  }

  function toggleNewMenu() {
    if (showNewMenu) { setShowNewMenu(false); return }
    const r = newBtnRef.current?.getBoundingClientRect()
    if (r) setNewMenuPos({ top: r.bottom + 6, left: r.left })
    setShowNewMenu(true)
  }

  function pickTemplate(key) {
    setShowNewMenu(false)
    if (config.nomeProjeto || config.descricao) {
      const label = TEMPLATES[key]?.label || 'em branco'
      if (!confirm(`Descartar o projeto atual e começar com template "${label}"?`)) return
    }
    newProject(key)
  }

  // Toast — feedback visual ao salvar/duplicar/novo
  const [toast, setToast] = useState(null)
  const toastTimerRef = useRef(null)
  function showToast(message, type='success') {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    setToast({ message, type })
    toastTimerRef.current = setTimeout(() => setToast(null), 2500)
  }

  // Export
  const ganttRef        = useRef(null)
  const exportFrameRef  = useRef(null)
  const downloadBtnRef  = useRef(null)
  const [showDownload, setShowDownload] = useState(false)
  const [downloadPos,  setDownloadPos]  = useState({bottom: 0, left: 0})
  const [downloading,  setDownloading]  = useState(null) // 'pdf' | 'png' | 'xlsx' | null
  const [showExportFrame, setShowExportFrame] = useState(false)
  const [showPreview,     setShowPreview]     = useState(false)
  // Dropdown do botão Prévia (link / pdf)
  const previewBtnRef = useRef(null)
  const [showPreviewMenu, setShowPreviewMenu] = useState(false)
  const [previewPos, setPreviewPos] = useState({bottom: 0, left: 0})

  function toggleDownload() {
    if (showDownload) { setShowDownload(false); return }
    const r = downloadBtnRef.current?.getBoundingClientRect()
    if (r) setDownloadPos({
      bottom: window.innerHeight - r.bottom,
      left: r.right + 8,
    })
    setShowDownload(true)
  }

  function togglePreviewMenu() {
    if (showPreviewMenu) { setShowPreviewMenu(false); return }
    const r = previewBtnRef.current?.getBoundingClientRect()
    if (r) setPreviewPos({
      bottom: window.innerHeight - r.bottom,
      left: r.left,
    })
    setShowPreviewMenu(true)
  }

  async function handleDownload(kind) {
    setShowDownload(false)
    setDownloading(kind)
    try {
      const name    = config.nomeProjeto || 'cronograma'
      const version = currentSchedule?.version || 1
      if (kind === 'xlsx') {
        exportXLSX(config, displayTasks, version)
      } else {
        // monta o frame de export off-screen, espera 2 frames pra layout
        // (incluindo carregamento de fontes / images / etc), captura, desmonta
        setShowExportFrame(true)
        await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))
        try {
          if (kind === 'png') await exportPNG(exportFrameRef.current, name, version)
          if (kind === 'pdf') await exportPDF(exportFrameRef.current, name, version)
        } finally {
          setShowExportFrame(false)
        }
      }
    } finally {
      setDownloading(null)
    }
  }

  async function handleShareLink() {
    setShowDownload(false)
    try {
      const url = buildShareUrl({ config, statusOverrides })
      // abre antes do clipboard pra preservar o user gesture (evita popup blocker)
      window.open(url, '_blank', 'noopener')
      try {
        await navigator.clipboard.writeText(url)
        showToast('Link aberto em nova aba e copiado', 'success')
      } catch {
        showToast('Link aberto em nova aba (cópia falhou)', 'info')
      }
    } catch (err) {
      console.error('Falha ao gerar link:', err)
      showToast('Falha ao gerar o link', 'error')
    }
  }

  // metadados do frame de export (versão e savedAt baseados no schedule
  // atualmente carregado; se não há, usa v01 e data de hoje)
  const currentSchedule = schedules.find(s => s.id === currentId)
  const exportMeta = {
    name: (config.nomeProjeto || '').trim() || 'Sem nome',
    version: currentSchedule?.version || 1,
    savedAt: currentSchedule?.savedAt || new Date().toISOString(),
  }
  const exportStats = {
    total:       displayTasks.length,
    concluidas:  displayTasks.filter(t=>t.status==='CONCLUÍDO').length,
    emAndamento: displayTasks.filter(t=>t.status==='EM ANDAMENTO').length,
    aRealizar:   displayTasks.filter(t=>t.status==='A REALIZAR').length,
    atrasadas:   displayTasks.filter(t=>t.status==='ATRASADO').length,
  }

  function newProject(templateKey = 'branco') {
    const template = getTemplate(templateKey) || TEMPLATES.branco
    // mescla phases do template com DEFAULT_PHASES (garante campos novos)
    const phases = { ...DEFAULT_PHASES }
    for (const [key, override] of Object.entries(template.phases)) {
      phases[key] = { ...DEFAULT_PHASES[key], ...override }
    }
    setConfig({ ...DEFAULT_CONFIG, phases })
    setStatusOverrides(template.statusOverrides || {})
    setCurrentId(null)
    showToast(
      templateKey === 'branco'
        ? 'Novo projeto em branco'
        : `Template "${template.label}" carregado`,
      'info'
    )
  }

  function saveCurrent() {
    try {
      const id = currentId || genScheduleId()
      const existing = schedules.find(s => s.id === id)
      const version = existing?.version || 1
      const name = (config.nomeProjeto || '').trim() || 'Sem nome'
      const item = {
        id,
        name,
        version,
        savedAt: new Date().toISOString(),
        config,
        statusOverrides,
      }
      const others = schedules.filter(s => s.id !== id)
      const updated = [item, ...others]

      const result = persistSchedules(updated)
      if (!result.ok) {
        showToast(
          `Erro ao salvar — ${result.err?.message || 'localStorage indisponível'}`,
          'error'
        )
        return
      }
      setSchedules(updated)
      setCurrentId(id)
      showToast(
        existing
          ? `"${name}_v${String(version).padStart(2,'0')}" atualizado`
          : `"${name}_v${String(version).padStart(2,'0')}" salvo`,
        'success'
      )
    } catch (err) {
      console.error('[saveCurrent] EXCEPTION:', err)
      showToast(`Erro inesperado: ${err.message}`, 'error')
    }
  }

  function loadSchedule(id) {
    const s = schedules.find(x => x.id === id)
    if (!s) return
    // Mescla com defaults — saves antigos podem não ter campos/fases novos
    // (ex: kvStill/kvFinal). Sem isso, PhaseField crasha ao destructurar
    // config.phases[key] undefined.
    const savedPhases = s.config?.phases || {}
    const mergedPhases = {}
    for (const [key, defaultPhase] of Object.entries(DEFAULT_PHASES)) {
      const sp = savedPhases[key]
      if (!sp) {
        mergedPhases[key] = defaultPhase
      } else {
        mergedPhases[key] = {
          ...defaultPhase,
          ...sp,
          versions: Array.isArray(sp.versions) && sp.versions.length
            ? sp.versions
            : defaultPhase.versions,
        }
      }
    }
    const mergedConfig = {
      ...DEFAULT_CONFIG,
      ...(s.config || {}),
      phases: mergedPhases,
    }
    setConfig(mergedConfig)
    setStatusOverrides(s.statusOverrides || {})
    setCurrentId(id)
    setShowDrawer(false)
    showToast(
      `"${s.name}_v${String(s.version || 1).padStart(2,'0')}" carregado`,
      'info'
    )
  }

  function deleteSchedule(id) {
    const updated = schedules.filter(s => s.id !== id)
    persistSchedules(updated)
    setSchedules(updated)
    if (currentId === id) setCurrentId(null)
  }

  function duplicateCurrent() {
    try {
      const cur = schedules.find(s => s.id === currentId)
      const baseVersion = cur?.version || 1
      const newId = genScheduleId()
      const newVersion = baseVersion + 1
      const name = (config.nomeProjeto || '').trim() || 'Sem nome'
      const item = {
        id: newId,
        name,
        version: newVersion,
        savedAt: new Date().toISOString(),
        config,
        statusOverrides,
      }
      const updated = [item, ...schedules]
      const result = persistSchedules(updated)
      if (!result.ok) {
        showToast(
          `Erro ao duplicar — ${result.err?.message || 'localStorage indisponível'}`,
          'error'
        )
        return
      }
      setSchedules(updated)
      setCurrentId(newId)
      showToast(
        `Duplicado como "${name}_v${String(newVersion).padStart(2,'0')}"`,
        'success'
      )
    } catch (err) {
      console.error('[duplicateCurrent] EXCEPTION:', err)
      showToast(`Erro inesperado: ${err.message}`, 'error')
    }
  }

  const enabledCount = Object.values(config.phases).filter(p=>p.enabled).length

  return (
    <div style={{
      minHeight:'100vh',
      background:C.bg,
      color:C.ink,
      padding:'20px',
    }}>
    <div style={{
      background:C.frame,
      borderRadius:24,
      border:`1px solid ${C.cardLine}`,
      boxShadow:SHADOW_LG,
      overflow:'hidden',
      minHeight:'calc(100vh - 40px)',
      display:'flex', flexDirection:'column',
    }}>
      {/* Dropdown de templates do botão Novo */}
      {showNewMenu && createPortal(
        <>
          <div onClick={()=>setShowNewMenu(false)}
               style={{position:'fixed', inset:0, zIndex:9998}}/>
          <div style={{
            position:'fixed',
            top: newMenuPos.top, left: newMenuPos.left,
            width: 240,
            background:C.white,
            border:`1px solid ${C.border}`,
            borderRadius:10,
            boxShadow:SHADOW_LG,
            zIndex:9999,
            padding:5,
          }}>
            {TEMPLATE_KEYS.map(key => {
              const t = TEMPLATES[key]
              return (
                <button
                  key={key}
                  onClick={()=>pickTemplate(key)}
                  style={{
                    width:'100%', display:'flex',
                    flexDirection:'column', alignItems:'flex-start',
                    gap:2,
                    background:'transparent', border:'none',
                    padding:'9px 12px', borderRadius:7,
                    cursor:'pointer', textAlign:'left',
                    transition:'background .15s',
                  }}
                  onMouseOver={e=>e.currentTarget.style.background = C.bg}
                  onMouseOut={e=>e.currentTarget.style.background = 'transparent'}
                >
                  <span style={{
                    color:C.ink, fontSize:13, fontWeight:700,
                  }}>{t.label}</span>
                  <span style={{
                    color:C.inkDim, fontSize:10, fontWeight:500,
                  }}>{t.desc}</span>
                </button>
              )
            })}
          </div>
        </>,
        document.body
      )}

      {/* Toast — feedback visual de save/duplicate/novo */}
      {toast && createPortal(
        <div style={{
          position:'fixed',
          bottom:24, right:24,
          background: toast.type === 'success' ? C.state1
                    : toast.type === 'info'    ? C.main
                    : C.state5,
          color:'#fff',
          padding:'12px 18px',
          borderRadius:10,
          boxShadow:SHADOW_LG,
          fontSize:13, fontWeight:700,
          zIndex:99999,
          pointerEvents:'none',
          maxWidth:360,
          animation:'toast-in .22s ease-out',
          letterSpacing:'.01em',
        }}>{toast.message}</div>,
        document.body
      )}

      {/* Frame de export — renderizado off-screen quando exportando PDF/PNG.
          html2canvas captura o conteúdo daqui, não o Gantt visível. */}
      {showExportFrame && displayTasks.length > 0 && (
        <div style={{
          position:'fixed',
          top:0, left:'-99999px',
          zIndex:-1,
          pointerEvents:'none',
        }}>
          <ExportFrame
            frameRef={exportFrameRef}
            name={exportMeta.name}
            version={exportMeta.version}
            savedAt={exportMeta.savedAt}
            reducoesAfterDeadline={reducoesAfterDeadline}
            stats={exportStats}
          >
            <GanttPreview
              config={config}
              tasks={displayTasks}
              onTaskChange={()=>{}}
              version={exportMeta.version}
              readonly
            />
          </ExportFrame>
        </div>
      )}

      {/* Modal de preview — mostra o ExportFrame escalado pra caber na tela */}
      {showPreview && displayTasks.length > 0 && (
        <PreviewModal onClose={()=>setShowPreview(false)}>
          <ExportFrame
            name={exportMeta.name}
            version={exportMeta.version}
            savedAt={exportMeta.savedAt}
            reducoesAfterDeadline={reducoesAfterDeadline}
            stats={exportStats}
          >
            <GanttPreview
              config={config}
              tasks={displayTasks}
              onTaskChange={()=>{}}
              version={exportMeta.version}
              readonly
            />
          </ExportFrame>
        </PreviewModal>
      )}

      {/* header */}
      <header style={{
        background:C.frame,
        borderBottom:`1px solid ${C.cardLine}`,
        padding:'0 2.5rem', height:72,
        display:'grid',
        gridTemplateColumns:'1fr auto 1fr',
        alignItems:'center',
        gap:16,
        flexShrink:0,
      }}>
        {/* col 1 — brand */}
        <div style={{display:'flex', alignItems:'center', justifySelf:'start'}}>
          <div style={{fontWeight:700, fontSize:20, letterSpacing:'-.03em', color:C.ink}}>
            tressde
          </div>
        </div>

        {/* col 2 — título */}
        <div style={{
          fontSize:18, fontWeight:600, letterSpacing:'-.02em',
          color:C.ink, textAlign:'center', whiteSpace:'nowrap',
        }}>
          Gerador de Cronograma
        </div>

        {/* col 3 — controles */}
        <div style={{display:'flex', alignItems:'center', gap:10, justifySelf:'end'}}>
          <div style={{
            fontSize:11,
            padding:'6px 12px',
            background: C.invertBg,
            color: C.invertText,
            borderRadius:R.pill, letterSpacing:'.08em', fontWeight:600,
          }}>v1.1 · LAB</div>
          {/* Avatar do usuário (placeholder até auth) */}
          <div title="Usuário (placeholder)" style={{
            display:'flex', alignItems:'center', gap:8,
            background:C.frame, border:`1px solid ${C.cardLine}`,
            borderRadius:R.pill, padding:'4px 14px 4px 4px',
          }}>
            <div style={{
              width:30, height:30, borderRadius:R.pill,
              background:`linear-gradient(135deg, #5d4ef0, ${C.main})`,
              display:'flex', alignItems:'center', justifyContent:'center',
              color:C.white, fontSize:12, fontWeight:700, letterSpacing:'-.02em',
              flexShrink:0,
            }}>M</div>
            <span style={{fontSize:12, fontWeight:500, color:C.inkSoft, letterSpacing:'-.01em'}}>Marcos</span>
          </div>
        </div>
      </header>

      {/* Drawer de cronogramas salvos */}
      {showDrawer && (
        <>
          <div
            onClick={()=>setShowDrawer(false)}
            style={{position:'fixed', inset:0, zIndex:199, background:'transparent'}}
          />
          <div style={{
            position:'fixed', top:84, right:24,
            width:420, maxHeight:'72vh',
            background:C.frame,
            border:`1px solid ${C.cardLine}`,
            borderRadius:R.xl,
            boxShadow:SHADOW_LG,
            zIndex:200,
            display:'flex', flexDirection:'column',
            overflow:'hidden',
            animation:'toast-in .25s ease-out',
          }}>
            <div style={{
              display:'flex', alignItems:'center', justifyContent:'space-between',
              padding:'18px 22px 14px',
            }}>
              <div style={{display:'flex', alignItems:'center', gap:10, color:C.ink}}>
                <span style={{
                  width:32, height:32, borderRadius:R.pill,
                  background:C.card, border:`1px solid ${C.cardLine}`,
                  display:'inline-flex', alignItems:'center', justifyContent:'center',
                  color:C.ink,
                }}><IconFolder size={14}/></span>
                <div style={{display:'flex', flexDirection:'column', lineHeight:1.15}}>
                  <span style={{fontSize:14, fontWeight:600, letterSpacing:'-.01em'}}>Cronogramas salvos</span>
                  <span style={{color:C.inkDim, fontSize:11, fontWeight:500, letterSpacing:'.04em'}}>
                    {schedules.length} {schedules.length === 1 ? 'item' : 'itens'}
                  </span>
                </div>
              </div>
              <button onClick={()=>setShowDrawer(false)} style={{
                background:C.card, border:`1px solid ${C.cardLine}`, cursor:'pointer',
                color:C.inkSoft, width:32, height:32,
                display:'flex', alignItems:'center', justifyContent:'center',
                borderRadius:R.pill, transition:'background .2s, color .2s',
              }}
              onMouseOver={e=>{e.currentTarget.style.background=C.cardLine; e.currentTarget.style.color=C.ink}}
              onMouseOut={e=>{e.currentTarget.style.background=C.card; e.currentTarget.style.color=C.inkSoft}}
              ><IconClose/></button>
            </div>

            <div style={{
              flex:1, overflowY:'auto', padding:'4px 14px 16px',
              display:'flex', flexDirection:'column', gap:8,
            }}>
              {schedules.length === 0 ? (
                <div style={{
                  padding:'48px 20px', textAlign:'center',
                  color:C.inkDim, fontSize:13, lineHeight:1.6,
                }}>
                  Nenhum cronograma salvo ainda.<br/>
                  Use <strong style={{color:C.ink, fontWeight:600}}>Salvar Cronograma</strong> na barra lateral pra guardar este cronograma.
                </div>
              ) : (
                schedules.map(s => {
                  const active = s.id === currentId
                  // gradient determinístico pelo nome (avatar circular)
                  const seed = (s.name || '').split('').reduce((a,c)=>a+c.charCodeAt(0), 0)
                  const palette = [
                    ['#5b5fee','#1E0FE8'],
                    ['#e0a890','#a06a55'],
                    ['#9a9a92','#5b5b55'],
                    ['#f0c5b3','#c79a85'],
                    ['#3d3d3d','#1a1a1a'],
                  ]
                  const [g1, g2] = palette[seed % palette.length]
                  return (
                    <div key={s.id} style={{
                      display:'flex', alignItems:'center', gap:12,
                      padding:'8px 8px 8px 14px',
                      borderRadius: R.pill,
                      background: active ? `${C.main}10` : C.frame,
                      border:`1px solid ${active ? C.main : C.cardLine}`,
                      transition:'transform .8s cubic-bezier(.19,1,.22,1), box-shadow .8s cubic-bezier(.19,1,.22,1), border-color .3s, background .3s',
                    }}
                    onMouseEnter={e=>{
                      e.currentTarget.style.transform='translateY(-2px) translateX(2px)'
                      e.currentTarget.style.boxShadow='0 10px 24px -10px rgba(10,10,10,.12)'
                    }}
                    onMouseLeave={e=>{
                      e.currentTarget.style.transform='translateY(0) translateX(0)'
                      e.currentTarget.style.boxShadow='none'
                    }}>
                      <span style={{
                        width:36, height:36, borderRadius:R.pill, flexShrink:0,
                        background:`linear-gradient(135deg, ${g1}, ${g2})`,
                      }}/>
                      <button
                        onClick={()=>loadSchedule(s.id)}
                        style={{
                          flex:1, minWidth:0, textAlign:'left',
                          background:'transparent', border:'none', cursor:'pointer',
                          padding:0, display:'flex', flexDirection:'column', gap:1,
                        }}>
                        <div style={{
                          color:C.ink, fontSize:14, fontWeight:600, letterSpacing:'-.01em',
                          whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis',
                        }}>
                          {s.name}
                          <span style={{color:C.main, marginLeft:6, fontWeight:600}}>
                            _v{String(s.version || 1).padStart(2, '0')}
                          </span>
                        </div>
                        <div style={{
                          color:C.inkDim, fontSize:11, fontWeight:500, letterSpacing:'.02em',
                        }}>{fmtSavedAt(s.savedAt)}</div>
                      </button>
                      {active && (
                        <span style={{
                          fontSize:10, fontWeight:600, color:C.white,
                          padding:'4px 10px', borderRadius:R.pill,
                          background:C.main, letterSpacing:'.08em',
                          boxShadow:'0 4px 12px -4px rgba(30,15,232,.4)',
                          flexShrink:0,
                        }}>EDITANDO</span>
                      )}
                      <button
                        onClick={()=>{
                          if (confirm(`Remover "${s.name}"?`)) deleteSchedule(s.id)
                        }}
                        title="Remover"
                        style={{
                          width:32, height:32, flexShrink:0,
                          background:'transparent', border:`1px solid ${C.cardLine}`, cursor:'pointer',
                          color:C.inkSoft, padding:0,
                          display:'flex', alignItems:'center', justifyContent:'center',
                          borderRadius:R.pill,
                          transition:'color .2s, background .2s, border-color .2s',
                        }}
                        onMouseOver={e=>{e.currentTarget.style.color=C.state5; e.currentTarget.style.background=`${C.state5}11`; e.currentTarget.style.borderColor=`${C.state5}44`}}
                        onMouseOut={e=>{e.currentTarget.style.color=C.inkSoft; e.currentTarget.style.background='transparent'; e.currentTarget.style.borderColor=C.cardLine}}
                      ><IconTrash/></button>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </>
      )}

      <div style={{display:'flex', flex:1, minHeight:0}}>

        {/* SIDE RAIL — bloco cinza arredondado descolado */}
        <div style={{flexShrink:0, padding:'18px 14px 18px 18px', background:C.frame}}>
        <aside style={{
          width:56,
          padding:'10px 0',
          display:'flex', flexDirection:'column', alignItems:'center', gap:4,
          background:C.card, border:`1px solid ${C.cardLine}`,
          borderRadius:R.xl,
          height:'fit-content',
        }}>
          {[
            { icon:<IconSearch/>,           title:'Buscar (em breve)',                 onClick:null },
            { icon:<IconMenu/>,             title:'Editar projeto (abre formulário)',  onClick:()=>setShowProjectForm(s=>!s), active:showProjectForm },
            { icon:<IconCheckSquare/>,      title:'Projetos finalizados (em breve)',   onClick:null },
            { icon:<IconUsers/>,            title:'Time (em breve)',                   onClick:null },
            { icon:<IconFolder size={18}/>, title:'Cronogramas salvos',                onClick:()=>setShowDrawer(s=>!s), active:showDrawer },
            { icon:<IconSettings/>,         title:'Configurações (em breve)',          onClick:null },
          ].map((b,i)=>(
            <button
              key={i}
              type="button"
              title={b.title}
              onClick={b.onClick || undefined}
              disabled={!b.onClick}
              style={{
                width:36, height:36, borderRadius:R.pill,
                background: b.active ? C.main : 'transparent',
                color: b.active ? C.white : C.inkSoft,
                border:'1px solid transparent',
                display:'flex', alignItems:'center', justifyContent:'center',
                cursor: b.onClick ? 'pointer' : 'default',
                opacity: b.onClick ? 1 : .5,
                boxShadow: b.active ? SHADOW_BLUE : 'none',
                transition:'background .25s, color .25s, box-shadow .25s',
              }}
              onMouseOver={e=>{ if(!b.active && b.onClick){e.currentTarget.style.background=C.cardLine; e.currentTarget.style.color=C.ink} }}
              onMouseOut={e=>{ if(!b.active){e.currentTarget.style.background='transparent'; e.currentTarget.style.color=C.inkSoft} }}
            >{b.icon}</button>
          ))}
          {/* Toggle de tema — empilhado logo abaixo dos botões */}
          <div style={{
            display:'flex', flexDirection:'column', alignItems:'center', gap:2,
            border:`1px solid ${C.cardLine}`,
            borderRadius:R.pill, padding:3, marginTop:6,
          }}>
            {[
              { mode:'light', icon:<IconSun/> },
              { mode:'dark',  icon:<IconMoon/> },
            ].map(({mode, icon})=>{
              const on = theme === mode
              return (
                <button
                  key={mode}
                  type="button"
                  onClick={()=>setTheme(mode)}
                  title={mode === 'light' ? 'Modo claro' : 'Modo escuro'}
                  style={{
                    width:26, height:26, borderRadius:R.pill,
                    background: on ? C.main : 'transparent',
                    color: on ? C.white : C.inkDim,
                    border:'none', cursor:'pointer',
                    display:'flex', alignItems:'center', justifyContent:'center',
                    boxShadow: on ? SHADOW_BLUE : 'none',
                    transition:'all .25s',
                  }}
                >{icon}</button>
              )
            })}
          </div>
        </aside>
        </div>{/* /side rail wrapper */}

        {/* SIDEBAR — form do projeto (toggle pelo menu da side rail) */}
        <aside style={{
          width: showProjectForm ? 360 : 0,
          flexShrink:0,
          padding: showProjectForm ? '1.75rem 1.5rem' : 0,
          margin: showProjectForm ? '18px 0 18px 0' : 0,
          borderRadius: R.xl,
          border: showProjectForm ? `1px solid ${C.cardLine}` : 'none',
          background:C.card,
          overflow:'hidden',
          transition:'width .3s ease, padding .3s ease',
        }}>

          {/* Projeto */}
          <div style={{marginBottom:28}}>
            <SectionHead right={
              <button
                ref={newBtnRef}
                type="button"
                onClick={toggleNewMenu}
                title="Novo projeto a partir de template"
                style={{
                  display:'inline-flex', alignItems:'center', gap:5,
                  padding:'3px 9px',
                  background: showNewMenu ? C.main : C.white,
                  color:      showNewMenu ? C.white : C.main,
                  border:`1px solid ${showNewMenu ? C.main : C.main + '55'}`,
                  borderRadius:99, fontSize:10, fontWeight:700,
                  letterSpacing:'.06em', cursor:'pointer',
                  textTransform:'uppercase',
                }}
                onMouseOver={e=>{
                  if (showNewMenu) return
                  e.currentTarget.style.background=C.main
                  e.currentTarget.style.color=C.white
                }}
                onMouseOut={e=>{
                  if (showNewMenu) return
                  e.currentTarget.style.background=C.white
                  e.currentTarget.style.color=C.main
                }}
              >
                <IconPlus size={10}/> Novo
                <span style={{
                  display:'inline-flex', alignItems:'center',
                  transform: showNewMenu ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition:'transform .18s',
                }}><IconChevron size={8}/></span>
              </button>
            }>Projeto</SectionHead>

            <label style={labelStyle}>Cliente</label>
            <input style={inputStyle} placeholder="Ex: O Boticário"
              value={config.cliente}
              onChange={e=>set('cliente',e.target.value)}/>

            <label style={{...labelStyle, marginTop:12}}>Nome do projeto</label>
            <input style={inputStyle} placeholder="Ex: Dia das Mães"
              value={config.nomeProjeto}
              onChange={e=>set('nomeProjeto',e.target.value)}/>

            <label style={{...labelStyle, marginTop:12}}>Descrição / escopo</label>
            <textarea style={{...inputStyle, minHeight:64, resize:'vertical'}}
              placeholder="Ex: 1 filme 30s + formatos extra"
              value={config.descricao}
              onChange={e=>set('descricao',e.target.value)}/>

            <label style={{...labelStyle, marginTop:12}}>Entregas</label>
            <textarea style={{...inputStyle, minHeight:64, resize:'vertical'}}
              placeholder="Ex: filme 30s / filme 15s / 16:9 / 9:16 / 4K"
              value={config.entregas}
              onChange={e=>set('entregas',e.target.value)}/>
            <p style={{color:C.inkDim, fontSize:10,
                       marginTop:4, marginBottom:0, lineHeight:1.5}}>
              separe os itens com <b style={{color:C.inkSoft}}>/</b> — cada um vira uma pílula no link de apresentação.
            </p>

            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginTop:12}}>
              <div>
                <label style={labelStyle}>Data início</label>
                <input type="date" style={inputStyle}
                  value={config.dataInicio}
                  onChange={e=>set('dataInicio',e.target.value)}/>
              </div>
              <div>
                <label style={labelStyle}>Deadline</label>
                <input type="date" style={inputStyle}
                  value={config.dataFim}
                  onChange={e=>set('dataFim',e.target.value)}/>
              </div>
            </div>

          </div>

          {/* Etapas do projeto */}
          <div style={{marginBottom:28}}>
            <SectionHead right={`${enabledCount} ativas`}>Etapas do projeto</SectionHead>
            <p style={{color:C.inkDim, fontSize:10,
                       marginTop:-6, marginBottom:12, lineHeight:1.5}}>
              marque as etapas que existem no projeto, defina versões e dias úteis por versão.
            </p>

            {PHASE_META.map(meta => (
              <PhaseField
                key={meta.key}
                label={meta.label}
                color={meta.color}
                hasFeedback={meta.hasFeedback}
                hasOwnDates={meta.hasOwnDates}
                config={config.phases[meta.key]}
                onChange={cfg => setPhase(meta.key, cfg)}
              />
            ))}
          </div>

          {/* Salvar */}
          <SectionHead>Salvar</SectionHead>

          <div style={{display:'flex', gap:8, marginBottom:8}}>
            <button
              onClick={saveCurrent}
              style={{
                flex:1, display:'inline-flex',
                alignItems:'center', justifyContent:'center', gap:8,
                background:C.main, border:`1px solid ${C.main}`,
                borderRadius:R.pill, color:C.white,
                fontWeight:600, fontSize:13, padding:'12px 16px',
                letterSpacing:'-.01em', fontFamily:'inherit',
                cursor:'pointer',
                boxShadow:SHADOW_BLUE,
                transition:'background .25s, box-shadow .25s, transform .25s',
              }}
              onMouseOver={e=>{e.currentTarget.style.background=C.blueDeep; e.currentTarget.style.boxShadow='0 18px 40px -10px rgba(30,15,232,.5)'}}
              onMouseOut={e=>{e.currentTarget.style.background=C.main; e.currentTarget.style.boxShadow=SHADOW_BLUE}}
            >
              <IconSave size={14}/>
              {currentId ? 'Atualizar' : 'Salvar'}
            </button>

            <button
              onClick={duplicateCurrent}
              disabled={!currentId}
              title={currentId ? 'Duplicar como nova versão' : 'Salve antes de duplicar'}
              style={{
                display:'inline-flex',
                alignItems:'center', justifyContent:'center', gap:6,
                background: currentId ? C.frame : C.card,
                border:`1px solid ${currentId ? C.cardLine : C.cardLine}`,
                borderRadius:R.pill,
                color: currentId ? C.ink : C.inkDim,
                fontWeight:600, fontSize:12, padding:'12px 16px',
                letterSpacing:'-.01em', fontFamily:'inherit',
                cursor: currentId ? 'pointer' : 'not-allowed',
                transition:'background .2s, color .2s, border-color .2s',
              }}
              onMouseOver={e=>{
                if (!currentId) return
                e.currentTarget.style.background = C.invertBg
                e.currentTarget.style.color = C.white
                e.currentTarget.style.borderColor = C.invertBg
              }}
              onMouseOut={e=>{
                if (!currentId) return
                e.currentTarget.style.background = C.frame
                e.currentTarget.style.color = C.ink
                e.currentTarget.style.borderColor = C.cardLine
              }}
            >
              <IconCopy size={13}/>
              Duplicar
            </button>
          </div>
          {currentId && (
            <p style={{
              color:C.inkDim, fontSize:10,
              lineHeight:1.5, textAlign:'center', margin:'0 0 18px',
            }}>
              editando "{currentSchedule?.name}_v{String(currentSchedule?.version || 1).padStart(2,'0')}" — <strong style={{color:C.ink}}>Duplicar</strong> cria v{String((currentSchedule?.version || 1) + 1).padStart(2,'0')}
            </p>
          )}

          {/* Exportar */}
          <SectionHead>Exportar</SectionHead>

          <div style={{display:'flex', gap:8, marginBottom:10}}>
            <button
              ref={previewBtnRef}
              type="button"
              onClick={togglePreviewMenu}
              disabled={!!downloading || displayTasks.length === 0}
              style={{
                flex:'0 0 auto', display:'inline-flex',
                alignItems:'center', justifyContent:'center', gap:6,
                background: showPreviewMenu ? C.card : C.frame,
                border:`1px solid ${showPreviewMenu ? C.gray : C.cardLine}`,
                borderRadius:R.pill, color:C.ink,
                fontWeight:600, fontSize:13, padding:'12px 18px',
                letterSpacing:'-.01em', fontFamily:'inherit',
                cursor: downloading || displayTasks.length === 0 ? 'not-allowed' : 'pointer',
                opacity: downloading || displayTasks.length === 0 ? 0.5 : 1,
                transition:'background .2s, border-color .2s',
              }}
              onMouseOver={e=>{ if(!e.currentTarget.disabled && !showPreviewMenu){e.currentTarget.style.background = C.card; e.currentTarget.style.borderColor = C.gray} }}
              onMouseOut={e=>{ if(!showPreviewMenu){e.currentTarget.style.background = C.frame; e.currentTarget.style.borderColor = C.cardLine} }}
            >
              Prévia
              <span style={{
                transform: showPreviewMenu ? 'rotate(-90deg)' : 'rotate(0deg)',
                transition:'transform .18s',
                display:'inline-flex', alignItems:'center',
              }}><IconChevron/></span>
            </button>
            <button
              ref={downloadBtnRef}
              onClick={toggleDownload}
              disabled={!!downloading || displayTasks.length === 0}
              style={{
                flex:1, display:'inline-flex',
                alignItems:'center', justifyContent:'center', gap:8,
                background: C.invertBg, border:'none',
                borderRadius:R.pill, color:C.white,
                fontWeight:600, fontSize:14, padding:'13px',
                letterSpacing:'-.01em', fontFamily:'inherit',
                cursor: downloading || displayTasks.length === 0 ? 'not-allowed' : 'pointer',
                boxShadow:'0 12px 28px -10px rgba(10,10,10,.35)',
                opacity: downloading || displayTasks.length === 0 ? 0.5 : 1,
                transition:'transform .2s, box-shadow .2s, opacity .2s',
              }}
            >
              <IconDownload/>
              {downloading === 'pdf'  ? 'Gerando PDF…' :
               downloading === 'png'  ? 'Gerando PNG…' :
               downloading === 'xlsx' ? 'Gerando XLSX…' :
               'Baixar Cronograma'}
              <span style={{
                transform: showDownload ? 'rotate(-90deg)' : 'rotate(0deg)',
                transition:'transform .18s',
                display:'inline-flex', alignItems:'center',
              }}><IconChevron/></span>
            </button>
          </div>

          {/* Dropdown de export — renderizado via portal pra escapar de
              qualquer stacking context dos pais e ficar sempre por cima */}
          {showDownload && createPortal(
            <>
              <div onClick={()=>setShowDownload(false)}
                   style={{position:'fixed', inset:0, zIndex:9998}}/>
              <div style={{
                position:'fixed',
                bottom: downloadPos.bottom,
                left:   downloadPos.left,
                width: 260,
                background:C.frame,
                border:`1px solid ${C.cardLine}`,
                borderRadius:R.lg,
                boxShadow:SHADOW_LG,
                zIndex:9999,
                padding:6,
              }}>
                {[
                  ['pdf',  'PDF',  'imprimir ou enviar por e-mail'],
                  ['png',  'PNG',  'imagem do cronograma'],
                  ['xlsx', 'XLSX', 'editar no Google Sheets / Excel'],
                ].map(([kind, label, desc]) => (
                  <button
                    key={kind}
                    onClick={()=>handleDownload(kind)}
                    style={{
                      width:'100%', display:'flex',
                      flexDirection:'column', alignItems:'flex-start',
                      gap:2,
                      background:'transparent', border:'none',
                      padding:'10px 14px', borderRadius:12,
                      cursor:'pointer', textAlign:'left', fontFamily:'inherit',
                      transition:'background .2s',
                    }}
                    onMouseOver={e=>e.currentTarget.style.background = C.card}
                    onMouseOut={e=>e.currentTarget.style.background = 'transparent'}
                  >
                    <span style={{
                      color:C.ink, fontSize:13, fontWeight:600, letterSpacing:'-.01em',
                    }}>{label}</span>
                    <span style={{
                      color:C.inkDim, fontSize:11, fontWeight:500,
                    }}>{desc}</span>
                  </button>
                ))}

                {/* Divider */}
                <div style={{height:1, background:C.cardLine, margin:'6px 8px'}}/>

                {/* Enviar — gera link da landing page com os dados embutidos */}
                <button
                  onClick={handleShareLink}
                  style={{
                    width:'100%', display:'flex',
                    flexDirection:'column', alignItems:'flex-start',
                    gap:2,
                    background:'transparent', border:'none',
                    padding:'10px 14px', borderRadius:12,
                    cursor:'pointer', textAlign:'left', fontFamily:'inherit',
                    transition:'background .2s',
                  }}
                  onMouseOver={e=>e.currentTarget.style.background = C.card}
                  onMouseOut={e=>e.currentTarget.style.background = 'transparent'}
                >
                  <span style={{color:C.main, fontSize:13, fontWeight:600, letterSpacing:'-.01em'}}>
                    Enviar link
                  </span>
                  <span style={{color:C.inkDim, fontSize:11, fontWeight:500}}>
                    copia URL da landing page do cliente
                  </span>
                </button>
              </div>
            </>,
            document.body
          )}

          {/* Dropdown da Prévia — link da landing / preview do PDF */}
          {showPreviewMenu && createPortal(
            <>
              <div onClick={()=>setShowPreviewMenu(false)}
                   style={{position:'fixed', inset:0, zIndex:9998}}/>
              <div style={{
                position:'fixed',
                bottom: previewPos.bottom,
                left:   previewPos.left,
                width: 240,
                background:C.frame,
                border:`1px solid ${C.cardLine}`,
                borderRadius:R.lg,
                boxShadow:SHADOW_LG,
                zIndex:9999,
                padding:6,
              }}>
                <button
                  onClick={()=>{ setShowPreviewMenu(false); handleShareLink() }}
                  style={{
                    width:'100%', display:'flex',
                    flexDirection:'column', alignItems:'flex-start',
                    gap:2,
                    background:'transparent', border:'none',
                    padding:'10px 14px', borderRadius:12,
                    cursor:'pointer', textAlign:'left', fontFamily:'inherit',
                    transition:'background .2s',
                  }}
                  onMouseOver={e=>e.currentTarget.style.background = C.card}
                  onMouseOut={e=>e.currentTarget.style.background = 'transparent'}
                >
                  <span style={{color:C.ink, fontSize:13, fontWeight:600, letterSpacing:'-.01em'}}>
                    Prévia link
                  </span>
                  <span style={{color:C.inkDim, fontSize:11, fontWeight:500}}>
                    abre a landing do cliente em nova aba
                  </span>
                </button>
                <button
                  onClick={()=>{ setShowPreviewMenu(false); setShowPreview(true) }}
                  style={{
                    width:'100%', display:'flex',
                    flexDirection:'column', alignItems:'flex-start',
                    gap:2,
                    background:'transparent', border:'none',
                    padding:'10px 14px', borderRadius:12,
                    cursor:'pointer', textAlign:'left', fontFamily:'inherit',
                    transition:'background .2s',
                  }}
                  onMouseOver={e=>e.currentTarget.style.background = C.card}
                  onMouseOut={e=>e.currentTarget.style.background = 'transparent'}
                >
                  <span style={{color:C.ink, fontSize:13, fontWeight:600, letterSpacing:'-.01em'}}>
                    Prévia PDF
                  </span>
                  <span style={{color:C.inkDim, fontSize:11, fontWeight:500}}>
                    visualiza o frame que será exportado
                  </span>
                </button>
              </div>
            </>,
            document.body
          )}

          <p style={{color:C.inkDim, fontSize:10,
                     lineHeight:1.5, textAlign:'center', margin:0}}>
            PDF/PNG capturam o cronograma como imagem.<br/>
            XLSX edita no Google Sheets · Link abre a landing.
          </p>
        </aside>

        {/* PREVIEW AREA */}
        <main style={{flex:1, padding:'1.75rem', overflowX:'auto', minWidth:0,
                      background:C.frame}}>
          {/* Bloco cinza envolvendo o preview do Gantt */}
          <div style={{
            background:C.card, border:`1px solid ${C.cardLine}`,
            borderRadius:R.xl, padding:18, marginBottom:24,
          }}>
          <SectionHead right={`${displayTasks.length} tarefas`}>
            Preview em tempo real
          </SectionHead>

          {/* Alerta vermelho — entrega final ultrapassou o deadline */}
          {overflowDays > 0 && displayTasks.length > 0 && (
            <div style={{
              background: C.state5,
              color: C.white,
              padding:'12px 16px',
              borderRadius:12,
              marginBottom:14,
              display:'flex', alignItems:'center', gap:12,
              boxShadow:`0 4px 18px ${C.state5}44`,
            }}>
              <span style={{
                width:26, height:26, borderRadius:'50%', flexShrink:0,
                background:C.white, color:C.state5,
                display:'flex', alignItems:'center', justifyContent:'center',
                fontSize:15, fontWeight:800,
              }}>!</span>
              <div style={{flex:1, lineHeight:1.4}}>
                <div style={{fontSize:13, fontWeight:800}}>
                  Cronograma ultrapassou a data de entrega em {overflowDays} {overflowDays === 1 ? 'dia' : 'dias'}.
                </div>
                <div style={{fontSize:11, fontWeight:500, opacity:.92, marginTop:2}}>
                  Reduza as durações nas etapas ou estenda o deadline para remover este alerta.
                </div>
              </div>
            </div>
          )}

          {/* Alerta laranja — só Reduções estendem após a entrega final */}
          {overflowDays === 0 && reducoesAfterDeadline && displayTasks.length > 0 && (
            <div style={{
              background: C.state4,
              color: C.white,
              padding:'10px 14px',
              borderRadius:12,
              marginBottom:14,
              display:'flex', alignItems:'center', gap:12,
              boxShadow:`0 4px 14px ${C.state4}33`,
            }}>
              <span style={{
                width:22, height:22, borderRadius:'50%', flexShrink:0,
                background:C.white, color:C.state4,
                display:'flex', alignItems:'center', justifyContent:'center',
                fontSize:12, fontWeight:800,
              }}>i</span>
              <div style={{flex:1, lineHeight:1.4, fontSize:12, fontWeight:700}}>
                Reduções e Formatos serão entregues após a entrega do material final.
              </div>
            </div>
          )}

          {displayTasks.length > 0
            ? <GanttPreview
                config={config}
                tasks={displayTasks}
                onTaskChange={handleTaskStatusChange}
                innerRef={ganttRef}
                version={currentSchedule?.version || 1}/>
            : <div style={{
                border:`1px dashed ${C.gray}`, borderRadius:14,
                padding:'4rem', textAlign:'center', color:C.inkDim,
                fontSize:13, background:C.frame
              }}>
                preencha as datas e ative ao menos uma etapa para ver o cronograma
              </div>
          }
          </div>{/* /bloco cinza preview */}

          {displayTasks.length > 0 && (
            <div style={{
              marginTop:0,
              padding:'18px',
              background:C.card,
              border:`1px solid ${C.cardLine}`,
              borderRadius:R.xl,
            }}>
            <div style={{
              display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))',
              gap:12,
            }}>
              {[
                { label:'Total de tarefas', val:displayTasks.length,                                          dot:null,        hero:true  },
                { label:'Concluídas',       val:displayTasks.filter(t=>t.status==='CONCLUÍDO').length,        dot:C.state1,    hero:false },
                { label:'Em andamento',     val:displayTasks.filter(t=>t.status==='EM ANDAMENTO').length,     dot:C.state4,    hero:false },
                { label:'A realizar',       val:displayTasks.filter(t=>t.status==='A REALIZAR').length,       dot:C.gray,      hero:false },
                { label:'Atrasadas',        val:displayTasks.filter(t=>t.status==='ATRASADO').length,         dot:C.state5,    hero:false, dark:true },
              ].map(({label, val, dot, hero, dark})=>{
                const isHero = !!hero
                const isDark = !!dark
                const bg = isHero ? C.main : (isDark ? C.invertBg : C.frame)
                const fg = isHero || isDark ? C.white : C.ink
                const sub = isHero ? 'rgba(255,255,255,.8)' : (isDark ? 'rgba(255,255,255,.65)' : C.inkSoft)
                const shadow = isHero ? SHADOW_BLUE : SHADOW
                return (
                  <div
                    key={label}
                    style={{
                      background: bg, color: fg,
                      border: isHero || isDark ? '1px solid transparent' : `1px solid ${C.cardLine}`,
                      borderRadius: R.xl, padding:'22px 22px 20px',
                      boxShadow: shadow,
                      position:'relative', overflow:'hidden',
                      display:'flex', flexDirection:'column', gap:14,
                      minHeight:140,
                      transition:'transform .9s cubic-bezier(.19,1,.22,1), box-shadow .9s cubic-bezier(.19,1,.22,1)',
                    }}
                    onMouseEnter={e=>{
                      e.currentTarget.style.transform='translateY(-3px)'
                      e.currentTarget.style.boxShadow = isHero
                        ? '0 22px 50px -12px rgba(30,15,232,.45)'
                        : '0 16px 40px -12px rgba(10,10,10,.12)'
                    }}
                    onMouseLeave={e=>{
                      e.currentTarget.style.transform='translateY(0)'
                      e.currentTarget.style.boxShadow = shadow
                    }}
                  >
                    {/* glow decorativo no card hero */}
                    {isHero && (
                      <div style={{
                        position:'absolute', top:'-30%', right:'-30%',
                        width:'80%', height:'120%',
                        background:'radial-gradient(circle, rgba(255,255,255,.18), transparent 60%)',
                        pointerEvents:'none',
                      }}/>
                    )}
                    <div style={{
                      display:'flex', alignItems:'center', justifyContent:'space-between',
                      gap:10, position:'relative', zIndex:1,
                    }}>
                      <div style={{display:'flex', alignItems:'center', gap:8}}>
                        {dot && (
                          <span style={{
                            width:8, height:8, borderRadius:R.pill,
                            background: dot, display:'inline-block',
                          }}/>
                        )}
                        <span style={{
                          fontSize:11, fontWeight:600, letterSpacing:'.08em',
                          textTransform:'uppercase', color: sub,
                        }}>{label}</span>
                      </div>
                      <div style={{
                        width:30, height:30, borderRadius:R.pill,
                        background: isHero ? 'rgba(255,255,255,.18)' : (isDark ? 'rgba(255,255,255,.08)' : C.card),
                        color: fg,
                        display:'flex', alignItems:'center', justifyContent:'center',
                        fontSize:13, transform:'rotate(-45deg)', flexShrink:0,
                        border: isHero || isDark ? 'none' : `1px solid ${C.cardLine}`,
                      }}>↗</div>
                    </div>
                    <div style={{
                      fontSize:48, fontWeight:300, letterSpacing:'-.04em',
                      lineHeight:.95, color: fg, marginTop:'auto',
                      position:'relative', zIndex:1,
                      fontVariantNumeric:'tabular-nums',
                    }}>{val}</div>
                  </div>
                )
              })}
            </div>
            </div>
          )}

          {/* WRAPPER — largura controlada pros blocos de Etapas/Calendário/Análise */}
          <div style={{maxWidth: 880, width: '100%', margin: '0 auto'}}>

          {/* TIMELINE HORIZONTAL — pílula com dias da fase em andamento */}
          {displayTasks.length > 0 && (() => {
            const active = displayTasks.find(t => t.status === 'EM ANDAMENTO')
                        || displayTasks.find(t => t.status === 'A REALIZAR')
            if (!active) return null
            const ini = isoToDate(active.dIni)
            const fim = isoToDate(active.dFim)
            const start = new Date(ini); start.setDate(start.getDate() - 2)
            const end   = new Date(fim); end.setDate(end.getDate() + 4)
            const list = []
            const cursor = new Date(start)
            while (cursor <= end) { list.push(new Date(cursor)); cursor.setDate(cursor.getDate() + 1) }
            const inActive = (d) => d >= ini && d <= fim
            const monthName = MESES_PT[ini.getMonth()+1]
            // Bolinha lateral: FDS preto / resto branco
            const renderDayPill = (d, key) => {
              const isFds = d.getDay() === 0 || d.getDay() === 6
              return (
                <div key={key} style={{
                  width:48, height:48, borderRadius:R.pill, flexShrink:0,
                  background: isFds ? C.invertBg : C.frame,
                  color:      isFds ? C.white    : C.inkSoft,
                  border:     isFds ? '1px solid transparent' : `1px solid ${C.cardLine}`,
                  display:'flex', alignItems:'center', justifyContent:'center',
                  fontSize:13, fontWeight:600,
                  fontVariantNumeric:'tabular-nums',
                }}>{String(d.getDate()).padStart(2,'0')}</div>
              )
            }
            return (
              <div style={{
                marginTop:24,
                background:C.card, border:`1px solid ${C.cardLine}`,
                borderRadius:R.xl, padding:'22px',
              }}>
                <div style={{
                  display:'flex', alignItems:'flex-end', justifyContent:'space-between',
                  marginBottom:16, gap:16, flexWrap:'wrap',
                }}>
                  <div style={{
                    fontSize:22, fontWeight:600, letterSpacing:'-.02em', color:C.ink,
                  }}>Cronograma de Etapas</div>
                  <div style={{fontSize:12, color:C.inkDim, fontWeight:500}}>
                    {monthName} · {ini.getFullYear()}
                  </div>
                </div>
                <div>
                  <div style={{display:'flex', alignItems:'center', gap:8, overflowX:'auto', paddingBottom:4}}>
                    {/* dias antes */}
                    {list.filter(d => d < ini).slice(-2).map((d, i) => renderDayPill(d, `pre-${i}`))}
                    {/* pílula azul com os dias da fase ativa */}
                    <div style={{
                      display:'flex', alignItems:'center', gap:18, flexShrink:0,
                      background:C.main, color:C.white,
                      borderRadius:R.pill, padding:'8px 18px 8px 14px',
                      height:48, boxShadow:SHADOW_BLUE,
                    }}>
                      {list.filter(inActive).map((d, i) => {
                        const dow = ['dom','seg','ter','qua','qui','sex','sab'][d.getDay()]
                        return (
                          <div key={`act-${i}`} style={{
                            textAlign:'center', lineHeight:1, position:'relative',
                            color:C.white, fontSize:14, fontWeight:600,
                          }}>
                            <div style={{fontVariantNumeric:'tabular-nums'}}>{String(d.getDate()).padStart(2,'0')}</div>
                            <div style={{
                              fontSize:9, fontWeight:500, letterSpacing:'.06em',
                              color:'rgba(255,255,255,.7)', marginTop:3,
                            }}>{dow}</div>
                          </div>
                        )
                      })}
                      <div style={{
                        borderLeft:'1px solid rgba(255,255,255,.25)',
                        paddingLeft:16, lineHeight:1.2,
                      }}>
                        <div style={{fontSize:13, fontWeight:600, color:C.white}}>{active.faseNome || 'Fase'}</div>
                        <div style={{fontSize:10, color:'rgba(255,255,255,.75)', letterSpacing:'.06em'}}>Ativo</div>
                      </div>
                    </div>
                    {/* dias depois */}
                    {list.filter(d => d > fim).slice(0, 4).map((d, i) => renderDayPill(d, `post-${i}`))}
                  </div>
                </div>
              </div>
            )
          })()}

          {/* GRID Calendário + Análise — lado-a-lado no desktop, empilha no mobile */}
          <div style={{
            display:'grid',
            gridTemplateColumns:'repeat(auto-fit, minmax(360px, 1fr))',
            gap:16, marginTop:24,
          }}>

          {/* CALENDÁRIO MENSAL — visão do mês com bolinhas */}
          {displayTasks.length > 0 && (() => {
            const refDate = isoToDate(config.dataInicio || TODAY)
            const month = refDate.getMonth()
            const year = refDate.getFullYear()
            const taskRanges = displayTasks.map(t => ({
              dIni: t.dIni, dFim: t.dFim, cor: t.cor, status: t.status,
            }))
            return (
              <div style={{
                background:C.card, border:`1px solid ${C.cardLine}`,
                borderRadius:R.xl, padding:'22px',
                display:'flex', flexDirection:'column', gap:18,
              }}>
                <div style={{
                  display:'flex', alignItems:'flex-end', justifyContent:'space-between',
                  gap:16, flexWrap:'wrap',
                }}>
                  <div>
                    <div style={{fontSize:11, fontWeight:600, color:C.inkDim, letterSpacing:'.12em', textTransform:'uppercase'}}>Calendário</div>
                    <div style={{fontSize:22, fontWeight:600, color:C.ink, letterSpacing:'-.02em', lineHeight:1.15, marginTop:2}}>
                      {MESES_PT[month+1]} <span style={{color:C.inkDim, fontWeight:400}}>· {year}</span>
                    </div>
                  </div>
                  <div style={{display:'flex', alignItems:'center', gap:12, fontSize:11, color:C.inkSoft, fontWeight:500}}>
                    <span style={{display:'flex', alignItems:'center', gap:6}}>
                      <span style={{width:8, height:8, borderRadius:R.pill, background:C.main}}/>
                      Hoje
                    </span>
                    <span style={{display:'flex', alignItems:'center', gap:6}}>
                      <span style={{width:8, height:8, borderRadius:R.pill, background:C.invertBg}}/>
                      Deadline
                    </span>
                  </div>
                </div>
                <MonthCalendar
                  year={year}
                  month={month}
                  tasks={taskRanges}
                  holidays={config.holidays}
                  deadline={config.dataFim}
                  today={TODAY}
                />
              </div>
            )
          })()}

          {/* BARRAS HORIZONTAIS — análise de etapas por status */}
          {displayTasks.length > 0 && (() => {
            const total = displayTasks.length
            const concl = displayTasks.filter(t=>t.status==='CONCLUÍDO').length
            const andam = displayTasks.filter(t=>t.status==='EM ANDAMENTO').length
            const pend  = displayTasks.filter(t=>t.status==='A REALIZAR' || t.status==='ATRASADO').length
            const pct = (n) => total ? Math.round((n / total) * 100) : 0
            const bars = [
              { label:'Em andamento', count: andam, pct: pct(andam), bg: C.main,      fg: C.white,            sub: 'rgba(255,255,255,.75)' },
              { label:'Concluído',    count: concl, pct: pct(concl), bg: '#5b5b55',   fg: C.white,            sub: 'rgba(255,255,255,.7)' },
              { label:'Pendente',     count: pend,  pct: pct(pend),  bg: C.invertBg,  fg: C.invertText,       sub: 'rgba(255,255,255,.55)' },
            ]
            return (
              <div style={{
                background:C.card, border:`1px solid ${C.cardLine}`,
                borderRadius:R.xl, padding:'22px',
              }}>
                <div style={{
                  display:'flex', alignItems:'flex-end', justifyContent:'space-between',
                  marginBottom:16, gap:16, flexWrap:'wrap',
                }}>
                  <div>
                    <div style={{
                      fontSize:22, fontWeight:600, letterSpacing:'-.02em', color:C.ink,
                      display:'flex', alignItems:'center', gap:10,
                    }}>
                      Análise de Etapas
                      <span style={{
                        width:28, height:28, borderRadius:R.pill,
                        background:C.frame, border:`1px solid ${C.cardLine}`,
                        display:'inline-flex', alignItems:'center', justifyContent:'center',
                        color:C.main, fontSize:12, transform:'rotate(-45deg)',
                      }}>↗</span>
                    </div>
                    <div style={{fontSize:12, color:C.inkDim, fontWeight:500, marginTop:4, letterSpacing:'.02em'}}>
                      Distribuição do progresso por status
                    </div>
                  </div>
                </div>
                <div style={{display:'flex', flexDirection:'column', gap:10}}>
                  {bars.map(b => (
                    <div key={b.label} style={{
                      background:b.bg, color:b.fg,
                      borderRadius:R.lg, padding:'18px 22px',
                      display:'flex', alignItems:'center', justifyContent:'space-between',
                      transition:'transform 1.1s cubic-bezier(.19,1,.22,1), box-shadow 1.1s cubic-bezier(.19,1,.22,1)',
                      boxShadow: b.bg === C.main ? SHADOW_BLUE : 'none',
                    }}
                    onMouseEnter={e=>{
                      e.currentTarget.style.transform='translateY(-3px)'
                    }}
                    onMouseLeave={e=>{
                      e.currentTarget.style.transform='translateY(0)'
                    }}>
                      <div>
                        <div style={{
                          fontSize:30, fontWeight:600, letterSpacing:'-.03em',
                          lineHeight:1, fontVariantNumeric:'tabular-nums',
                        }}>{String(b.pct).padStart(2,'0')}%</div>
                        <div style={{
                          fontSize:10, fontWeight:600, color:b.sub,
                          letterSpacing:'.16em', textTransform:'uppercase', marginTop:6,
                        }}>{b.label}</div>
                      </div>
                      <div style={{
                        fontSize:16, fontWeight:600, color:b.sub,
                        fontVariantNumeric:'tabular-nums',
                      }}>{String(b.count).padStart(2,'0')}</div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })()}

          </div>

          </div>
        </main>
      </div>
    </div>
    </div>
  )
}

const labelStyle = {
  display:'block', fontSize:10, fontWeight:600,
  letterSpacing:'.1em', textTransform:'uppercase',
  color:C.inkSoft, marginBottom:7
}
const inputStyle = {
  width:'100%', background:C.frame,
  border:`1px solid ${C.cardLine}`, borderRadius:12,
  color:C.ink,
  fontSize:13, padding:'10px 14px', outline:'none',
  display:'block', boxSizing:'border-box',
  fontFamily:'inherit',
  transition:'border-color .2s, box-shadow .2s, background .2s',
}
const miniLabel = {
  fontSize:9, fontWeight:700, letterSpacing:'.08em',
  color:C.inkDim, textTransform:'uppercase',
}
