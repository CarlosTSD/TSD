import { useEffect, useMemo, useRef, useState } from 'react'
import {
  buildSchedule, isoToDate, MESES_PT, DIAS_PT,
} from './scheduleEngine'
import { openShareChannel } from './shareLink'
import './landing.css'

// ── Helpers de data ──────────────────────────────────────────────────────────
function fmtShort(iso) {
  if (!iso) return '—'
  const d = isoToDate(iso)
  return `${String(d.getDate()).padStart(2, '0')} ${MESES_PT[d.getMonth() + 1].slice(0, 3)}`
}
function fmtRange(iso1, iso2) {
  if (!iso1) return '—'
  if (!iso2 || iso1 === iso2) return fmtShort(iso1)
  const d1 = isoToDate(iso1), d2 = isoToDate(iso2)
  const m1 = MESES_PT[d1.getMonth() + 1].slice(0, 3)
  const m2 = MESES_PT[d2.getMonth() + 1].slice(0, 3)
  if (m1 === m2 && d1.getFullYear() === d2.getFullYear()) {
    return `${String(d1.getDate()).padStart(2, '0')} — ${String(d2.getDate()).padStart(2, '0')} ${m2}`
  }
  return `${fmtShort(iso1)} — ${fmtShort(iso2)}`
}
function diffDays(iso1, iso2) {
  if (!iso1 || !iso2) return 0
  const ms = isoToDate(iso2).getTime() - isoToDate(iso1).getTime()
  return Math.round(ms / (24 * 3600 * 1000)) + 1
}
function businessDays(iso1, iso2, holidays = []) {
  if (!iso1 || !iso2) return 0
  const set = new Set(holidays)
  let count = 0
  let d = isoToDate(iso1)
  const end = isoToDate(iso2)
  while (d <= end) {
    const wd = d.getDay()
    const isoStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    if (wd !== 0 && wd !== 6 && !set.has(isoStr)) count++
    d = new Date(d); d.setDate(d.getDate() + 1)
  }
  return count
}

// ── Agrupa tasks em fases (faseNum / faseNome) ───────────────────────────────
function groupByPhase(tasks) {
  const map = new Map()
  let currentPhase = null
  for (const t of tasks) {
    if (t.faseNum) currentPhase = { num: t.faseNum, nome: t.faseNome }
    if (!currentPhase) continue
    const key = `${currentPhase.num}_${currentPhase.nome}`
    if (!map.has(key)) {
      map.set(key, { num: currentPhase.num, nome: currentPhase.nome, tasks: [] })
    }
    map.get(key).tasks.push(t)
  }
  return Array.from(map.values()).sort((a, b) => a.num - b.num)
}

function phaseStatus(phase) {
  const total = phase.tasks.length
  if (!total) return { label: 'A realizar', state: 'pending', pct: 0 }
  const done = phase.tasks.filter(t => t.status === 'CONCLUÍDO').length
  const inProgress = phase.tasks.filter(t => t.status === 'EM ANDAMENTO').length
  const late = phase.tasks.filter(t => t.status === 'ATRASADO').length
  const pct = Math.round((done / total) * 100)
  if (done === total) return { label: 'Concluído', state: 'done', pct: 100 }
  if (late > 0) return { label: 'Atrasado', state: 'late', pct }
  if (inProgress > 0 || done > 0) return { label: 'Em andamento', state: 'active', pct }
  return { label: 'A realizar', state: 'pending', pct: 0 }
}

function phaseDateRange(phase) {
  let start = null, end = null
  for (const t of phase.tasks) {
    if (!start || t.dIni < start) start = t.dIni
    if (!end || t.dFim > end) end = t.dFim
  }
  return { start, end }
}

