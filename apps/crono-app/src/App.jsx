import { useState, useMemo, useRef, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'
import {
  buildSchedule, calendarDates, isoToDate, dateToIso,
  DIAS_PT, MESES_PT, STATUS_LIST, STATUS_COLORS,
  DEFAULT_PHASES, PHASE_META
} from './scheduleEngine'
import { exportXLSX } from './exportXLSX'
import { exportPNG, exportPDF } from './exportImage'
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
const STORAGE_KEY = 'crono-app:schedules'
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

// ── Design tokens (paleta brand) ─────────────────────────────────────────────
const C = {
  main:    '#2D7BF3',
  sub:     '#CCE5FF',
  white:   '#FFFFFF',
  ink:     '#16181E',
  gray:    '#A7BBDA',
  bg:      '#F6F8FB',
  border:  '#E4ECF6',
  state1:  '#28CDA5',
  state2:  '#48CE76',
  state3:  '#F7CE46',
  state4:  '#F49931',
  state5:  '#F9513F',
  inkSoft: '#5B6675',
  inkDim:  '#8A95A6',
}
const GRAD_BRAND = `linear-gradient(90deg, ${C.main} 0%, ${C.sub} 100%)`
const SHADOW     = '0 1px 2px rgba(22,24,30,.04), 0 8px 24px rgba(45,123,243,.06)'
const SHADOW_LG  = '0 8px 32px rgba(45,123,243,.12), 0 2px 8px rgba(22,24,30,.04)'

const DEFAULT_CONFIG = {
  nomeProjeto: '',
  descricao: '',
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

  const PAST_TINT    = '#FEE7E3' // vermelho pastel pra células após deadline
  const HOLIDAY_TINT = '#FED7CC' // vermelho pastel claro pra feriados

  return (
    <div style={{
      overflowX:'auto',
      background:C.white,
      borderRadius:14,
      border:`1px solid ${C.border}`,
      boxShadow:SHADOW_LG,
    }}>
      <div ref={innerRef} style={{minWidth: COL_W + dates.length*DAY_W, fontSize:11}}>

        {/* Header gradient */}
        <div style={{display:'flex', background:GRAD_BRAND, height:44, alignItems:'center'}}>
          <div style={{width:COL_W, paddingLeft:16,
                       fontWeight:800, fontSize:18, color:C.white, letterSpacing:'-.02em'}}>
            tressde
          </div>
          <div style={{flex:1, height:'100%', display:'flex',
                       alignItems:'center', justifyContent:'center',
                       fontWeight:700, fontSize:16,
                       color:C.white, letterSpacing:'.01em'}}>
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

        {/* Dias semana + números */}
        {[0,1].map(rowIdx=>(
          <div key={rowIdx} style={{display:'flex', background:C.white, height:14}}>
            <div style={{width:COL_W, borderRight:`1px solid ${C.border}`}}/>
            {dates.map((d,i)=>{
              const isFds = d.getDay()===0||d.getDay()===6
              const isHol = isHolidayDate(d)
              const dow   = d.getDay()===0?6:d.getDay()-1
              const past  = deadlineIdx >= 0 && i > deadlineIdx
              const atDeadline = i === deadlineIdx
              let bg = C.white
              if (isHol) bg = HOLIDAY_TINT
              else if (isFds) bg = C.sub
              if (past && !isHol && !isFds) bg = PAST_TINT
              return (
                <div key={i} style={{
                  width:DAY_W, height:'100%',
                  background: bg,
                  borderRight: atDeadline
                    ? `2px solid ${C.state5}`
                    : `1px solid ${C.border}`,
                  display:'flex',alignItems:'center',justifyContent:'center',
                  color: isHol||isFds ? C.state5 : C.inkDim, fontSize:9, fontWeight:600
                }}>
                  {rowIdx===0 ? DIAS_PT[dow] : d.getDate()}
                </div>
              )
            })}
          </div>
        ))}

        {/* Header colunas */}
        <div style={{display:'flex', background:C.bg, height:24,
                     borderTop:`1px solid ${C.border}`,
                     borderBottom:`1px solid ${C.border}`}}>
          <div style={{
            width:FASE_W, color:C.inkSoft, fontSize:9, fontWeight:700, letterSpacing:'.1em',
            display:'flex', alignItems:'center', justifyContent:'center',
            borderRight:`1px solid ${C.border}`,
          }}>FASE</div>
          <div style={{flex:1, color:C.inkSoft,fontSize:9,fontWeight:700,letterSpacing:'.1em',
                       display:'flex',alignItems:'center',paddingLeft:10}}>TAREFA</div>
          <div style={{width:120, color:C.inkSoft,fontSize:9,fontWeight:700,letterSpacing:'.1em',
                       display:'flex',alignItems:'center',justifyContent:'center'}}>STATUS</div>
          <div style={{width:DAY_W * dates.length}}/>
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
                  background: group.faseNum != null ? '#EEF1F6' : '#F6F8FB',
                  border:`1px solid ${C.border}`,
                  borderRadius:6,
                  display:'flex', alignItems:'center', justifyContent:'center',
                  gap:10, padding:'3px 10px',
                }}>
                  {group.faseNum != null && (
                    <>
                      <span style={{
                        fontSize:15, fontWeight:800, color:C.ink,
                        lineHeight:1, fontVariantNumeric:'tabular-nums',
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
                          background:sc.bg, color:sc.fg,
                          fontSize:9, fontWeight:700,
                          display:'flex', alignItems:'center', justifyContent:'center',
                          letterSpacing:'.04em',
                        }}>{task.status}</div>
                      ) : (
                        <select
                          value={task.status}
                          onChange={e=> onTaskChange(task.id, e.target.value)}
                          style={{
                            width:120,
                            background:sc.bg, color:sc.fg,
                            border:'none', fontSize:9, fontWeight:700,
                            cursor:'pointer',
                            textAlign:'center', textAlignLast:'center', outline:'none',
                            appearance:'none', WebkitAppearance:'none',
                            letterSpacing:'.04em',
                          }}
                        >
                          {STATUS_LIST.map(s=>(
                            <option key={s} value={s} style={{background:C.white,color:C.ink}}>{s}</option>
                          ))}
                        </select>
                      )}

                      {dates.map((d,i)=>{
                        const isFds  = d.getDay()===0||d.getDay()===6
                        const isHol  = isHolidayDate(d)
                        const inRange = d>=dIni && d<=dFim
                        const isLast  = d.toDateString()===dFim.toDateString()
                        const past   = deadlineIdx >= 0 && i > deadlineIdx
                        const afterDeadline = i === deadlineIdx + 1 && deadlineIdx >= 0
                        // FDS e feriado SEMPRE mantêm sua cor — mesmo quando a
                        // tarefa atravessa esses dias (cronograma real "pula"
                        // esses dias visualmente, igual ao engine que não
                        // executa neles)
                        let bg
                        if (isHol)          bg = HOLIDAY_TINT
                        else if (isFds)     bg = C.sub
                        else if (inRange)   bg = task.cor
                        else if (past)      bg = PAST_TINT
                        else                bg = C.white
                        return (
                          <div key={i} style={{
                            width:DAY_W,
                            background: bg,
                            borderLeft: afterDeadline
                              ? `2px solid ${C.state5}`
                              : `1px solid ${C.border}`,
                            display:'flex', alignItems:'center', justifyContent:'center',
                            fontSize:8, fontWeight:800,
                            color: inRange ? C.white : 'transparent',
                          }}>
                            {inRange && isLast && task.horario ? task.horario : ''}
                          </div>
                        )
                      })}
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
            ['FIM DE SEMANA',C.sub,    C.main],
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
      background: enabled ? C.white : '#FAFBFD',
      border: `1px solid ${C.border}`,
      borderRadius: 10,
      padding: '10px 12px',
      marginBottom: 8,
      transition: 'background .15s',
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
          display:'flex', alignItems:'center', gap:10,
          cursor:'pointer', userSelect:'none',
          opacity: enabled ? 1 : 0.55,
          transition:'opacity .15s',
        }}
      >
        <input
          type="checkbox" checked={enabled}
          onClick={e => e.stopPropagation()}
          onChange={e => onChange({...config, enabled: e.target.checked})}
          style={{accentColor: C.main, width:15, height:15, cursor:'pointer', margin:0,
                  flexShrink:0}}
        />
        <span style={{
          width:10, height:10, borderRadius:'50%', background:color,
          boxShadow:`0 0 0 3px ${color}22`,
          display:'inline-block', flexShrink:0,
        }}/>
        <span style={{
          flex:1, color:C.ink, fontSize:12,
          fontWeight:600, whiteSpace:'nowrap',
          overflow:'hidden', textOverflow:'ellipsis',
        }}>{label}</span>

        <span
          aria-hidden="true"
          style={{
            width:24, height:24, flexShrink:0,
            color:C.inkSoft,
            display:'flex', alignItems:'center', justifyContent:'center',
            transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
            transition:'transform .18s',
          }}
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M3 1.5L7 5L3 8.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
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

