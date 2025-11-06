// ====== Supabase client (sudah kamu buat terpisah) ======
import { supabase } from './supabaseClient.js'

/* ================= alert helper ================= */
const alertBox = document.getElementById('alert')
function showAlert(msg, ok = true) {
  alertBox.className = `mb-4 p-3 rounded border text-sm ${ok
    ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
    : 'border-rose-300 bg-rose-50 text-rose-700'}`
  alertBox.textContent = msg
  alertBox.classList.remove('hidden')
}
function hideAlert() { alertBox.classList.add('hidden') }

/* ================= tabs ================= */
const tabKelas = document.getElementById('tab-kelas')
const tabSantri = document.getElementById('tab-santri')
const tabLaporan = document.getElementById('tab-laporan')
const panelKelas = document.getElementById('panel-kelas')
const panelSantri = document.getElementById('panel-santri')
const panelLaporan = document.getElementById('panel-laporan')

function switchTab({ button, panel }) {
  ;[tabKelas, tabSantri, tabLaporan].forEach(b => b.classList.remove('border-b-2', 'border-blue-600', 'text-blue-600'))
  ;[panelKelas, panelSantri, panelLaporan].forEach(p => p.classList.add('hidden'))
  button.classList.add('border-b-2', 'border-blue-600', 'text-blue-600')
  panel.classList.remove('hidden')
  hideAlert()
}

tabKelas.onclick = () => switchTab({ button: tabKelas, panel: panelKelas })
tabSantri.onclick = () => switchTab({ button: tabSantri, panel: panelSantri })
tabLaporan.onclick = () => switchTab({ button: tabLaporan, panel: panelLaporan })

/* ================= refs ================= */
const selectKelas = document.getElementById('selectKelas')
const tbodyKelas = document.getElementById('tbodyKelas')
const btnSimpan = document.getElementById('btnSimpanKelas')

const sanKelas = document.getElementById('sanKelas')
const sanSantri = document.getElementById('sanSantri')
const sanPelanggaran = document.getElementById('sanPelanggaran')
const sanJam = document.getElementById('sanJam')
const sanTanggal = document.getElementById('sanTanggal')
const sanKet = document.getElementById('sanKet')
const sanSimpan = document.getElementById('sanSimpan')

const lapKelas = document.getElementById('lapKelas')
const lapSantri = document.getElementById('lapSantri')
const lapBulan = document.getElementById('lapBulan')
const lapTahun = document.getElementById('lapTahun')
const btnTampil = document.getElementById('btnTampilkan')
const btnCetak = document.getElementById('btnCetak')
const btnPdfWa = document.getElementById('btnPdfWa') || document.getElementById('btnKirimWa')

const tbodyLap = document.getElementById('tbodyLaporan')
const lapTitle = document.getElementById('lap-title') // optional
const lapSubtitle = document.getElementById('lap-subtitle')
const lapWrap = document.getElementById('lap-wrap')
const lapTable = document.getElementById('lap-table')

/* ================= loaders ================= */
async function loadClasses() {
  const { data, error } = await supabase.from('classes').select('id, kelas').order('kelas')
  if (error) { showAlert(error.message, false); return [] }
  // Kelas untuk panel Kelas & laporan
  selectKelas.innerHTML = data.map(c => `<option value="${c.id}">${c.kelas}</option>`).join('')
  lapKelas.innerHTML = data.map(c => `<option value="${c.id}">${c.kelas}</option>`).join('')
  // Kelas untuk panel Santri
  sanKelas.innerHTML = data.map(c => `<option value="${c.id}">${c.kelas}</option>`).join('')
  return data
}

async function loadStudentsByClass(classId) {
  const { data, error } = await supabase
    .from('students')
    .select('id, name')
    .eq('class_id', classId)
    .order('name')
  if (error) { showAlert(error.message, false); return [] }
  return data || []
}

/* ================= renderers ================= */
function renderKelasRows(students) {
  const today = new Date().toISOString().slice(0, 10)
  tbodyKelas.innerHTML = students.map(s => `
    <tr data-student-id="${s.id}">
      <td class="p-2 border">${s.name}</td>
      <td class="p-2 border"><input class="w-full border rounded px-2 py-1" name="violation"></td>
      <td class="p-2 border"><input class="w-full border rounded px-2 py-1" type="time" name="time"></td>
      <td class="p-2 border"><input class="w-full border rounded px-2 py-1" type="date" name="date" value="${today}"></td>
      <td class="p-2 border"><input class="w-full border rounded px-2 py-1" name="notes"></td>
    </tr>
  `).join('')
}

