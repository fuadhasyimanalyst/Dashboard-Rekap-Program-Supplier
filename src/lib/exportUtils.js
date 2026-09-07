// exceljs and html2canvas are fairly heavy, and only ever needed once the
// user clicks a download button — so they're dynamically imported instead
// of bundled into the app's initial chunk. Vite automatically resolves
// exceljs's browser-safe build via its package.json "browser" field, so we
// import the plain package name rather than a deep dist/ path (deep paths
// can fail to resolve depending on the local npm/OS setup).
const loadExcelJS = () => import('exceljs').then((m) => m.default || m)
const loadHtml2Canvas = () => import('html2canvas').then((m) => m.default || m)

const HEADER_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF234351' } }
const HEADER_FONT = { color: { argb: 'FFFFFFFF' }, bold: true, size: 11 }
const THIN_BORDER = { style: 'thin', color: { argb: 'FFE7E0D2' } }

function triggerBlobDownload(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/**
 * Build and download a neatly formatted .xlsx file.
 * columns: [{ label, key?, value?(row), width?, numFmt?, align? }]
 */
export async function downloadExcel(filename, sheetTitle, rows, columns) {
  const ExcelJS = await loadExcelJS()
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Rekap Program Supplier'
  wb.created = new Date()

  const ws = wb.addWorksheet(sheetTitle.slice(0, 31) || 'Data', {
    views: [{ state: 'frozen', ySplit: 1 }],
  })

  ws.columns = columns.map((c) => ({
    header: c.label,
    key: c.key || c.label,
    width: c.width || Math.max(12, c.label.length + 4),
    style: c.numFmt ? { numFmt: c.numFmt } : undefined,
  }))

  // Header row styling
  const headerRow = ws.getRow(1)
  headerRow.height = 22
  headerRow.eachCell((cell) => {
    cell.fill = HEADER_FILL
    cell.font = HEADER_FONT
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
    cell.border = { top: THIN_BORDER, bottom: THIN_BORDER, left: THIN_BORDER, right: THIN_BORDER }
  })

  rows.forEach((row, i) => {
    const values = {}
    columns.forEach((c) => {
      values[c.key || c.label] = typeof c.value === 'function' ? c.value(row) : row[c.key]
    })
    const r = ws.addRow(values)
    const isEven = i % 2 === 1
    r.eachCell((cell, colNumber) => {
      const col = columns[colNumber - 1]
      cell.border = { top: THIN_BORDER, bottom: THIN_BORDER, left: THIN_BORDER, right: THIN_BORDER }
      cell.alignment = { vertical: 'middle', horizontal: col?.align || 'left' }
      if (isEven) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF6F3EC' } }
    })
  })

  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columns.length } }

  const buf = await wb.xlsx.writeBuffer()
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  triggerBlobDownload(blob, filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`)
}

/**
 * Screenshot a DOM element and download it as a JPG image.
 */
export async function downloadElementAsImage(filename, element) {
  if (!element) return
  const html2canvas = await loadHtml2Canvas()

  // Make sure web fonts have actually finished loading before we snapshot —
  // otherwise html2canvas can measure text against fallback-font metrics,
  // throwing off row heights.
  if (document.fonts && document.fonts.ready) {
    try {
      await document.fonts.ready
    } catch {
      // ignore — proceed with capture regardless
    }
  }

  // Give the browser a couple of animation frames to finish any pending
  // layout/paint work before we snapshot — html2canvas reads live DOM
  // positions, so capturing mid-reflow can misplace or overlap content.
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))

  const canvas = await html2canvas(element, {
    backgroundColor: '#ffffff',
    // A fixed, generous scale (rather than relying on devicePixelRatio,
    // which can be as low as 1 on some devices) keeps text crisp instead
    // of blurry.
    scale: 2.5,
    useCORS: true,
  })
  await new Promise((resolve) => {
    canvas.toBlob(
      (blob) => {
        if (blob) triggerBlobDownload(blob, filename.endsWith('.jpg') ? filename : `${filename}.jpg`)
        resolve()
      },
      'image/jpeg',
      0.95
    )
  })
}
