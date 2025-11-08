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
const sanPelanggaranSel = document.getElementById('sanPelanggaranSel')
const sanPelanggaranOther = document.getElementById('sanPelanggaranOther')
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
const btnKirimWa = document.getElementById('btnKirimWa')
const tbodyLap = document.getElementById('tbodyLaporan')
const lapTitle = document.getElementById('lap-title')
const lapSubtitle = document.getElementById('lap-subtitle')
const lapWrap = document.getElementById('lap-wrap')
const lapTable = document.getElementById('lap-table')

/* ================= preset pelanggaran ================= */
const VIOLATION_OPTIONS = [
  'Terlambat',
  'Atribut tidak lengkap',
  'Tidak mengikuti pelajaran',
  'Terlambat mengikuti pelajaran',
  'Lainnya'
]
function fillViolationSelect(el) {
  el.innerHTML = VIOLATION_OPTIONS.map(v => `<option value="${v}">${v}</option>`).join('')
}

/* ================= kelas map & helpers WA ================= */
let CLASS_MAP = new Map() // id -> { id, kelas, wali_name, wali_phone }

function toWa62(num) {
  if (!num) return null
  let n = ('' + num).replace(/\D/g, '')
  if (n.startsWith('0')) n = '62' + n.slice(1)
  if (!n.startsWith('62')) n = '62' + n.replace(/^62+/, '')
  return n
}