// ── Section heading ──────────────────────────────────────────────────────────
function SectionHead({ children, right }) {
  // se `right` for string, embrulha em span com tipografia de heading;
  // se for elemento React (botão etc), renderiza direto
  const renderedRight = typeof right === 'string'
    ? <span style={{color:C.inkDim, fontWeight:600, letterSpacing:'.05em'}}>{right}</span>
    : right
  return (
    <div style={{
      fontSize:10, fontWeight:800, letterSpacing:'.12em',
      color:C.main, textTransform:'uppercase',
      marginBottom:14, display:'flex', alignItems:'center', gap:10
    }}>
      <span>{children}</span>
      <div style={{flex:1, height:1, background:C.border}}/>
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

  // Menu de Novo projeto (templates)
  const newBtnRef = useRef(null)
  const [showNewMenu, setShowNewMenu] = useState(false)
  const [newMenuPos,  setNewMenuPos]  = useState({top: 0, left: 0})

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

  function toggleDownload() {
    if (showDownload) { setShowDownload(false); return }
    const r = downloadBtnRef.current?.getBoundingClientRect()
    if (r) setDownloadPos({
      bottom: window.innerHeight - r.bottom,
      left: r.right + 8,
    })
    setShowDownload(true)
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
    const template = TEMPLATES[templateKey] || TEMPLATES.branco
    // mescla phases do template com DEFAULT_PHASES (garante campos novos)
    const phases = { ...DEFAULT_PHASES }
    for (const [key, override] of Object.entries(template.phases)) {
      phases[key] = { ...DEFAULT_PHASES[key], ...override }
    }
    setConfig({ ...DEFAULT_CONFIG, phases })
    setStatusOverrides({})
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
        position:'sticky', top:0, zIndex:100,
        background:'rgba(255,255,255,.85)', backdropFilter:'blur(12px)',
        borderBottom:`1px solid ${C.border}`,
        padding:'0 2rem', height:60,
        display:'flex', alignItems:'center', justifyContent:'space-between',
      }}>
        <div style={{display:'flex', alignItems:'center', gap:14}}>
          <div style={{
            width:32, height:32, borderRadius:8,
            background:GRAD_BRAND,
            boxShadow:SHADOW,
          }}/>
          <div style={{fontWeight:800, fontSize:18, letterSpacing:'-.03em', color:C.ink}}>
            tress<span style={{
              background:GRAD_BRAND,
              WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent',
              backgroundClip:'text',
            }}>de</span>
            <span style={{color:C.gray, margin:'0 .6rem', fontWeight:300}}>/</span>
            <span style={{color:C.inkSoft, fontWeight:500, fontSize:14}}>gerador de cronograma</span>
          </div>
        </div>
        <div style={{display:'flex', alignItems:'center', gap:10}}>
          <button
            type="button"
            onClick={()=>setShowDrawer(s => !s)}
            style={{
              display:'inline-flex', alignItems:'center', gap:8,
              padding:'7px 14px',
              background: showDrawer ? C.main : C.white,
              color: showDrawer ? C.white : C.ink,
              border:`1px solid ${showDrawer ? C.main : C.border}`,
              borderRadius:99, fontSize:12, fontWeight:700,
              cursor:'pointer',
              boxShadow: showDrawer ? `0 4px 12px ${C.main}33` : SHADOW,
              transition:'background .15s, color .15s, border-color .15s',
            }}
          >
            <IconFolder/>
            Cronogramas
            {schedules.length > 0 && (
              <span style={{
                minWidth:18, height:18, padding:'0 6px',
                background: showDrawer ? C.white : C.main,
                color: showDrawer ? C.main : C.white,
                borderRadius:99, fontSize:10, fontWeight:800,
                display:'inline-flex', alignItems:'center', justifyContent:'center',
              }}>{schedules.length}</span>
            )}
          </button>
          <div style={{
            fontSize:11,
            padding:'5px 12px', border:`1px solid ${C.gray}`,
            borderRadius:99, color:C.inkSoft, letterSpacing:'.05em', fontWeight:600
          }}>v1.0</div>
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
            position:'fixed', top:74, right:24,
            width:380, maxHeight:'70vh',
            background:C.white,
            border:`1px solid ${C.border}`,
            borderRadius:14,
            boxShadow:SHADOW_LG,
            zIndex:200,
            display:'flex', flexDirection:'column',
          }}>
            <div style={{
              display:'flex', alignItems:'center', justifyContent:'space-between',
              padding:'14px 16px',
              borderBottom:`1px solid ${C.border}`,
            }}>
              <div style={{display:'flex', alignItems:'center', gap:8, color:C.ink}}>
                <IconFolder size={16}/>
                <span style={{fontSize:13, fontWeight:800}}>Cronogramas salvos</span>
                <span style={{color:C.inkDim, fontSize:11, fontWeight:500}}>
                  {schedules.length}
                </span>
              </div>
              <button onClick={()=>setShowDrawer(false)} style={{
                background:'transparent', border:'none', cursor:'pointer',
                color:C.inkSoft, padding:4, display:'flex',
                alignItems:'center', justifyContent:'center', borderRadius:6,
              }}><IconClose/></button>
            </div>

            <div style={{
              flex:1, overflowY:'auto', padding:8,
            }}>
              {schedules.length === 0 ? (
                <div style={{
                  padding:'40px 20px', textAlign:'center',
                  color:C.inkDim, fontSize:12, lineHeight:1.5,
                }}>
                  Nenhum cronograma salvo ainda.<br/>
                  Use <strong style={{color:C.ink}}>Salvar Cronograma</strong> na barra lateral pra guardar este cronograma.
                </div>
              ) : (
                schedules.map(s => {
                  const active = s.id === currentId
                  return (
                    <div key={s.id} style={{
                      display:'flex', alignItems:'center', gap:10,
                      padding:'10px 12px',
                      borderRadius:10,
                      background: active ? `${C.main}11` : 'transparent',
                      border:`1px solid ${active ? `${C.main}55` : 'transparent'}`,
                      marginBottom:4,
                      transition:'background .15s',
                    }}>
                      <button
                        onClick={()=>loadSchedule(s.id)}
                        style={{
                          flex:1, minWidth:0, textAlign:'left',
                          background:'transparent', border:'none', cursor:'pointer',
                          padding:0,
                        }}>
                        <div style={{
                          color:C.ink, fontSize:13, fontWeight:700,
                          whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis',
                          marginBottom:2,
                        }}>
                          {s.name}
                          <span style={{color:C.main, marginLeft:6, fontWeight:800}}>
                            _v{String(s.version || 1).padStart(2, '0')}
                          </span>
                        </div>
                        <div style={{
                          color:C.inkDim, fontSize:10, fontWeight:500,
                        }}>{fmtSavedAt(s.savedAt)}</div>
                      </button>
                      {active && (
                        <span style={{
                          fontSize:9, fontWeight:800, color:C.main,
                          padding:'2px 8px', borderRadius:99,
                          background:`${C.main}22`, letterSpacing:'.06em',
                        }}>EDITANDO</span>
                      )}
                      <button
                        onClick={()=>{
                          if (confirm(`Remover "${s.name}"?`)) deleteSchedule(s.id)
                        }}
                        title="Remover"
                        style={{
                          width:28, height:28, flexShrink:0,
                          background:'transparent', border:'none', cursor:'pointer',
                          color:C.inkDim, padding:0,
                          display:'flex', alignItems:'center', justifyContent:'center',
                          borderRadius:6,
                        }}
                        onMouseOver={e=>{e.currentTarget.style.color=C.state5; e.currentTarget.style.background=`${C.state5}11`}}
                        onMouseOut={e=>{e.currentTarget.style.color=C.inkDim; e.currentTarget.style.background='transparent'}}
                      ><IconTrash/></button>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </>
      )}

      <div style={{display:'flex', minHeight:'calc(100vh - 60px)'}}>

        {/* SIDEBAR */}
        <aside style={{
          width:340, flexShrink:0,
          borderRight:`1px solid ${C.border}`,
          padding:'1.75rem 1.5rem',
          overflowY:'auto', height:'calc(100vh - 60px)',
          position:'sticky', top:60,
          background:C.white,
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

            <label style={labelStyle}>Nome do projeto</label>
            <input style={inputStyle} placeholder="Ex: Boticário - Dia das Mães"
              value={config.nomeProjeto}
              onChange={e=>set('nomeProjeto',e.target.value)}/>

            <label style={{...labelStyle, marginTop:12}}>Descrição / escopo</label>
            <textarea style={{...inputStyle, minHeight:64, resize:'vertical'}}
              placeholder="Ex: 1 filme 30s + formatos extra"
              value={config.descricao}
              onChange={e=>set('descricao',e.target.value)}/>

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
                background:C.white, border:`1px solid ${C.main}`,
                borderRadius:10, color:C.main,
                fontWeight:700, fontSize:13, padding:'11px',
                cursor:'pointer',
                transition:'background .15s, color .15s',
              }}
              onMouseOver={e=>{e.currentTarget.style.background=C.main; e.currentTarget.style.color=C.white}}
              onMouseOut={e=>{e.currentTarget.style.background=C.white; e.currentTarget.style.color=C.main}}
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
                background: currentId ? C.white : C.bg,
                border:`1px solid ${currentId ? C.gray : C.border}`,
                borderRadius:10,
                color: currentId ? C.inkSoft : C.inkDim,
                fontWeight:700, fontSize:12, padding:'11px 14px',
                cursor: currentId ? 'pointer' : 'not-allowed',
                transition:'background .15s, color .15s, border-color .15s',
              }}
              onMouseOver={e=>{
                if (!currentId) return
                e.currentTarget.style.background = C.ink
                e.currentTarget.style.color = C.white
                e.currentTarget.style.borderColor = C.ink
              }}
              onMouseOut={e=>{
                if (!currentId) return
                e.currentTarget.style.background = C.white
                e.currentTarget.style.color = C.inkSoft
                e.currentTarget.style.borderColor = C.gray
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
              type="button"
              onClick={()=>setShowPreview(true)}
              disabled={!!downloading || displayTasks.length === 0}
              style={{
                flex:'0 0 auto', display:'inline-flex',
                alignItems:'center', justifyContent:'center', gap:6,
                background: C.white, border:`1px solid ${C.border}`,
                borderRadius:10, color:C.ink,
                fontWeight:700, fontSize:13, padding:'12px 16px',
                cursor: downloading || displayTasks.length === 0 ? 'not-allowed' : 'pointer',
                opacity: downloading || displayTasks.length === 0 ? 0.6 : 1,
                transition:'background .15s, border-color .15s',
              }}
              onMouseOver={e=>{ if(!e.currentTarget.disabled) e.currentTarget.style.background = C.bg }}
              onMouseOut={e=>{ e.currentTarget.style.background = C.white }}
            >
              Preview
            </button>
            <button
              ref={downloadBtnRef}
              onClick={toggleDownload}
              disabled={!!downloading || displayTasks.length === 0}
              style={{
                flex:1, display:'inline-flex',
                alignItems:'center', justifyContent:'center', gap:8,
                background: GRAD_BRAND, border:'none',
                borderRadius:10, color:C.white,
                fontWeight:700, fontSize:14, padding:'13px',
                cursor: downloading || displayTasks.length === 0 ? 'not-allowed' : 'pointer',
                boxShadow:`0 6px 18px ${C.main}44`,
                opacity: downloading || displayTasks.length === 0 ? 0.6 : 1,
                transition:'transform .15s, box-shadow .15s, opacity .15s',
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
                width: 240,
                background:C.white,
                border:`1px solid ${C.border}`,
                borderRadius:10,
                boxShadow:SHADOW_LG,
                zIndex:9999,
                padding:5,
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
                      padding:'9px 12px', borderRadius:7,
                      cursor:'pointer', textAlign:'left',
                      transition:'background .15s',
                    }}
                    onMouseOver={e=>e.currentTarget.style.background = C.bg}
                    onMouseOut={e=>e.currentTarget.style.background = 'transparent'}
                  >
                    <span style={{
                      color:C.ink, fontSize:13, fontWeight:700,
                    }}>{label}</span>
                    <span style={{
                      color:C.inkDim, fontSize:10, fontWeight:500,
                    }}>{desc}</span>
                  </button>
                ))}
              </div>
            </>,
            document.body
          )}

          <p style={{color:C.inkDim, fontSize:10,
                     lineHeight:1.5, textAlign:'center', margin:0}}>
            PDF/PNG capturam o cronograma como imagem.<br/>
            XLSX permite editar no Google Sheets.
          </p>
        </aside>

        {/* PREVIEW AREA */}
        <main style={{flex:1, padding:'1.75rem', overflowX:'auto',
                      background:`radial-gradient(1200px 600px at 80% -10%, ${C.sub}55, transparent 60%), ${C.bg}`}}>
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
                fontSize:13, background:C.white
              }}>
                preencha as datas e ative ao menos uma etapa para ver o cronograma
              </div>
          }

          {displayTasks.length > 0 && (
            <div style={{
              display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))',
              gap:12, marginTop:20
            }}>
              {[
                ['Total de tarefas', displayTasks.length, C.main],
                ['Concluídas',       displayTasks.filter(t=>t.status==='CONCLUÍDO').length, C.state1],
                ['Em andamento',     displayTasks.filter(t=>t.status==='EM ANDAMENTO').length, C.state4],
                ['A realizar',       displayTasks.filter(t=>t.status==='A REALIZAR').length, C.gray],
                ['Atrasadas',        displayTasks.filter(t=>t.status==='ATRASADO').length, C.state5],
              ].map(([l,v,col])=>(
                <div key={l} style={{
                  background:C.white, border:`1px solid ${C.border}`,
                  borderRadius:12, padding:'14px 16px',
                  boxShadow:SHADOW,
                  position:'relative', overflow:'hidden',
                }}>
                  <div style={{
                    position:'absolute', top:0, left:0, right:0, height:3,
                    background:col,
                  }}/>
                  <div style={{color:C.inkSoft, fontSize:10,
                               marginBottom:6, fontWeight:600, letterSpacing:'.06em',
                               textTransform:'uppercase'}}>{l}</div>
                  <div style={{color:C.ink, fontSize:26, fontWeight:800,
                               letterSpacing:'-.03em'}}>{v}</div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  )
}

const labelStyle = {
  display:'block', fontSize:10, fontWeight:700,
  letterSpacing:'.08em', textTransform:'uppercase',
  color:C.inkSoft, marginBottom:6
}
const inputStyle = {
  width:'100%', background:C.white,
  border:`1px solid ${C.gray}`, borderRadius:8,
  color:C.ink,
  fontSize:12, padding:'9px 11px', outline:'none',
  display:'block', boxSizing:'border-box',
  transition:'border-color .15s, box-shadow .15s',
}
const miniLabel = {
  fontSize:9, fontWeight:700, letterSpacing:'.08em',
  color:C.inkDim, textTransform:'uppercase',
}
