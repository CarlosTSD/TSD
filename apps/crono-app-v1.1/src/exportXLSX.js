import * as XLSX from 'xlsx'
import { DIAS_PT, MESES_PT, STATUS_COLORS, isoToDate, calendarDates } from './scheduleEngine'

function hexToARGB(hex) { return 'FF' + hex.replace('#','') }

function cellFill(hex) {
  return { type:'pattern', pattern:'solid',
           fgColor:{ rgb: hexToARGB(hex) } }
}
function cellFont(opts={}) {
  return { name:'Arial', sz: opts.sz||8,
           bold: !!opts.bold, color:{ rgb: hexToARGB(opts.color||'#FFFFFF') } }
}
function cellAlign(h='center') {
  return { horizontal:h, vertical:'center', wrapText: !!h.wrap }
}

export function exportXLSX(config, tasks, version = 1) {
  const { nomeProjeto, descricao, dataInicio, dataFim } = config
  const wb = XLSX.utils.book_new()
  const ws = {}
  const merges = []

  let startIso = dataInicio
  let endIso = dataFim
  for (const t of tasks) {
    if (t.dIni < startIso) startIso = t.dIni
    if (t.dFim > endIso)   endIso   = t.dFim
  }
  const allDates = calendarDates(startIso, endIso)
  const COL_DATA = 8  // 0-indexed: cols 0-7 are fixed, dates start at col 8

  // ── column widths
  const colWidths = [
    {wch:2},{wch:4},{wch:13},{wch:28},{wch:2},{wch:14},{wch:3},
    ...allDates.map(()=>({wch:4}))
  ]
  ws['!cols'] = colWidths

  // ── row heights
  const rowH = []
  function setH(r,h){ rowH[r]={hpt:h} }
  setH(0,36); setH(1,28); setH(2,8); setH(3,16); setH(4,14); setH(5,14)

  function C(r,c) {
    return XLSX.utils.encode_cell({r,c})
  }
  function setCell(r,c,v,style={}) {
    const addr = C(r,c)
    ws[addr] = { v, t: typeof v==='number'?'n':'s', s: style }
  }
  function merge(r1,c1,r2,c2) { merges.push({s:{r:r1,c:c1},e:{r:r2,c:c2}}) }

  const BK = '#000000'
  const AZ = '#1F1FFF'
  const FDS_BG = '#FFCCCC'
  const UTIL_BG = '#000000'

  // ── Row 0: header
  merge(0,0,0,2)
  setCell(0,0,'tressde',{
    fill:cellFill('#0000AA'), font:cellFont({sz:16,bold:true}), alignment:cellAlign()})
  merge(0,3,0,COL_DATA+allDates.length-1)
  setCell(0,3,'Cronograma',{
    fill:cellFill(AZ), font:cellFont({sz:16,bold:true}), alignment:cellAlign()})

  // ── Row 1: descrição
  merge(1,0,1,COL_DATA+allDates.length-1)
  setCell(1,0,descricao||nomeProjeto,{
    fill:cellFill('#0A0A0A'), font:cellFont({sz:9,color:'#AAAAAA'}),
    alignment:{horizontal:'left',vertical:'center',wrapText:true}})

  // ── Row 2: faixa azul
  for(let c=0;c<COL_DATA+allDates.length;c++){
    setCell(2,c,'',{fill:cellFill('#3333CC')})
  }

  // ── Row 3: meses
  let mesStart=COL_DATA, prevMes=null
  allDates.forEach((d,i)=>{
    const key=`${d.getFullYear()}-${d.getMonth()}`
    if(prevMes && key!==prevMes){
      merge(3,mesStart,3,COL_DATA+i-1)
      setCell(3,mesStart,MESES_PT[new Date(allDates[mesStart-COL_DATA]).getMonth()+1],{
        fill:cellFill(BK), font:cellFont({sz:10,bold:true}), alignment:cellAlign()})
      mesStart=COL_DATA+i
    }
    prevMes=key
    setCell(3,COL_DATA+i,'',{fill:cellFill(BK)})
  })
  // last month
  merge(3,mesStart,3,COL_DATA+allDates.length-1)
  setCell(3,mesStart,MESES_PT[allDates[mesStart-COL_DATA].getMonth()+1],{
    fill:cellFill(BK),font:cellFont({sz:10,bold:true}),alignment:cellAlign()})

  // ── Row 4: FASE/STATUS labels
  setCell(4,1,'FASE',{fill:cellFill(BK),font:cellFont({bold:true}),alignment:cellAlign()})
  merge(4,1,4,2)
  setCell(4,5,'STATUS',{fill:cellFill(BK),font:cellFont({bold:true}),alignment:cellAlign()})

  // ── Rows 4-5: dia semana + número
  allDates.forEach((d,i)=>{
    const col=COL_DATA+i
    const isFds=d.getDay()===0||d.getDay()===6
    const bg=isFds?FDS_BG:BK
    const fc=isFds?'#FF4444':'#CCCCCC'
    const dow=d.getDay()===0?6:d.getDay()-1
    setCell(4,col,DIAS_PT[dow],{fill:cellFill(bg),font:cellFont({color:fc,sz:7}),alignment:cellAlign()})
    setCell(5,col,d.getDate(),{fill:cellFill(bg),font:cellFont({color:fc,sz:7}),alignment:cellAlign()})
  })

  // ── Task rows
  const ROW_START=6
  tasks.forEach((task,ti)=>{
    const row=ROW_START+ti
    setH(row,18)

    // fase num
    if(task.faseNum){
      setCell(row,1,task.faseNum,{
        fill:cellFill(BK),font:cellFont({bold:true}),alignment:cellAlign()})
    } else {
      setCell(row,1,'',{fill:cellFill(BK)})
    }
    // fase nome
    if(task.faseNome){
      setCell(row,2,task.faseNome,{
        fill:cellFill(BK),font:cellFont({color:'#AAAAAA',sz:8}),
        alignment:{horizontal:'left',vertical:'center'}})
    } else {
      setCell(row,2,'',{fill:cellFill(BK)})
    }

    // tarefa nome (cols 3-4 merge)
    merge(row,3,row,4)
    setCell(row,3,task.nome,{
      fill:cellFill(task.cor),font:cellFont({bold:true,sz:8}),
      alignment:{horizontal:'left',vertical:'center'}})

    // status
    const sc=STATUS_COLORS[task.status]||{bg:'#374151',fg:'#ffffff'}
    setCell(row,5,task.status,{
      fill:cellFill(sc.bg),font:cellFont({bold:true,color:sc.fg,sz:8}),alignment:cellAlign()})
    setCell(row,6,'▼',{
      fill:cellFill(sc.bg),font:cellFont({color:'#AAAAAA',sz:7}),alignment:cellAlign()})

    // calendar cells
    const dIni=isoToDate(task.dIni), dFim=isoToDate(task.dFim)
    allDates.forEach((d,i)=>{
      const col=COL_DATA+i
      const isFds=d.getDay()===0||d.getDay()===6
      const inRange=d>=dIni&&d<=dFim
      if(inRange){
        const isLast=d.toDateString()===dFim.toDateString()
        setCell(row,col,isLast&&task.horario?task.horario:'',{
          fill:cellFill(task.cor),
          font:cellFont({bold:true,color:'#000000',sz:7}),
          alignment:cellAlign()})
      } else if(isFds){
        setCell(row,col,'',{fill:cellFill(FDS_BG)})
      } else {
        setCell(row,col,'',{fill:cellFill(BK)})
      }
    })
  })

  // legenda
  const LR=ROW_START+tasks.length+2
  const legItems=[
    ['ATRASADO','#CC0000','#FFFFFF'],
    ['FDS/FERIADO','#FF8888','#000000'],
    ['CLIENTE','#FFAA00','#000000'],
    ['DATAS IMPORTANTES','#00CC44','#000000'],
  ]
  legItems.forEach(([txt,bg,fg],k)=>{
    const col=1+k*2
    merge(LR,col,LR,col+1)
    setCell(LR,col,txt,{
      fill:cellFill(bg),font:cellFont({bold:true,color:fg,sz:8}),alignment:cellAlign()})
  })

  ws['!merges']=merges
  ws['!rows']=rowH

  // define range
  const lastR=LR+2, lastC=COL_DATA+allDates.length
  ws['!ref']=XLSX.utils.encode_range({s:{r:0,c:0},e:{r:lastR,c:lastC}})

  XLSX.utils.book_append_sheet(wb,ws,'CRONO PRODUÇÃO')
  const v = String(version || 1).padStart(2, '0')
  const safeBase = (nomeProjeto || 'cronograma').toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
  XLSX.writeFile(wb, `${safeBase}_Cronograma_v${v}.xlsx`)
}
