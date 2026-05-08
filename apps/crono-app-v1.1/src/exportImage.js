import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'

function safeName(name) {
  const base = (name || 'cronograma').trim() || 'cronograma'
  return base.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

function buildFilename(projectName, version, ext) {
  const v = String(version || 1).padStart(2, '0')
  return `${safeName(projectName)}_Cronograma_v${v}.${ext}`
}

// Captura em 2x (retina) — texto e bordas ficam crispy.
// `backgroundColor: null` preserva o bg próprio do elemento (dark do frame).
async function snapshot(element) {
  return html2canvas(element, {
    backgroundColor: null,
    scale: 2,
    useCORS: true,
    logging: false,
    imageTimeout: 0,
    windowWidth: element.scrollWidth,
    windowHeight: element.scrollHeight,
    width: element.scrollWidth,
    height: element.scrollHeight,
  })
}

export async function exportPNG(element, projectName, version = 1) {
  if (!element) return
  const canvas = await snapshot(element)
  const link = document.createElement('a')
  link.download = buildFilename(projectName, version, 'png')
  link.href = canvas.toDataURL('image/png') // PNG nativo, lossless
  link.click()
}

export async function exportPDF(element, projectName, version = 1) {
  if (!element) return
  const canvas = await snapshot(element)
  const w = canvas.width, h = canvas.height
  // PDF com page dimensions = canvas (em pt). Image em PNG (lossless) pra
  // máxima nitidez de texto e bordas.
  const pdf = new jsPDF({
    orientation: w > h ? 'landscape' : 'portrait',
    unit: 'pt',
    format: [w, h],
    compress: true,
  })
  const imgData = canvas.toDataURL('image/png')
  pdf.addImage(imgData, 'PNG', 0, 0, w, h, undefined, 'FAST')
  pdf.save(buildFilename(projectName, version, 'pdf'))
}