/* ================= loaders ================= */
async function loadClasses() {
  const { data, error } = await supabase
    .from('classes')
    .select('id, kelas, wali_name, wali_phone')
    .order('kelas')

  if (error) { showAlert(error.message, false); return [] }

  CLASS_MAP = new Map(data.map(c => [c.id, c]))

  // Input per Kelas
  selectKelas.innerHTML = data.map(c => `<option value="${c.id}">${c.kelas}</option>`).join('')

  // Laporan: “Semua Kelas” paling atas
  lapKelas.innerHTML = `<option value="">Semua Kelas</option>` +
    data.map(c => `<option value="${c.id}">${c.kelas}</option>`).join('')

  // Input per Santri
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

      <td class="p-2 border">
        <select class="w-full border rounded px-2 py-1" name="violation_sel">
          ${VIOLATION_OPTIONS.map(v => `<option value="${v}">${v}</option>`).join('')}
        </select>
        <input class="w-full border rounded px-2 py-1 mt-1 hidden" name="violation_other" placeholder="Isi pelanggaran..." />
      </td>

      <td class="p-2 border"><input class="w-full border rounded px-2 py-1" type="time" name="time"></td>
      <td class="p-2 border"><input class="w-full border rounded px-2 py-1" type="date" name="date" value="${today}"></td>
      <td class="p-2 border"><input class="w-full border rounded px-2 py-1" name="notes"></td>
    </tr>
  `).join('')
}

/* toggle “lainnya” di input per kelas */
tbodyKelas.addEventListener('change', (e) => {
  const sel = e.target.closest('select[name="violation_sel"]')
  if (!sel) return
  const tr = sel.closest('tr')
  const other = tr.querySelector('input[name="violation_other"]')
  if (sel.value === 'Lainnya') {
    other.classList.remove('hidden'); other.focus()
  } else {
    other.classList.add('hidden'); other.value = ''
  }
})

function collectRows() {
  const rows = []
  tbodyKelas.querySelectorAll('tr').forEach(tr => {
    const sel = tr.querySelector('select[name="violation_sel"]')
    const other = tr.querySelector('input[name="violation_other"]')
    const violationVal = sel.value === 'Lainnya'
      ? (other.value || '').trim()
      : sel.value

    rows.push({
      student_id: tr.getAttribute('data-student-id'),
      violation: violationVal,
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

  // bersihkan pelanggaran/notes/jam
  tbodyKelas.querySelectorAll('input[name="violation_other"]').forEach(i => { i.value=''; i.classList.add('hidden') })
  tbodyKelas.querySelectorAll('select[name="violation_sel"]').forEach(sel => { sel.value = VIOLATION_OPTIONS[0] })
  tbodyKelas.querySelectorAll('input[name="notes"]').forEach(i => i.value = '')
  tbodyKelas.querySelectorAll('input[name="time"]').forEach(i => i.value = '')
})

/* ================= events: Input per Santri ================= */
sanKelas.addEventListener('change', async () => {
  const classId = sanKelas.value
  const students = await loadStudentsByClass(classId)
  sanSantri.innerHTML = `<option value="">-- Pilih santri --</option>` +
    students.map(s => `<option value="${s.id}">${s.name}</option>`).join('')
})

sanPelanggaranSel.addEventListener('change', () => {
  if (sanPelanggaranSel.value === 'Lainnya') {
    sanPelanggaranOther.classList.remove('hidden'); sanPelanggaranOther.focus()
  } else {
    sanPelanggaranOther.classList.add('hidden'); sanPelanggaranOther.value = ''
  }
})

sanSimpan.addEventListener('click', async () => {
  const classId   = sanKelas.value
  const studentId = sanSantri.value
  const violation = (sanPelanggaranSel.value === 'Lainnya'
                      ? sanPelanggaranOther.value
                      : sanPelanggaranSel.value).trim()
  const time_at   = sanJam.value || null
  const date_at   = sanTanggal.value || null
  const notes     = sanKet.value.trim() || null

  if (!classId)   return showAlert('Pilih kelas dulu.', false)
  if (!studentId) return showAlert('Pilih santri dulu.', false)
  if (!violation) return showAlert('Isi pelanggaran.', false)

  const { error } = await supabase.from('violations').insert([
    { student_id: studentId, class_id: classId, violation, time_at, date_at, notes }
  ])
  if (error) return showAlert(error.message, false)

  showAlert('Berhasil simpan 1 data.')
  sanPelanggaranSel.value = VIOLATION_OPTIONS[0]
  sanPelanggaranOther.classList.add('hidden'); sanPelanggaranOther.value = ''
  sanJam.value = ''; sanKet.value = ''
})

/* ================= events: Laporan ================= */
lapKelas.addEventListener('change', async () => {
  const classId = lapKelas.value
  if (!classId) { // semua kelas
    lapSantri.innerHTML = `<option value="">Semua Santri</option>`
    return
  }
  const students = await loadStudentsByClass(classId)
  lapSantri.innerHTML = `<option value="">Semua Santri</option>` +
    students.map(s => `<option value="${s.id}">${s.name}</option>`).join('')
})

let lastData = []

function renderLapTable(rows) {
  const html = rows.map((r, i) => `
    <tr data-vid="${r.id || ''}">
      <td class="p-2 border">${i + 1}</td>
      <td class="p-2 border">${r.student_name || ''}</td>
      <td class="p-2 border">${r.kelas || r.class_name || r.class || ''}</td>
      <td class="p-2 border">${r.violation || ''}</td>
      <td class="p-2 border">${r.date_at || ''}</td>
      <td class="p-2 border">${r.time_at || ''}</td>
      <td class="p-2 border">${r.notes || ''}</td>
      <td class="p-2 border text-center">
        <button class="btn-del px-2 py-1 text-white bg-rose-600 rounded">Hapus</button>
      </td>
    </tr>
  `).join('')
  tbodyLap.innerHTML = html
}

/* hapus data pelanggaran di tabel laporan */
tbodyLap.addEventListener('click', async (e) => {
  const btn = e.target.closest('.btn-del')
  if (!btn) return
  const tr = btn.closest('tr')
  const id = tr?.getAttribute('data-vid')
  if (!id) return showAlert('ID pelanggaran tidak ditemukan.', false)

  if (!confirm('Hapus data pelanggaran ini?')) return
  const { error } = await supabase.from('violations').delete().eq('id', id)
  if (error) return showAlert(error.message, false)

  tr.remove()
  showAlert('Data pelanggaran terhapus.')
})

btnTampil.addEventListener('click', async () => {
  const classId   = lapKelas.value || null
  const studentId = lapSantri.value || null
  const bulan     = lapBulan.value
  const tahun     = lapTahun.value

  let q = supabase.from('v_violations_expanded').select('*')

  if (classId)   q = q.eq('class_id', classId)
  if (studentId) q = q.eq('student_id', studentId)
  if (bulan && tahun) {
    const lastDay = new Date(Number(tahun), Number(bulan), 0).getDate()
    const start = `${tahun}-${bulan}-01`
    const end   = `${tahun}-${bulan}-${String(lastDay).padStart(2,'0')}`
    q = q.gte('date_at', start).lte('date_at', end)
  }

  const { data, error } = await q.order('date_at', { ascending: false })
  if (error) return showAlert(error.message, false)

  lastData = data || []
  renderLapTable(lastData)
  showAlert(`Menampilkan ${lastData.length} data.`)

  const kelasText  = lapKelas.value ? (lapKelas.options[lapKelas.selectedIndex].text) : 'Semua Kelas'
  const santriText = lapSantri.value ? (lapSantri.options[lapSantri.selectedIndex].text) : 'Semua'
  const bulanText  = lapBulan.value ? lapBulan.options[lapBulan.selectedIndex].text : 'Semua Bulan'
  lapTitle.textContent    = 'Laporan Pelanggaran Santri'
  lapSubtitle.textContent = `Kelas: ${kelasText} | Santri: ${santriText} | Periode: ${bulanText} ${lapTahun.value || ''}`.trim()
})

btnCetak.addEventListener('click', () => { window.print() })

function ensureHtml2Pdf() {
  return new Promise((resolve, reject) => {
    const ok = typeof window.html2pdf !== 'undefined'
    ok ? resolve() : reject(new Error('html2pdf belum dimuat'))
  })
}

/* ===== handler PDF + WA: kirim ke wali kelas (nama & nomor) ===== */
btnPdfWa.addEventListener('click', async () => {
  try {
    await ensureHtml2Pdf();
  } catch (e) {
    showAlert(e.message || 'html2pdf belum dimuat', false);
    return;
  }

  if (!lastData || !lastData.length) {
    showAlert('Tampilkan data dulu sebelum membuat PDF.', false);
    return;
  }

  // Kecilkan beban render: scale=1 + batasi lebar dengan CSS (#lap-wrap)
  const opt = {
    margin: 10,
    filename: `laporan-pelanggaran-${Date.now()}.pdf`,
    image: { type: 'jpeg', quality: 0.95 },
    html2canvas: {
      scale: 1,             // penting: jangan 2
      useCORS: true,
      allowTaint: true,
      letterRendering: true,
      // bantu html2canvas “tahu” lebar target:
      windowWidth: document.getElementById('lap-wrap').scrollWidth
    },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' }
  };

  const lapWrap = document.getElementById('lap-wrap');

  try {
    // Cara chaining yang benar di v0.10.x untuk ambil Blob
    const blob = await html2pdf()
      .set(opt)
      .from(lapWrap)
      .toPdf()
      .get('pdf')
      .then(pdf => pdf.output('blob'));

    // -> base64
    const buf = await blob.arrayBuffer();
    const base64 = btoa(String.fromCharCode(...new Uint8Array(buf)));

    // Upload ke API kamu (pastikan route sudah 200 OK dan balas JSON)
    const res = await fetch('/api/upload-report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename: opt.filename, base64 })
    });

    let json;
    try {
      json = await res.json();
    } catch {
      throw new Error('Upload gagal (balasan bukan JSON).');
    }
    if (!res.ok) throw new Error(json?.error || 'Upload gagal.');

    const url = json.publicUrl;
    showAlert('PDF berhasil dibuat & di-upload.', true);

    // Kirim ke WA (pakai ringkasan yang ada di subjudul)
    const ringkasan = (document.getElementById('lap-subtitle')?.textContent || '').trim();
    const text = encodeURIComponent(
      `Assalamu'alaikum. Berikut laporan pelanggaran santri (${ringkasan}). PDF: ${url}`
    );
    window.open(`https://wa.me/?text=${text}`, '_blank');

  } catch (err) {
    // Jika tetap kena error html2canvas (RangeError), kasih fallback simpan lokal
    console.error(err);
    showAlert(err.message || 'Gagal membuat/ mengunggah PDF', false);

    // Fallback opsional: buka dialog simpan PDF di browser
    // await html2pdf().set(opt).from(lapWrap).save();
  }
});


  async function ensureHtml2Pdf(){
  if (window.html2pdf) return;
  await new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
    s.onload = resolve;
    s.onerror = () => reject(new Error('Gagal load html2pdf'));
    document.head.appendChild(s);
  });
}


/* ================= init ================= */
;(async function init() {
  // preset dropdown pelanggaran (panel santri)
  fillViolationSelect(sanPelanggaranSel)

  // tanggal default panel santri
  sanTanggal.valueAsDate = new Date()

  // load kelas
  const classes = await loadClasses()

  // render rows untuk panel Input per Kelas (kelas pertama)
  if (selectKelas.value) {
    const students = await loadStudentsByClass(selectKelas.value)
    renderKelasRows(students)
  }
})()
