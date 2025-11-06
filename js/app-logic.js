// js/app-logic.js
import { supabase } from './supabaseClient.js'

/* ============= utils: alert ============= */
const alertBox = document.getElementById('alert')
function showAlert(message, ok = true) {
  alertBox.className = `mb-4 p-3 rounded border text-sm ${ok
    ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
    : 'border-rose-300 bg-rose-50 text-rose-700'}`
  alertBox.textContent = message
  alertBox.classList.remove('hidden')
}
function hideAlert(){ alertBox.classList.add('hidden') }

/* ============= tab switching ============= */
const tabKelas = document.getElementById('tab-kelas')
const tabSantri = document.getElementById('tab-santri')
const tabLaporan = document.getElementById('tab-laporan')
const panelKelas = document.getElementById('panel-kelas')
const panelSantri = document.getElementById('panel-santri')
const panelLaporan = document.getElementById('panel-laporan')

function switchTab(target){
  ;[tabKelas,tabSantri,tabLaporan].forEach(b=>b.classList.remove('border-b-2','border-blue-600','text-blue-600'))
  ;[panelKelas,panelSantri,panelLaporan].forEach(p=>p.classList.add('hidden'))
  target.button.classList.add('border-b-2','border-blue-600','text-blue-600')
  target.panel.classList.remove('hidden')
  hideAlert()
}
tabKelas.onclick   = () => switchTab({button:tabKelas, panel:panelKelas})
tabSantri.onclick  = () => switchTab({button:tabSantri, panel:panelSantri})
tabLaporan.onclick = () => switchTab({button:tabLaporan, panel:panelLaporan})

/* ============= DOM refs ============= */
const selectKelas  = document.getElementById('selectKelas')
const tbodyKelas   = document.getElementById('tbodyKelas')
const btnSimpan    = document.getElementById('btnSimpanKelas')

const lapKelas   = document.getElementById('lapKelas')
const lapSantri  = document.getElementById('lapSantri')
const lapBulan   = document.getElementById('lapBulan')
const lapTahun   = document.getElementById('lapTahun')
const btnTampil  = document.getElementById('btnTampilkan')
const tbodyLap   = document.getElementById('tbodyLaporan')

/* ============= data loaders ============= */
async function loadClasses() {
  const { data, error } = await supabase.from('classes').select('id, kelas').order('kelas')
  if (error) { showAlert(error.message, false); return }
  // dropdown “Input per Kelas”
  selectKelas.innerHTML = data.map(c => `<option value="${c.id}">${c.kelas}</option>`).join('')
  // dropdown “Laporan”
  lapKelas.innerHTML = data.map(c => `<option value="${c.id}">${c.kelas}</option>`).join('')
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

/* ============= renderers ============= */
function renderKelasRows(students) {
  const today = new Date().toISOString().slice(0,10)
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
      violation : tr.querySelector('input[name="violation"]').value.trim(),
      time      : tr.querySelector('input[name="time"]').value || null,
      date      : tr.querySelector('input[name="date"]').value || null,
      notes     : tr.querySelector('input[name="notes"]').value.trim() || null,
    })
  })
  return rows
}

/* ============= events: Input per Kelas ============= */
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
      class_id  : selectedClassId,   // <--- KUNCI: ikutkan class_id
      violation : r.violation,
      time_at   : r.time || null,
      date_at   : r.date || null,
      notes     : r.notes || null
    }))
  if (!payload.length) return showAlert('Tidak ada pelanggaran yang diisi.', false)

  const { error } = await supabase.from('violations').insert(payload)
  if (error) return showAlert(error.message, false)

  showAlert(`Berhasil simpan ${payload.length} data.`)
  // bersihkan isian pelanggaran/notes/jam (opsional)
  tbodyKelas.querySelectorAll('input[name="violation"], input[name="notes"]').forEach(i => i.value = '')
  tbodyKelas.querySelectorAll('input[name="time"]').forEach(i => i.value = '')
})

/* ============= events: Laporan ============= */
lapKelas.addEventListener('change', async () => {
  const classId = lapKelas.value
  const students = await loadStudentsByClass(classId)
  lapSantri.innerHTML = `<option value="">Semua Santri</option>` +
    students.map(s => `<option value="${s.id}">${s.name}</option>`).join('')
})

btnTampil.addEventListener('click', async () => {
  const classId   = lapKelas.value
  const studentId = lapSantri.value || null
  const bulan     = lapBulan.value
  const tahun     = lapTahun.value

  let q = supabase.from('v_violations_expanded').select('*')
  if (classId)   q = q.eq('class_id', classId)
  if (studentId) q = q.eq('student_id', studentId)
  if (bulan && tahun) {
    const start = `${tahun}-${bulan}-01`
    const end   = `${tahun}-${bulan}-31`
    q = q.gte('date_at', start).lte('date_at', end)
  }

  const { data, error } = await q.order('date_at', { ascending: false })
  if (error) return showAlert(error.message, false)

  const rows = data || []
  const html = rows.map((r, i) => `
    <tr>
      <td class="p-2 border">${i+1}</td>
      <td class="p-2 border">${r.student_name || ''}</td>
      <td class="p-2 border">${r.kelas || ''}</td>
      <td class="p-2 border">${r.violation || ''}</td>
      <td class="p-2 border">${r.date_at || ''}</td>
      <td class="p-2 border">${r.time_at || ''}</td>
      <td class="p-2 border">${r.notes || ''}</td>
    </tr>
  `).join('')
  document.getElementById('tbodyLaporan').innerHTML = html
  showAlert(`Menampilkan ${rows.length} data.`)
})

/* ============= init ============= */
;(async function init(){
  await loadClasses()
  // render pertama untuk tab Input per Kelas
  if (selectKelas.value) {
    const students = await loadStudentsByClass(selectKelas.value)
    renderKelasRows(students)
  }
  // default tahun laporan
  lapTahun.value = new Date().getFullYear()
})()