// ── Componente principal ─────────────────────────────────────────────────────
export default function LandingPage({ data }) {
  // Estado local pra permitir atualização ao vivo via BroadcastChannel.
  // Inicia com o snapshot do link e é substituído quando o admin emite update.
  const [liveData, setLiveData] = useState(data)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const ch = openShareChannel()
    if (!ch) return
    function onMsg(ev) {
      if (ev.data?.type !== 'update') return
      setLiveData({
        config: ev.data.config,
        statusOverrides: ev.data.statusOverrides,
      })
    }
    ch.addEventListener('message', onMsg)
    return () => {
      ch.removeEventListener('message', onMsg)
      ch.close()
    }
  }, [])

  const { config = {}, statusOverrides = {} } = liveData || {}
  const rootRef = useRef(null)

  const tasks = useMemo(() => {
    if (!config.dataInicio || !config.dataFim) return []
    try {
      const built = buildSchedule(config)
      return built.map(t => ({ ...t, status: statusOverrides[t.id] ?? t.status }))
    } catch {
      return []
    }
  }, [config, statusOverrides])

  const phases = useMemo(() => groupByPhase(tasks), [tasks])

  // Stats agregados
  const stats = useMemo(() => {
    const total = tasks.length
    const done = tasks.filter(t => t.status === 'CONCLUÍDO').length
    const inProgress = tasks.filter(t => t.status === 'EM ANDAMENTO').length
    const late = tasks.filter(t => t.status === 'ATRASADO').length
    const pending = total - done - inProgress - late
    const pct = total ? Math.round((done / total) * 100) : 0
    return { total, done, inProgress, late, pending, pct }
  }, [tasks])

  const activePhaseIndex = useMemo(() => {
    const idx = phases.findIndex(p => phaseStatus(p).state === 'active' || phaseStatus(p).state === 'late')
    if (idx >= 0) return idx
    // fallback: primeira pendente
    const next = phases.findIndex(p => phaseStatus(p).state === 'pending')
    return next >= 0 ? next : phases.length - 1
  }, [phases])

  const totalDays = diffDays(config.dataInicio, config.dataFim)
  const totalBizDays = businessDays(config.dataInicio, config.dataFim, config.holidays || [])

  const cliente = (config.cliente || '').trim()
  const projetoNome = (config.nomeProjeto || '').trim() || 'Projeto sem nome'
  const descricao = (config.descricao || '').trim()

  // Lista de entregas — split por barra, trim e descarte de vazios
  const entregasList = useMemo(() => {
    return (config.entregas || '')
      .split('/')
      .map(s => s.trim())
      .filter(Boolean)
  }, [config.entregas])

  // Estrutura do título: "Cliente · {cliente}" como eyebrow, e o nome do
  // projeto como bloco grande, com a última palavra destacada em italic serif.
  // Ex: cliente="O Boticário", nomeProjeto="Dia das Mães" →
  //     eyebrow="Cliente · O Boticário", head="Dia das", tail="Mães".
  const tituloPrincipal = useMemo(() => {
    const words = projetoNome.split(/\s+/)
    const tail = words.length > 1 ? words[words.length - 1] : projetoNome
    const head = words.length > 1 ? words.slice(0, -1).join(' ') : ''
    return { head, tail }
  }, [projetoNome])

  // Scroll reveal — observa elementos com .reveal / .reveal-stagger
  useEffect(() => {
    if (!rootRef.current) return
    const items = rootRef.current.querySelectorAll('.reveal, .reveal-stagger')
    if (!('IntersectionObserver' in window)) {
      items.forEach(i => i.classList.add('in'))
      return
    }
    const io = new IntersectionObserver(entries => {
      entries.forEach(en => {
        if (en.isIntersecting) {
          en.target.classList.add('in')
          io.unobserve(en.target)
        }
      })
    }, { threshold: .12, rootMargin: '0px 0px -8% 0px' })
    items.forEach(i => io.observe(i))
    return () => io.disconnect()
  }, [phases.length])

  // Parallax suave do mesh do hero
  useEffect(() => {
    const hero = rootRef.current?.querySelector('.hero')
    const mesh = hero?.querySelector('.hero-mesh')
    if (!hero || !mesh) return
    let raf = null
    function onMove(e) {
      if (raf) return
      raf = requestAnimationFrame(() => {
        const r = hero.getBoundingClientRect()
        const nx = ((e.clientX - r.left) / r.width - .5) * 2
        const ny = ((e.clientY - r.top) / r.height - .5) * 2
        mesh.style.translate = `${nx * -15}px ${ny * -15}px`
        raf = null
      })
    }
    function onLeave() { mesh.style.translate = '0 0' }
    hero.addEventListener('mousemove', onMove)
    hero.addEventListener('mouseleave', onLeave)
    return () => {
      hero.removeEventListener('mousemove', onMove)
      hero.removeEventListener('mouseleave', onLeave)
    }
  }, [])

  // Dias EXCLUSIVOS de feedback — quando o cliente segura o retorno por
  // 1+ dias úteis (feedbackDelay > 0). Se o feedback cai no mesmo dia da
  // entrega (delay 0), o dia é considerado entrega, não feedback.
  const feedbackDates = useMemo(() => {
    const isoOf = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    // 1ª passada: marcar todos os dias de tasks de ENTREGA
    const deliveryDates = new Set()
    for (const t of tasks) {
      if (t.id?.endsWith('_fb')) continue
      const cur = new Date(isoToDate(t.dIni))
      const end = isoToDate(t.dFim)
      while (cur <= end) {
        deliveryDates.add(isoOf(cur))
        cur.setDate(cur.getDate() + 1)
      }
    }
    // 2ª passada: feedback só conta nos dias que NÃO são de entrega
    const set = new Set()
    const fbTasks = []
    for (const t of tasks) {
      if (!t.id?.endsWith('_fb')) continue
      fbTasks.push({ id: t.id, nome: t.nome, dIni: t.dIni, dFim: t.dFim })
      const cur = new Date(isoToDate(t.dIni))
      const end = isoToDate(t.dFim)
      while (cur <= end) {
        const iso = isoOf(cur)
        if (!deliveryDates.has(iso)) set.add(iso)
        cur.setDate(cur.getDate() + 1)
      }
    }
    console.log('[DEBUG feedbackDates]', {
      fbTasksFound: fbTasks,
      deliveryDates: Array.from(deliveryDates).sort(),
      feedbackOnlyDates: Array.from(set).sort(),
    })
    return set
  }, [tasks])

  // Strip de 14 dias (2 semanas dom-sáb) começando no domingo da semana
  // que contém o início da fase ativa. Marca dias da fase, weekend e feedback.
  const monthStrip = useMemo(() => {
    const active = phases[activePhaseIndex]
    if (!active) return null
    const range = phaseDateRange(active)
    if (!range.start) return null

    const startOfWeek = isoToDate(range.start)
    // semana começa no domingo (0)
    while (startOfWeek.getDay() !== 0) {
      startOfWeek.setDate(startOfWeek.getDate() - 1)
    }

    const refForLabel = isoToDate(range.start)
    const monthName = MESES_PT[refForLabel.getMonth() + 1]
    const year = refForLabel.getFullYear()

    const daysToShow = []
    const cur = new Date(startOfWeek)
    for (let i = 0; i < 14; i++) {
      const iso = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}-${String(cur.getDate()).padStart(2, '0')}`
      const wd = cur.getDay()
      daysToShow.push({
        d: new Date(cur),
        iso,
        inPhase: iso >= range.start && iso <= range.end,
        isWeekend: wd === 0 || wd === 6,
        isFeedback: feedbackDates.has(iso),
      })
      cur.setDate(cur.getDate() + 1)
    }
    return { monthName, year, days: daysToShow }
  }, [phases, activePhaseIndex, feedbackDates])

  return (
    <div className="landing" ref={rootRef}>
      {/* NAVBAR */}
      <nav className={`nav ${menuOpen ? 'open' : ''}`}>
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault()
            setMenuOpen(false)
            window.scrollTo({ top: 0, behavior: 'smooth' })
          }}
        >tressde</a>
        <div className="nav-links" onClick={() => setMenuOpen(false)}>
          <a className="nav-link" href="#projeto">Projeto</a>
          <a className="nav-link" href="#etapas">Etapas</a>
          {entregasList.length > 0 && (
            <a className="nav-link" href="#entregas">Entregas</a>
          )}
          <a className="nav-link" href="#performance">Performance</a>
        </div>
        <button
          className="nav-toggle"
          type="button"
          aria-label={menuOpen ? 'Fechar menu' : 'Abrir menu'}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen(o => !o)}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
            {menuOpen ? (
              <>
                <line x1="6" y1="6" x2="18" y2="18"/>
                <line x1="18" y1="6" x2="6" y2="18"/>
              </>
            ) : (
              <>
                <line x1="4" y1="7" x2="20" y2="7"/>
                <line x1="4" y1="12" x2="20" y2="12"/>
                <line x1="4" y1="17" x2="20" y2="17"/>
              </>
            )}
          </svg>
        </button>
      </nav>

      {/* HERO */}
      <section className="hero">
        <div className="hero-mesh"></div>
        <div className="hero-grain"></div>

        <div className="hero-top reveal">
          <div className="hero-eyebrow">Cronograma · {new Date(config.dataInicio || Date.now()).getFullYear()}</div>
          <div className="hero-tag">Em produção · Ao vivo</div>
        </div>

        <div className="hero-content">
          <h1 className="hero-title reveal">
            <span className="small">
              {cliente ? `Cliente · ${cliente}` : 'Cliente'}
            </span>
            {tituloPrincipal.head && <>{tituloPrincipal.head}<br /></>}
            <em>{tituloPrincipal.tail}</em>
          </h1>

          <div className="hero-side reveal-stagger">
            {descricao && <p className="desc">{descricao}</p>}
            <p className="desc">Acompanhe abaixo o andamento de cada etapa, com previsão de entrega e status atualizado em tempo real.</p>
            <div className="hero-stats">
              <div className="hero-stat">
                <div className="lbl">Início</div>
                <div className="val">
                  {config.dataInicio ? <>{String(isoToDate(config.dataInicio).getDate()).padStart(2, '0')} <em>{MESES_PT[isoToDate(config.dataInicio).getMonth() + 1].slice(0, 3)}</em></> : '—'}
                </div>
              </div>
              <div className="hero-stat">
                <div className="lbl">Entrega</div>
                <div className="val">
                  {config.dataFim ? <>{String(isoToDate(config.dataFim).getDate()).padStart(2, '0')} <em>{MESES_PT[isoToDate(config.dataFim).getMonth() + 1].slice(0, 3)}</em></> : '—'}
                </div>
              </div>
              <div className="hero-stat">
                <div className="lbl">Duração</div>
                <div className="val">{totalDays} <em>dias</em></div>
              </div>
              <div className="hero-stat">
                <div className="lbl">Etapas</div>
                <div className="val">{String(phases.length).padStart(2, '0')} <em>fases</em></div>
              </div>
            </div>

            <div className="hero-cta">
              <a className="btn-primary" href="#etapas">Ver cronograma →</a>
              <a className="btn-ghost" href="#performance">Performance</a>
            </div>
          </div>
        </div>

        <div className="hero-foot reveal">
          <div>tressde · {new Date().getFullYear()} / V1.1</div>
          <div className="scroll">
            Role para baixo
            <span className="arr">↓</span>
          </div>
        </div>
      </section>

      {/* VISÃO GERAL */}
      <section className="section" id="projeto">
        <div className="section-inner">
          <div className="section-eyebrow reveal">01 · Visão geral</div>
          <h2 className="section-title reveal">Acompanhe cada<br />número que <em>importa.</em></h2>
          <p className="section-desc reveal">Indicadores em tempo real do andamento, tarefas em produção e dias úteis — atualizados conforme o time entrega cada etapa.</p>

          <div className="stats-big reveal-stagger">
            <div className="stat-big blue">
              <div className="stat-big-head">
                <h3>Andamento<br />do projeto</h3>
                <div className="arrow">↗</div>
              </div>
              <div className="stat-big-num">{String(stats.pct).padStart(2, '0')}<span className="pct">%</span></div>
              <div className="stat-big-foot">
                {phases.length
                  ? `Etapa ${String(activePhaseIndex + 1).padStart(2, '0')} de ${String(phases.length).padStart(2, '0')}`
                  : 'Sem etapas configuradas'}
              </div>
            </div>
            <div className="stat-big white">
              <div className="stat-big-head">
                <h3>Tarefas<br />totais</h3>
                <div className="arrow">↗</div>
              </div>
              <div className="stat-big-num">{String(stats.total).padStart(2, '0')}</div>
              <div className="stat-big-foot">{stats.done} concluída{stats.done === 1 ? '' : 's'} · {stats.total - stats.done} pendentes</div>
            </div>
            <div className="stat-big dark">
              <div className="stat-big-head">
                <h3>Dias<br />úteis</h3>
                <div className="arrow">↗</div>
              </div>
              <div className="stat-big-num">{String(totalBizDays).padStart(2, '0')}</div>
              <div className="stat-big-foot">{totalDays} dias corridos no total</div>
            </div>
          </div>
        </div>
      </section>

      {/* ETAPAS */}
      <section className="section" id="etapas">
        <div className="section-inner">
          <div className="section-head">
            <div>
              <div className="section-eyebrow reveal">02 · Cronograma</div>
              <h2 className="section-title reveal">Linha do<br /><em>tempo</em> ativa.</h2>
            </div>
            <p className="section-desc reveal" style={{ marginBottom: 0, textAlign: 'right' }}>Cada dia, cada entrega — visualizados em uma timeline atualizada conforme o projeto avança.</p>
          </div>

          {monthStrip && (
            <div className="timeline-block" style={{ marginBottom: 24 }}>
              <div className="timeline-head">
                <h2>{monthStrip.monthName} · {monthStrip.year}</h2>
                <div className="meta">
                  Etapa {String(activePhaseIndex + 1).padStart(2, '0')} de {String(phases.length).padStart(2, '0')}
                  {phases[activePhaseIndex] ? ` · ${phases[activePhaseIndex].nome}` : ''}
                </div>
              </div>
              <div className="days">
                {monthStrip.days.map((d, i) => {
                  // Prioridade: weekend > feedback > in-phase > default
                  const variant = d.isWeekend
                    ? 'weekend'
                    : d.isFeedback
                      ? 'feedback'
                      : d.inPhase
                        ? 'in-phase'
                        : ''
                  return (
                    <div key={i} className={`day ${variant}`.trim()}>
                      {String(d.d.getDate()).padStart(2, '0')}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          <div className="phases reveal-stagger">
            {phases.map((phase, i) => {
              const st = phaseStatus(phase)
              const range = phaseDateRange(phase)
              const bizDays = businessDays(range.start, range.end, config.holidays || [])
              const cls = `phase ${st.state === 'done' ? 'done' : ''} ${i === activePhaseIndex && st.state !== 'done' ? 'active' : ''}`.trim()
              const doneCount = phase.tasks.filter(t => t.status === 'CONCLUÍDO').length
              return (
                <div key={i} className={cls}>
                  <div className="phase-num">{String(phase.num).padStart(2, '0')}</div>
                  <div className="phase-body">
                    <h3 className="phase-title">{phase.nome}</h3>
                    <div className="phase-meta">
                      <span><b>{fmtRange(range.start, range.end)}</b></span>
                      <span className="sep">·</span>
                      <span>{bizDays} {bizDays === 1 ? 'dia útil' : 'dias úteis'}</span>
                      <span className="sep">·</span>
                      <span>{doneCount} de {phase.tasks.length} {phase.tasks.length === 1 ? 'tarefa' : 'tarefas'}</span>
                    </div>
                    <div className="phase-tasks">
                      {phase.tasks.map((t, j) => (
                        <div key={j} className={`phase-task ${t.status === 'CONCLUÍDO' ? 'done' : ''}`}>
                          <span className="dot"></span>
                          <span className="phase-task-name">{t.nome}</span>
                          <span className="phase-task-meta">{fmtRange(t.dIni, t.dFim)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="phase-status">{st.label}</div>
                  <div className="phase-pct">
                    {String(st.pct).padStart(2, '0')}<span className="pct">%</span>
                    <span className="lbl">{st.state === 'done' ? 'Completo' : st.state === 'active' ? 'Em curso' : st.state === 'late' ? 'Atrasado' : 'Pendente'}</span>
                  </div>
                </div>
              )
            })}
            {!phases.length && (
              <div className="phase">
                <div className="phase-num">—</div>
                <div className="phase-body">
                  <h3 className="phase-title">Nenhuma etapa configurada</h3>
                  <div className="phase-meta">
                    <span>Marque etapas no painel administrativo para vê-las aqui.</span>
                  </div>
                </div>
                <div className="phase-status">—</div>
                <div className="phase-pct">—</div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ENTREGAS */}
      {entregasList.length > 0 && (
        <section className="section" id="entregas">
          <div className="section-inner">
            <div className="section-eyebrow reveal">03 · Entregas</div>
            <h2 className="section-title reveal">Formatos<br /><em>finais.</em></h2>
            <p className="section-desc reveal">Resumo do que será entregue ao final do projeto — vídeos, durações, formatos e resoluções.</p>

            <div
              className="deliveries reveal-stagger"
              data-count={Math.min(entregasList.length, 3)}
            >
              {entregasList.map((item, i) => {
                const variants = ['blue', 'white', 'dark']
                const variant = variants[i % variants.length]
                return (
                  <div key={i} className={`delivery-stat ${variant}`}>
                    <div className="delivery-stat-head">
                      <span className="label">Entrega {String(i + 1).padStart(2, '0')}</span>
                      <div className="arrow">↗</div>
                    </div>
                    <div className="delivery-stat-content">{item}</div>
                  </div>
                )
              })}
            </div>
          </div>
        </section>
      )}

      {/* PERFORMANCE */}
      <section className="section" id="performance">
        <div className="section-inner">
          <div className="section-eyebrow reveal">04 · Performance</div>
          <h2 className="section-title reveal">Performance &<br />análise <em>de etapas.</em></h2>
          <p className="section-desc reveal">Acompanhe a evolução do projeto como um índice — distribuição por status, ritmo e progresso em uma única tela.</p>

          <div className="aapl-grid reveal">
            <div className="chart-card">
              <div className="chart-top">
                <div className="nav-btns"><div className="b">‹</div></div>
                <div className="chart-meta">
                  <div className="ttl">{cliente || 'Cliente'}</div>
                  <div className="sub">{projetoNome.toUpperCase()}</div>
                </div>
              </div>
              <div className="chart-num">
                {String(stats.pct).padStart(2, '0')},00%
                {stats.done > 0 && (
                  <span className="delta up">+{stats.done}</span>
                )}
              </div>
              <div className="chart-sub">
                {stats.done} de {stats.total} {stats.total === 1 ? 'tarefa concluída' : 'tarefas concluídas'} · <b>{phases.length} {phases.length === 1 ? 'fase' : 'fases'}</b>
              </div>
              <div className="chart-svg">
                <svg viewBox="0 0 600 240" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="ln" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#cdd1ff"/>
                      <stop offset="50%" stopColor="#1E0FE8"/>
                      <stop offset="100%" stopColor="#1E0FE8"/>
                    </linearGradient>
                    <linearGradient id="fl" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="rgba(30,15,232,.3)"/>
                      <stop offset="100%" stopColor="rgba(30,15,232,0)"/>
                    </linearGradient>
                  </defs>
                  <path d="M0 180 Q 60 160, 100 150 T 200 130 T 280 90 T 340 60 T 400 100 T 460 80 T 540 70 L 600 90 L 600 240 L 0 240 Z" fill="url(#fl)"/>
                  <path d="M0 180 Q 60 160, 100 150 T 200 130 T 280 90 T 340 60 T 400 100 T 460 80 T 540 70 L 600 90" fill="none" stroke="url(#ln)" strokeWidth="3" strokeLinecap="round"/>
                </svg>
                <div className="chart-marker"></div>
              </div>
              <div className="chart-filters">
                <button className="chart-filter on" type="button">Diário</button>
                <button className="chart-filter" type="button">Semanal</button>
                <button className="chart-filter" type="button">Mensal</button>
                <button className="chart-filter" type="button">Total</button>
              </div>
              <div className="chart-bottom">
                <div className="chart-bot-card">
                  <div className="num">
                    {phases[activePhaseIndex] ? `${phaseStatus(phases[activePhaseIndex]).pct}%` : '—'}
                  </div>
                  <div className="lbl">% etapa atual</div>
                </div>
                <div className="chart-bot-card solid">
                  <div className="num">{stats.done}/{stats.total}</div>
                  <div className="lbl">tarefas concluídas no período</div>
                </div>
              </div>
            </div>

            <div className="ratings">
              <div className="rating-head">
                <h3>Análise de Etapas <span className="arrow">↗</span></h3>
                <div className="sub">Distribuição do progresso por status</div>
              </div>
              <div className="rating-card blue">
                <div className="rating-left">
                  <div className="pct">{String(Math.round((stats.inProgress / Math.max(1, stats.total)) * 100)).padStart(2, '0')}%</div>
                  <div className="lbl">Em andamento</div>
                </div>
                <div className="rating-right">{String(stats.inProgress).padStart(2, '0')}</div>
              </div>
              <div className="rating-card gray">
                <div className="rating-left">
                  <div className="pct">{String(Math.round((stats.done / Math.max(1, stats.total)) * 100)).padStart(2, '0')}%</div>
                  <div className="lbl">Concluído</div>
                </div>
                <div className="rating-right">{String(stats.done).padStart(2, '0')}</div>
              </div>
              {stats.late > 0 && (
                <div className="rating-card warn">
                  <div className="rating-left">
                    <div className="pct">{String(Math.round((stats.late / Math.max(1, stats.total)) * 100)).padStart(2, '0')}%</div>
                    <div className="lbl">Atrasado</div>
                  </div>
                  <div className="rating-right">{String(stats.late).padStart(2, '0')}</div>
                </div>
              )}
              <div className="rating-card dark">
                <div className="rating-left">
                  <div className="pct">{String(Math.round((stats.pending / Math.max(1, stats.total)) * 100)).padStart(2, '0')}%</div>
                  <div className="lbl">Pendente</div>
                </div>
                <div className="rating-right">{String(stats.pending).padStart(2, '0')}</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* MÚLTIPLAS VISÕES */}
      <section className="section">
        <div className="section-inner">
          <div className="section-eyebrow reveal">05 · Múltiplas visões</div>
          <h2 className="section-title reveal">Três formas<br />de ver o <em>mesmo</em> projeto.</h2>
          <p className="section-desc reveal">Do panorama executivo ao detalhe operacional, o cronograma se adapta a cada momento da conversa com o cliente.</p>

          <div className="triple-grid reveal-stagger">
            {/* Card 1: Dial */}
            <div className="triple-card dial-card">
              <div className="dial-top">
                <div className="b">‹</div>
                <div className="dots"><i></i><i></i><i></i><i></i></div>
              </div>
              <div className="dial-title">Acompanhe seu projeto</div>
              <div className="dial-wrap">
                <div className="dial-ring"><div className="dial"></div></div>
                <div className="dial-pill">
                  <span className="num">{stats.pct}%</span>
                  <span className="lbl">progresso</span>
                </div>
              </div>
              <div className="dial-foot">
                <div className="big">{stats.total}<sup> tarefas</sup></div>
                <div className="lbl">{stats.done} concluída{stats.done === 1 ? '' : 's'} · {stats.total - stats.done} restantes</div>
              </div>
            </div>

            {/* Card 2: Quiz */}
            <div className="triple-card quiz-card">
              <div className="quiz-top">
                <div className="b">‹</div>
                <div className="quiz-progress">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <span key={i} className={i < Math.max(1, activePhaseIndex + 1) ? 'on' : ''}></span>
                  ))}
                </div>
                <div className="quiz-step">{Math.min(phases.length, activePhaseIndex + 1)}/{phases.length || 1}</div>
              </div>
              <h3 className="quiz-question">Como está<br />o <em>ritmo</em><br />do projeto?</h3>
              <div className="quiz-options">
                {(() => {
                  const inProgPct = Math.round((stats.inProgress / Math.max(1, stats.total)) * 100)
                  const donePct = Math.round((stats.done / Math.max(1, stats.total)) * 100)
                  const latePct = Math.round((stats.late / Math.max(1, stats.total)) * 100)
                  const winner = stats.late > 0 ? 'late' : (stats.inProgress > 0 || stats.done > 0 ? 'ontrack' : 'idle')
                  return (
                    <>
                      <div className={`quiz-option ${winner === 'ontrack' ? 'selected' : ''}`}>
                        <div className="check">{winner === 'ontrack' ? '✓' : '·'}</div>
                        <div className="lbl">No ritmo</div>
                        <div className="pct">{donePct + inProgPct}%</div>
                      </div>
                      <div className={`quiz-option ${winner === 'idle' ? 'selected' : ''}`}>
                        <div className="check">{winner === 'idle' ? '✓' : '·'}</div>
                        <div className="lbl">Aguardando</div>
                        <div className="pct">{Math.max(0, 100 - donePct - inProgPct - latePct)}%</div>
                      </div>
                      <div className={`quiz-option ${winner === 'late' ? 'selected' : ''}`}>
                        <div className="check">{winner === 'late' ? '✓' : '·'}</div>
                        <div className="lbl">Atrasado</div>
                        <div className="pct">{latePct}%</div>
                      </div>
                    </>
                  )
                })()}
              </div>
              <div className="quiz-bottom">
                <div className="b on">✓</div>
                <div className="b">→</div>
              </div>
            </div>

            {/* Card 3: Glass */}
            <div className="triple-card glass-card">
              <div className="glass-top-nav"><div className="b">‹</div></div>
              <div className="glass-content">
                <div className="gc hero-card">
                  <div className="icon-pill">▶</div>
                  <div className="label">{phases[activePhaseIndex] ? phaseStatus(phases[activePhaseIndex]).label : '—'}</div>
                  <div className="name">{phases[activePhaseIndex]?.nome || 'Sem etapa ativa'}</div>
                  <div className="time">
                    {phases[activePhaseIndex] ? fmtRange(phaseDateRange(phases[activePhaseIndex]).start, phaseDateRange(phases[activePhaseIndex]).end) : '—'}
                  </div>
                </div>
                <div className="gc">
                  <div className="gc-row-left">
                    <div className="gc-num">{String(stats.pct).padStart(2, '0')}<span className="unit">% total</span></div>
                    <div className="gc-text">
                      <div className="label">Andamento</div>
                      <div className="sub">do projeto</div>
                    </div>
                  </div>
                </div>
                <div className="gc-grid">
                  <div className="gc solid">
                    <div>
                      <span className="num">{String(activePhaseIndex + 1).padStart(2, '0')}</span>
                      <span className="unit">de {String(phases.length).padStart(2, '0')} fases</span>
                    </div>
                    <div className="label">Etapa ativa</div>
                    <div className="sub">{phases[activePhaseIndex]?.nome || '—'}</div>
                  </div>
                  <div className="gc hero-card" style={{ padding: '14px 16px' }}>
                    <div className="label">Tarefas</div>
                    <div className="name" style={{ fontSize: 24, fontWeight: 300 }}>{stats.total}</div>
                    <div className="time">restantes: {stats.total - stats.done}</div>
                  </div>
                </div>
                <div className="gc">
                  <div className="gc-row-left">
                    <div className="gc-num">{totalBizDays}<span className="unit">dias úteis</span></div>
                    <div className="gc-text">
                      <div className="label">Duração</div>
                      <div className="sub">total</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="footer">
        <div className="footer-inner">
          <div className="footer-top">
            <div className="footer-title">Pronto para o<br />seu próximo<br /><em>cronograma?</em></div>
            <div></div>
          </div>
          <div className="footer-bottom">
            <div className="footer-brand">tressde</div>
            <div>© {new Date().getFullYear()} · cronogramas feitos pro cliente</div>
          </div>
        </div>
      </footer>
    </div>
  )
}
