// js/app-logic.js
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
// dukung dua nama tombol WA: btnPdfWa (HTML versi ku) atau btnKirimWa (versi kamu)
const btnPdfWa = document.getElementById('btnPdfWa') || document.getElementById('btnKirimWa')

const tbodyLap = document.getElementById('tbodyLaporan')
// dukung dua skema judul/subjudul: (lap-title & lap-subtitle) atau lap-meta
const lapTitle = document.getElementById('lap-title') || null
const lapSubtitle = document.getElementById('lap-subtitle') || null
const lapMeta = document.getElementById('lap-meta') || null

const lapWrap = document.getElementById('lap-wrap')
const lapTable = document.getElementById('lap-table')

/* ================= loaders ================= */
async function loadClasses() {
  const { data, error } = await supabase.from('classes').select('id, kelas').order('kelas')
  if (error) { showAlert(error.message, false); return [] }
  // Kelas untuk panel Kelas & laporan
  if (selectKelas) selectKelas.innerHTML = data.map(c => `<option value="${c.id}">${c.kelas}</option>`).join('')
  if (lapKelas) lapKelas.innerHTML = data.map(c => `<option value="${c.id}">${c.kelas}</option>`).join('')
  // Kelas untuk panel Santri
  if (sanKelas) sanKelas.innerHTML = data.map(c => `<option value="${c.id}">${c.kelas}</option>`).join('')
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
if (selectKelas) {
  selectKelas.addEventListener('change', async () => {
    const classId = selectKelas.value
    const students = await loadStudentsByClass(classId)
    renderKelasRows(students)
  })
}

if (btnSimpan) {
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
}

/* ================= events: Input per Santri ================= */
if (sanKelas) {
  sanKelas.addEventListener('change', async () => {
    const classId = sanKelas.value
    const students = await loadStudentsByClass(classId)
    sanSantri.innerHTML = `<option value="">-- Pilih santri --</option>` + students.map(s => `<option value="${s.id}">${s.name}</option>`).join('')
  })
}

if (sanSimpan) {
  sanSimpan.addEventListener('click', async () => {
    const classId = sanKelas.value
    const studentId = sanSantri.value
    const violation = sanPelanggaran.value.trim()
    const time_at = sanJam.value || null
    const date_at = sanTanggal.value || null
    const notes = sanKet.value?.trim() || null

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
}

/* ================= utilities: months, years ================= */
function fillMonthYearDropdowns() {
  // kalau HTML sudah isi bulan sendiri, biarin; kalau kosong, isi 01..12
  if (lapBulan && lapBulan.options.length <= 1) {
    const MONTHS = ['01','02','03','04','05','06','07','08','09','10','11','12']
    lapBulan.innerHTML = `<option value="">Semua</option>` + MONTHS.map(m => `<option value="${m}">${m}</option>`).join('')
  }
  if (lapTahun) {
    const year = new Date().getFullYear()
    if (!lapTahun.value) lapTahun.value = year
  }
}

function monthToTwoDigits(val) { ... }
function lastDayOfMonthYYYYMMDD(year, mm2) { ... }

function formatIndoDate(iso) {
  if (!iso) return ''
  // biar sederhana tampilkan apa adanya (YYYY-MM-DD). Kalau mau lokal:
  try {
    const d = new Date(iso)
    if (!isNaN(d)) return d.toLocaleDateString('id-ID', { year:'numeric', month:'long', day:'numeric' })
  } catch {}
  return iso
}
function monthToTwoDigits(val) {
  // kalau sudah "01".."12", kembalikan apa adanya
  if (/^\d{1,2}$/.test(val)) return String(val).padStart(2, '0');
  // mapping nama bulan → 2 digit
  const map = {
    Januari:'01', February:'02', Februari:'02', Maret:'03', April:'04', Mei:'05',
    Juni:'06', Juli:'07', Agustus:'08', September:'09', Oktober:'10',
    November:'11', Desember:'12',
    'Semua':'', 'All':''
  };
  return map[val] ?? '';
}

function lastDayOfMonthYYYYMMDD(year, mm2) {
  // new Date(year, monthIndex, 0) → hari terakhir bulan (monthIndex 1..12)
  const last = new Date(Number(year), Number(mm2), 0).getDate();
  return `${year}-${mm2}-${String(last).padStart(2,'0')}`;
}


/* ================= events: Laporan ================= */
if (lapKelas) {
  lapKelas.addEventListener('change', async () => {
    const classId = lapKelas.value
    const students = await loadStudentsByClass(classId)
    lapSantri.innerHTML = `<option value="">Semua Santri</option>` + students.map(s => `<option value="${s.id}">${s.name}</option>`).join('')
  })
}

let lastData = []
let sortState = { key: 'date_at', dir: 'desc' }

function applySort(data) {
  const { key, dir } = sortState
  const mul = dir === 'asc' ? 1 : -1
  return data.slice().sort((a, b) => {
    // Tanggal diurutkan sebagai tanggal beneran
    if (key === 'date_at') {
      const da = new Date(a.date_at || '1970-01-01').getTime()
      const db = new Date(b.date_at || '1970-01-01').getTime()
      return (da - db) * mul
    }
    const va = (a[key] ?? '').toString().toLowerCase()
    const vb = (b[key] ?? '').toString().toLowerCase()
    if (va < vb) return -1 * mul
    if (va > vb) return 1 * mul
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
      <td class="p-2 border">${formatIndoDate(r.date_at) || ''}</td>
      <td class="p-2 border">${r.time_at || ''}</td>
      <td class="p-2 border">${r.notes || ''}</td>
    </tr>
  `).join('')
  tbodyLap.innerHTML = html
}

function updateSortIcons() {
  if (!lapTable) return
  // kosongkan semua ikon dulu
  lapTable.querySelectorAll('th[data-sort] .sort-ico').forEach(el => el.textContent = '⇅')
  // utamakan cari id ico-<key>, kalau gak ada ambil .sort-ico di th yang sesuai
  const byId = document.getElementById('ico-' + sortState.key)
  if (byId) {
    byId.textContent = sortState.dir === 'asc' ? '▲' : '▼'
  } else {
    const th = lapTable.querySelector(`th[data-sort="${sortState.key}"] .sort-ico`)
    if (th) th.textContent = sortState.dir === 'asc' ? '▲' : '▼'
  }
}

if (lapTable) {
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
}

if (btnTampil) {
  btnTampil.addEventListener('click', async () => {
  const classId   = lapKelas.value;
  const studentId = lapSantri.value || null;

  const bulanRaw = lapBulan.value;
  const bulan = monthToTwoDigits(bulanRaw);
  const tahun = lapTahun.value;

  let q = supabase.from('v_violations_expanded').select('*');
  if (classId)   q = q.eq('class_id', classId);
  if (studentId) q = q.eq('student_id', studentId);

  if (bulan && tahun) {
    const start = `${tahun}-${bulan}-01`;
    const end   = lastDayOfMonthYYYYMMDD(tahun, bulan);
    q = q.gte('date_at', start).lte('date_at', end);
  }

  const { data, error } = await q.order('date_at', { ascending: false });
  if (error) return showAlert(error.message, false);

  lastData = data || [];
  sortState = { key: 'date_at', dir: 'desc' };
  renderLapTable(applySort(lastData));
  updateSortIcons();

  const kelasOpt  = lapKelas.options[lapKelas.selectedIndex]?.text || '';
  const santriOpt = lapSantri.value ? (lapSantri.options[lapSantri.selectedIndex]?.text || '') : 'Semua';
  const periode   = (bulan && tahun) ? `${bulan}-${tahun}` : 'Semua Bulan';
  lapTitle.textContent    = 'Laporan Pelanggaran Santri';
  lapSubtitle.textContent = `Kelas: ${kelasOpt} | Santri: ${santriOpt} | Periode: ${periode}`;

  showAlert(`Menampilkan ${lastData.length} data.`);
});

}

if (btnCetak) {
  btnCetak.addEventListener('click', () => {
    window.print()
  })
}

if (btnPdfWa) {
  btnPdfWa.addEventListener('click', async () => {
    if (!lastData.length) return showAlert('Tampilkan data dulu.', false)

    if (typeof html2pdf === 'undefined') {
      return showAlert('html2pdf belum dimuat. Tambahkan script html2pdf di <head>.', false)
    }

    const filename = `laporan-pelanggaran-${Date.now()}.pdf`
    const opt = {
      margin: 10,
      filename,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' }
    }

    // render html -> pdf (blob)
    const blob = await html2pdf().from(lapWrap).set(opt).outputPdf('blob')
    const buf = await blob.arrayBuffer()
    const base64 = btoa(String.fromCharCode(...new Uint8Array(buf)))

    // upload ke Supabase Storage via route serverless
    const res = await fetch('/api/upload-report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename, base64 })
    })
    const json = await res.json()
    if (!res.ok) return showAlert(json.error || 'Gagal upload PDF', false)

    const url = json.publicUrl
    showAlert('PDF jadi: ' + url)

    // siapkan teks WA
    let periode = ''
    const bulan = lapBulan.value
    const tahun = lapTahun.value
    if (bulan && tahun) periode = `${bulan}-${tahun}`; else periode = 'Semua Bulan'

    const kelasOpt = lapKelas?.options[lapKelas.selectedIndex]?.text || ''
    const santriOpt = lapSantri?.value ? (lapSantri.options[lapSantri.selectedIndex]?.text || '') : 'Semua'
    const caption = `Laporan Pelanggaran Santri | Kelas: ${kelasOpt} | Santri: ${santriOpt} | Periode: ${periode}\nPDF: ${url}`

    const text = encodeURIComponent(`Assalamu'alaikum. ${caption}`)
    // buka WA (manual kirim)
    window.open(`https://wa.me/?text=${text}`, '_blank')
  })
}

/* ================= init ================= */
;(async function init() {
  await loadClasses()

  // Input per Kelas: render awal
  if (selectKelas && selectKelas.value) {
    const students = await loadStudentsByClass(selectKelas.value)
    renderKelasRows(students)
  }

  // default tanggal per santri
  if (sanTanggal) sanTanggal.valueAsDate = new Date()

  // Bulan/tahun laporan
  fillMonthYearDropdowns()

  // Laporan: isi dropdown santri awal
  if (lapKelas && lapKelas.value) {
    const students = await loadStudentsByClass(lapKelas.value)
    lapSantri.innerHTML = `<option value="">Semua Santri</option>` + students.map(s => `<option value="${s.id}">${s.name}</option>`).join('')
  }
})()