function collectRows() {
  const rows = []
  tbodyKelas.querySelectorAll('tr').forEach(tr => {
    rows.push({
      student_id: tr.getAttribute('data-student-id'),
      violation: tr.querySelector('input[name="violation"]').value.trim(),
      time: tr.querySelector('input[name="time"]').value || null,
      date: tr.querySelector('input[name="date"]').value || null,
      notes: tr.querySelector('input[name="notes"]').value.trim() || null,
    })
  })
  return rows
}

/* ================= events: Input per Kelas ================= */
selectKelas.addEventListener('change', async () => {
  const classId = selectKelas.value
  const students = await loadStudentsByClass(classId)
  renderKelasRows(students)
})

btnSimpan.addEventListener('click', async () => {
  const selectedClassId = selectKelas.value
  if (!selectedClassId) return showAlert('Pilih kelas terlebih dahulu.', false)

  const rows = collectRows()
  const payload = rows
    .filter(r => r.violation)
    .map(r => ({
      student_id: r.student_id,
      class_id: selectedClassId, // wajib
      violation: r.violation,
      time_at: r.time || null,
      date_at: r.date || null,
      notes: r.notes || null
    }))
  if (!payload.length) return showAlert('Tidak ada pelanggaran yang diisi.', false)

  const { error } = await supabase.from('violations').insert(payload)
  if (error) return showAlert(error.message, false)
  showAlert(`Berhasil simpan ${payload.length} data.`)
  tbodyKelas.querySelectorAll('input[name="violation"], input[name="notes"]').forEach(i => i.value = '')
  tbodyKelas.querySelectorAll('input[name="time"]').forEach(i => i.value = '')
})

/* ================= events: Input per Santri ================= */
sanKelas.addEventListener('change', async () => {
  const classId = sanKelas.value
  const students = await loadStudentsByClass(classId)
  sanSantri.innerHTML = `<option value="">-- Pilih santri --</option>` + students.map(s => `<option value="${s.id}">${s.name}</option>`).join('')
})

sanSimpan.addEventListener('click', async () => {
  const classId = sanKelas.value
  const studentId = sanSantri.value
  const violation = sanPelanggaran.value.trim()
  const time_at = sanJam.value || null
  const date_at = sanTanggal.value || null
  const notes = sanKet.value.trim() || null

  if (!classId) return showAlert('Pilih kelas dulu.', false)
  if (!studentId) return showAlert('Pilih santri dulu.', false)
  if (!violation) return showAlert('Isi pelanggaran.', false)

  const { error } = await supabase.from('violations').insert([{ student_id: studentId, class_id: classId, violation, time_at, date_at, notes }])
  if (error) return showAlert(error.message, false)
  showAlert('Berhasil simpan 1 data.')
  sanPelanggaran.value = ''
  sanJam.value = ''
  sanKet.value = ''
})

/* ================= utilities: months, years ================= */
const MONTHS = ['01','02','03','04','05','06','07','08','09','10','11','12']
function fillMonthYearDropdowns() {
  // lapBulan sudah punya opsi “Semua” di HTML; biarkan
  const year = new Date().getFullYear()
  lapTahun.value = year
}

/* ================= events: Laporan ================= */
lapKelas.addEventListener('change', async () => {
  const classId = lapKelas.value
  const students = await loadStudentsByClass(classId)
  lapSantri.innerHTML = `<option value="">Semua Santri</option>` + students.map(s => `<option value="${s.id}">${s.name}</option>`).join('')
})

let lastData = []
let sortState = { key: 'date_at', dir: 'desc' }

function applySort(data) {
  const { key, dir } = sortState
  const mul = dir === 'asc' ? 1 : -1
  return data.slice().sort((a, b) => {
    const va = (a[key] ?? '').toString()
    const vb = (b[key] ?? '').toString()
    if (va < vb) return -1 * mul
    if (va > vb) return  1 * mul
    return 0
  })
}

function renderLapTable(rows) {
  const html = rows.map((r, i) => `
    <tr>
      <td class="p-2 border">${i + 1}</td>
      <td class="p-2 border">${r.student_name || ''}</td>
      <td class="p-2 border">${r.kelas || ''}</td>
      <td class="p-2 border">${r.violation || ''}</td>
      <td class="p-2 border">${r.date_at || ''}</td>
      <td class="p-2 border">${r.time_at || ''}</td>
      <td class="p-2 border">${r.notes || ''}</td>
    </tr>
  `).join('')
  tbodyLap.innerHTML = html
}

function updateSortIcons() {
  lapTable.querySelectorAll('th[data-sort] .sort-ico').forEach(el => el.textContent = '')
  const ico = document.getElementById('ico-' + sortState.key)
  if (ico) ico.textContent = sortState.dir === 'asc' ? '▲' : '▼'
}

