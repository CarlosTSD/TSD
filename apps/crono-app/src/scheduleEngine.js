// ── Date helpers ────────────────────────────────────────────────────────────
export const DIAS_PT  = ['SEG','TER','QUA','QUI','SEX','SÁB','DOM']
export const MESES_PT = ['','Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                          'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

export const STATUS_LIST = ['CONCLUÍDO','EM ANDAMENTO','ATRASADO','A REALIZAR']

// Paleta brand: main #2D7BF3, sub #CCE5FF, black #16181E, gray #A7BBDA
// states: 1 #28CDA5, 2 #48CE76, 3 #F7CE46, 4 #F49931, 5 #F9513F
export const STATUS_COLORS = {
  'CONCLUÍDO':    { bg: '#28CDA5', fg: '#ffffff' }, // state 1
  'EM ANDAMENTO': { bg: '#F49931', fg: '#ffffff' }, // state 4
  'ATRASADO':     { bg: '#F9513F', fg: '#ffffff' }, // state 5
  'A REALIZAR':   { bg: '#A7BBDA', fg: '#16181E' }, // gray
}

// Task bar colors
export const BAR_COLORS = {
  recebimento: '#2D7BF3', // brand blue
  blocagem:    '#A88EDC', // roxo pastel
  feedback:    '#F49931', // laranja (todos feedbacks)
  modelagem:   '#48CE76', // state 2 green (não usado)
  prev_baixa:  '#7BB3F7', // azul brand claro
  ajuste:      '#5DD4B3', // verde teal-mint
  aprovacao:   '#5DD4B3', // mantido (não usado: APROVAÇÃO virou Feedback)
  render:      '#22C55E', // verde vibrante (Render + Entrega)
  entrega:     '#F9513F', // não usado (mesclado em render)
  reducao:     '#F7CE46', // amarelo intermediário
  still:       '#3D5C8A', // azul escuro (previz still)
  kv_still:    '#808080', // cinza médio (KV Still)
  kv_final:    '#16181E', // preto (KV Final — entrega)
}

// Configuração default das fases — todas começam DESMARCADAS. O usuário ativa
// só as fases necessárias pro projeto. Cada versão tem dur/horario e, quando a
// fase tem feedback, um feedbackDelay (dias úteis adicionais caso o cliente
// atrase o retorno).
export const DEFAULT_PHASES = {
  previzStill: { enabled: false, qty: 1, versions: [{ dur: 5, horario: '12h', feedbackDelay: 0 }] },
  blocagem:    { enabled: false, qty: 1, versions: [{ dur: 5, horario: '9h',  feedbackDelay: 0 }] },
  prevBaixa:   { enabled: false, qty: 3, versions: [
    { dur: 5, horario: '12h', feedbackDelay: 0 },
    { dur: 5, horario: '12h', feedbackDelay: 0 },
    { dur: 5, horario: '12h', feedbackDelay: 0 },
  ]},
  ajuste:      { enabled: false, qty: 1, versions: [{ dur: 3, horario: '9h', feedbackDelay: 0 }] },
  render:      { enabled: false, qty: 1, versions: [{ dur: 4, horario: '18h' }] },
  reducao:     { enabled: false, qty: 1, versions: [{ dur: 3, horario: '18h' }] },
  // KV — grupo separado com datas próprias (independente do projeto principal)
  kvStill:     { enabled: false, qty: 1, versions: [{ dur: 5, horario: '12h', feedbackDelay: 0 }],
                 dataInicio: '', dataFim: '' },
  kvFinal:     { enabled: false, qty: 1, versions: [{ dur: 2, horario: '18h' }] },
}

// Metadata para a UI montar os controles
export const PHASE_META = [
  { key:'previzStill', label:'Previz Still',                  color: BAR_COLORS.still,      hasFeedback:true  },
  { key:'blocagem',    label:'Blocagem',                      color: BAR_COLORS.blocagem,   hasFeedback:true  },
  { key:'prevBaixa',   label:'Prévia Baixa',                  color: BAR_COLORS.prev_baixa, hasFeedback:true  },
  { key:'ajuste',      label:'Ajuste Final',                  color: BAR_COLORS.ajuste,     hasFeedback:true  },
  { key:'render',      label:'Render Alta / Comp + Entrega',  color: BAR_COLORS.render,     hasFeedback:false },
  { key:'reducao',     label:'Reduções e Formatos',           color: BAR_COLORS.reducao,    hasFeedback:false },
  { key:'kvStill',     label:'KV Still',                      color: BAR_COLORS.kv_still,   hasFeedback:true,  hasOwnDates:true },
  { key:'kvFinal',     label:'KV Final',                      color: BAR_COLORS.kv_final,   hasFeedback:false },
]

export function isoToDate(str) {
  const [y,m,d] = str.split('-').map(Number)
  return new Date(y, m-1, d)
}

export function dateToIso(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

function addDays(d, n) {
  const r = new Date(d); r.setDate(r.getDate()+n); return r
}

function pad(n) { return String(n).padStart(2,'0') }

// Gera as datas do calendário do start (snap pra segunda) até endIso + 7 dias.
// O buffer de 1 semana garante respiro visual após o deadline.
export function calendarDates(startIso, endIso) {
  const start = isoToDate(startIso)
  while (start.getDay() !== 1) start.setDate(start.getDate()-1)
  const end = isoToDate(endIso)
  const fin = addDays(end, 7)
  const dates = []
  let cur = new Date(start)
  while (cur <= fin) {
    dates.push(new Date(cur))
    cur = addDays(cur, 1)
  }
  return dates
}

// ── Main schedule builder ────────────────────────────────────────────────────
export function buildSchedule(config) {
  const { dataInicio, phases = DEFAULT_PHASES, holidays = [] } = config
  const holidaySet = new Set(holidays)
  const isHoliday = d => holidaySet.has(dateToIso(d))
  const isOff = d => d.getDay()===0 || d.getDay()===6 || isHoliday(d)

  // versões locais que respeitam feriados além de fins de semana
  const addBusiness = (d, n) => {
    let c = new Date(d), count = 0
    while (count < n) {
      c = addDays(c, 1)
      if (!isOff(c)) count++
    }
    return c
  }
  const prevWork = d => {
    let c = new Date(d)
    while (isOff(c)) c = addDays(c, -1)
    return c
  }

  let cur = isoToDate(dataInicio)
  // se dataInicio cair em fim de semana/feriado, anda pro próximo dia útil
  while (isOff(cur)) cur = addDays(cur, 1)

  const tasks = []
  let faseNum = 1

  function push(faseN, faseNm, nome, cor, status, dIni, dFim, horario=null, id=null) {
    const safeEnd = prevWork(dFim)
    tasks.push({
      id: id || `t_${tasks.length}`,
      faseNum: faseN, faseNome: faseNm, nome, cor, status,
      dIni: dateToIso(dIni), dFim: dateToIso(safeEnd), horario
    })
  }

  // opts.skipFase=true → não reivindica novo faseNum (anexa ao grupo anterior)
  function buildVersioned(key, faseLabel, taskBase, color, withFeedback, opts = {}) {
    const cfg = phases[key]
    if (!cfg?.enabled) return
    const qty = Math.max(1, cfg.qty || 1)
    const versions = cfg.versions || []
    const versioned = qty > 1
    const claim = !opts.skipFase
    const myFase = claim ? faseNum : null
    const myFaseNome = claim ? faseLabel : null

    for (let v = 1; v <= qty; v++) {
      const ver = versions[v-1] || {}
      const dur = Math.max(1, ver.dur || 1)
      const horario = ver.horario || '12h'
      const fim = addBusiness(cur, dur-1)
      push(
        v===1 ? myFase : null,
        v===1 ? myFaseNome : null,
        versioned ? `${taskBase} V${pad(v)}` : taskBase,
        color, 'A REALIZAR', cur, fim, horario,
        `${key}_v${v}`
      )
      if (withFeedback) {
        // Regra do feedback do cliente:
        //   entrega < 12h  → feedback MESMO dia às 12h
        //   entrega 12h-17h → feedback MESMO dia às 18h
        //   entrega ≥ 18h  → feedback PRÓXIMO dia útil às 18h
        const hh = parseInt(String(horario).match(/^(\d+)/)?.[1] ?? '12', 10)
        let fbHour, baseFb
        if (hh < 12)        { fbHour = '12h'; baseFb = fim }
        else if (hh < 18)   { fbHour = '18h'; baseFb = fim }
        else                { fbHour = '18h'; baseFb = prevWork(addBusiness(fim, 1)) }
        // Atraso do cliente — barra do feedback se ESTENDE do dia original
        // até o dia adiado (cliente está "segurando" o retorno). Quando há
        // atraso, o horário sempre vira 18h do último dia.
        const delay = Math.max(0, ver.feedbackDelay || 0)
        const fbDIni = baseFb
        const fbDFim = delay > 0 ? addBusiness(baseFb, delay) : baseFb
        if (delay > 0) fbHour = '18h'
        push(null, null,
             versioned ? `Feedback V${pad(v)}` : 'Feedback',
             BAR_COLORS.feedback, 'A REALIZAR', fbDIni, fbDFim, fbHour,
             `${key}_v${v}_fb`)
        cur = addBusiness(fbDFim, 1)
      } else {
        cur = addBusiness(fim, 1)
      }
    }
    if (claim) faseNum++
  }

  // ── Recebimento (sempre) — 1 dia útil ANTES do início do projeto
  const recebimento = prevWork(addDays(cur, -1))
  push(null, null, 'Recebimento Material', BAR_COLORS.recebimento,
       'CONCLUÍDO', recebimento, recebimento, null, 'recebimento')
  // cur permanece no dataInicio — primeira fase começa aqui

  // ── Grupo 1: Previz (Previz Still + Blocagem compartilham fase)
  const previzActive   = phases.previzStill?.enabled
  const blocagemActive = phases.blocagem?.enabled
  // se só blocagem está ativa, usa "Blocagem" como label do grupo
  const previzLabel = previzActive ? 'Previz' : 'Blocagem'
  if (previzActive) {
    buildVersioned('previzStill', previzLabel, 'PREVIZ STILL', BAR_COLORS.still, true)
  }
  if (blocagemActive) {
    buildVersioned('blocagem',
      previzActive ? null : previzLabel,
      'BLOCAGEM', BAR_COLORS.blocagem, true,
      { skipFase: previzActive }
    )
  }

  // ── Demais grupos (Ajuste agora gera Feedback automaticamente, seguindo
  //    a mesma regra de horário das outras fases com feedback)
  buildVersioned('prevBaixa',   'Prev Baixa',   'PREV BAIXA',          BAR_COLORS.prev_baixa, true)
  buildVersioned('ajuste',      'Ajuste Final', 'AJUSTE FINAL',        BAR_COLORS.ajuste,     true)

  // ── Render Alta / Comp + Entrega Final (tarefa única — cada versão tem
  //    seu próprio dur/horario)
  if (phases.render?.enabled) {
    const cfg = phases.render
    const qty = Math.max(1, cfg.qty || 1)
    const versions = cfg.versions || []
    const myFase = faseNum
    for (let v = 1; v <= qty; v++) {
      const ver = versions[v-1] || {}
      const dur = Math.max(1, ver.dur || 1)
      const horario = ver.horario || '18h'
      const fim = addBusiness(cur, dur-1)
      push(
        v===1 ? myFase : null,
        v===1 ? 'Pós / Entrega' : null,
        qty > 1
          ? `RENDER ALTA / COMP + ENTREGA V${pad(v)}`
          : 'RENDER ALTA / COMP + ENTREGA FINAL',
        BAR_COLORS.render, 'A REALIZAR', cur, fim, horario,
        `render_v${v}`
      )
      cur = addBusiness(fim, 1)
    }
    faseNum++
  }

  // ── Reduções
  buildVersioned('reducao', 'Formatos', 'REDUÇÕES', BAR_COLORS.reducao, false)

  // ── Grupo KV (Still + Final) — datas próprias, independente do projeto.
  //    Útil pra demandas de KV que rodam em paralelo / fora do prazo principal.
  const kvStillActive = phases.kvStill?.enabled
  const kvFinalActive = phases.kvFinal?.enabled
  if (kvStillActive || kvFinalActive) {
    // Datas próprias do grupo (vêm de kvStill, ou caem no projeto se vazias)
    const kvStartIso = phases.kvStill?.dataInicio || dataInicio
    cur = isoToDate(kvStartIso)
    while (cur.getDay() !== 1) cur = addDays(cur, 1)

    const groupLabel = kvStillActive ? 'KV Still' : 'KV Final'
    if (kvStillActive) {
      buildVersioned('kvStill', groupLabel, 'STILL', BAR_COLORS.kv_still, true)
    }
    if (kvFinalActive) {
      buildVersioned('kvFinal',
        kvStillActive ? null : groupLabel,
        'KV FINAL', BAR_COLORS.kv_final, false,
        { skipFase: kvStillActive }
      )
    }
  }

  return tasks
}