lapTable.addEventListener('click', (e) => {
  const th = e.target.closest('th[data-sort]')
  if (!th) return
  const key = th.getAttribute('data-sort')
  if (sortState.key === key) {
    sortState.dir = sortState.dir === 'asc' ? 'desc' : 'asc'
  } else {
    sortState.key = key
    sortState.dir = 'asc'
  }
  const sorted = applySort(lastData)
  renderLapTable(sorted)
  updateSortIcons()
})

btnTampil.addEventListener('click', async () => {
  const classId = lapKelas.value
  const studentId = lapSantri.value || null
  const bulan = lapBulan.value
  const tahun = lapTahun.value

  let q = supabase.from('v_violations_expanded').select('*')
  if (classId) q = q.eq('class_id', classId)
  if (studentId) q = q.eq('student_id', studentId)

  // filter periode (hindari 31 utk semua bulan)
  if (bulan && tahun) {
    const start = `${tahun}-${bulan}-01`
    const end = `${tahun}-${bulan}-31`
    q = q.gte('date_at', start).lte('date_at', end)
  }

  const { data, error } = await q.order('date_at', { ascending: false })
  if (error) return showAlert(error.message, false)

  lastData = data || []
  sortState = { key: 'date_at', dir: 'desc' }
  renderLapTable(applySort(lastData))
  updateSortIcons()

  const kelasOpt  = lapKelas.options[lapKelas.selectedIndex]?.text || ''
  const santriOpt = lapSantri.value ? (lapSantri.options[lapSantri.selectedIndex]?.text || '') : 'Semua'
  const periode   = bulan ? `${bulan}-${tahun}` : `Semua Bulan`
  lapTitle && (lapTitle.textContent = 'Laporan Pelanggaran Santri')
  lapSubtitle.textContent = `Kelas: ${kelasOpt} | Santri: ${santriOpt} | Periode: ${periode}`

  showAlert(`Menampilkan ${lastData.length} data.`)
})

btnCetak.addEventListener('click', () => window.print())

/* ===== helper pastikan html2pdf ada ===== */
async function ensureHtml2Pdf() {
  if (window.html2pdf) return
  await new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = 'https://cdn.jsdelivr.net/npm/html2pdf.js@0.10.1/dist/html2pdf.bundle.min.js'
    s.onload = resolve
    s.onerror = () => reject(new Error('Gagal memuat html2pdf'))
    document.head.appendChild(s)
  })
}

/* ===== handler PDF + WA (FIX RangeError) ===== */
btnPdfWa.addEventListener('click', async () => {
  try {
    await ensureHtml2Pdf()
  } catch (e) {
    showAlert(e.message || 'html2pdf belum dimuat', false)
    return
  }
  if (!lastData.length) {
    showAlert('Tampilkan data dulu sebelum membuat PDF.', false)
    return
  }

  const opt = {
    margin: 10,
    filename: `laporan-pelanggaran-${Date.now()}.pdf`,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2 },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' }
  }

    // cara aman: ambil arraybuffer lalu buat Blob sendiri (hindari RangeError)
  const worker = html2pdf().set(opt).from(lapWrap).toPdf()
  const pdf = await worker.get('pdf')                     // ambil jsPDF instance
  const arrayBuffer = pdf.output('arraybuffer')           // hasilkan ArrayBuffer
  const blob = new Blob([arrayBuffer], { type: 'application/pdf' }) // buat Blob manual

  // ubah ke base64 untuk upload
  const buf = await blob.arrayBuffer()
  const base64 = btoa(String.fromCharCode(...new Uint8Array(buf)))


  // upload ke route serverless kamu: /api/upload-report
  try {
    const res = await fetch('/api/upload-report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename: opt.filename, base64 })
    })
    const json = await res.json()
    if (!res.ok) throw new Error(json?.error || 'Upload gagal')

    const url = json.publicUrl
    showAlert('PDF berhasil dibuat.', true)

    const ringkasan = lapSubtitle?.textContent?.trim() || ''
    const text = encodeURIComponent(
      `Assalamu'alaikum. Berikut laporan pelanggaran santri (${ringkasan}). PDF: ${url}`
    )
    window.open(`https://wa.me/?text=${text}`, '_blank')
  } catch (e) {
    showAlert(e.message || 'Gagal upload PDF', false)
  }
})

/* ================= init ================= */
;(async function init() {
  await loadClasses()
  if (selectKelas.value) {
    const students = await loadStudentsByClass(selectKelas.value)
    renderKelasRows(students)
  }
  // default tanggal per santri
  sanTanggal.valueAsDate = new Date()
  // default tahun
  fillMonthYearDropdowns()
  // opsi santri untuk laporan awal
  if (lapKelas.value) {
    const students = await loadStudentsByClass(lapKelas.value)
    lapSantri.innerHTML = `<option value="">Semua Santri</option>` +
      students.map(s => `<option value="${s.id}">${s.name}</option>`).join('')
  }
})()
