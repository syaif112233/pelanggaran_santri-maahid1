// ======================= BOOTSTRAP SUPABASE (WAJIB DI PALING ATAS) =======================
async function getSupabase() {
  // supabase akan diset di window oleh supabaseClient.js
  if (window.supabase) return window.supabase;

  await new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('Supabase client belum siap')), 3000);
    window.addEventListener('supabase-ready', () => { clearTimeout(t); resolve(); }, { once: true });
  });
  return window.supabase;
}
const supabase = await getSupabase();

// ======================= UTIL DOM RINGKAS =======================
const $  = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));

function showAlert(msg, ok=true) {
  const box = $('#alert');
  if (!box) return;
  box.textContent = msg;
  box.classList.remove('hidden');
  box.classList.toggle('border-green-300', ok);
  box.classList.toggle('bg-green-50', ok);
  box.classList.toggle('text-green-800', ok);
  box.classList.toggle('border-red-300', !ok);
  box.classList.toggle('bg-red-50', !ok);
  box.classList.toggle('text-red-800', !ok);
  setTimeout(()=>box.classList.add('hidden'), 3000);
}

// ======================= REF ELEMEN SESUAI HTML BARU =======================
// Tabs
const tabKelas   = $('#tab-kelas');
const tabSantri  = $('#tab-santri');
const tabLap     = $('#tab-laporan');

const panelKelas = $('#panel-kelas');
const panelSantri= $('#panel-santri');
const panelLap   = $('#panel-laporan');

// Per-Kelas
const selKelasPerKelas = $('#kelas-per-kelas');
const tbodyPerKelas    = $('#tbodyPerKelas');
const btnSimpanKelas   = $('#btnSimpanKelas');

// Per-Santri
const selKelasPerSantri  = $('#kelas-per-santri');
const selSantri          = $('#selectSantri');
const pelanggaranSantri  = $('#pelanggaranSantri');
const pelanggaranSantriLain = $('#pelanggaranSantriLain');
const jamSantri          = $('#jamSantri');
const tanggalSantri      = $('#tanggalSantri');
const notesSantri        = $('#notesSantri');
const btnSimpanSantri    = $('#btnSimpanSantri');

// Laporan (filter + tabel tampilan)
const filterKelas   = $('#filterKelas');
const filterSantri  = $('#filterSantri');
const filterBulan   = $('#filterBulan');
const filterTahun   = $('#filterTahun');
const btnTampilkan  = $('#btnTampilkan');
const btnCetak      = $('#btnCetak');
const btnPdfWa      = $('#btnPdfWa');

const lapWrap       = $('#lap-wrap');
const lapTitle      = $('#lap-title');
const lapSubtitle   = $('#lap-subtitle');
const lapMeta       = $('#lap-meta');
const tbodyLaporanView = $('#tbodyLaporanView');

// ======================= DATA & HELPER =======================
let kelasList = [];       // [{id, kelas, wali_name, wali_phone}, ...]
let santriMap = new Map(); // class_id -> [{id, name}, ...]
let lastFilter = { kelas_id: null, student_id: '', bulan: '', tahun: '' };
let lastData = [];        // data laporan terakhir (untuk PDF)

// normalisasi nomor WA (62..)
function normalizePhone(p){
  if(!p) return '';
  let s = String(p).replace(/[^\d]/g,'');
  if (s.startsWith('0')) s = '62' + s.slice(1);
  if (!s.startsWith('62')) s = '62' + s;
  return s;
}

// ======================= LOAD KELAS & SANTRI =======================
async function loadKelasSemua() {
  const { data, error } = await supabase.from('classes').select('id, kelas, wali_name, wali_phone').order('kelas');
  if (error) throw error;
  kelasList = data || [];

  // Isi dropdown: per-kelas
  selKelasPerKelas.innerHTML = kelasList.map(k=>`<option value="${k.id}">${k.kelas}</option>`).join('');

  // Isi dropdown: per-santri
  selKelasPerSantri.innerHTML = kelasList.map(k=>`<option value="${k.id}">${k.kelas}</option>`).join('');

  // Isi dropdown: filter laporan (dengan "Semua Kelas")
  filterKelas.innerHTML = `<option value="">Semua Kelas</option>` +
    kelasList.map(k=>`<option value="${k.id}">${k.kelas}</option>`).join('');

  // Trigger awal
  if (selKelasPerKelas.value) await renderPerKelas(selKelasPerKelas.value);
  if (selKelasPerSantri.value) await loadSantriByClass(selKelasPerSantri.value);
}

async function loadSantriByClass(class_id){
  if (!class_id) {
    selSantri.innerHTML = '<option value="">-- Pilih santri --</option>';
    santriMap.set(class_id, []);
    return;
  }
  if (santriMap.has(class_id)) {
    // pakai cache
    const arr = santriMap.get(class_id);
    selSantri.innerHTML = '<option value="">-- Pilih santri --</option>' +
      arr.map(s=>`<option value="${s.id}">${s.name}</option>`).join('');
    return;
  }
  const { data, error } = await supabase.from('students')
    .select('id, name')
    .eq('class_id', class_id)
    .order('name');
  if (error) throw error;
  santriMap.set(class_id, data || []);
  selSantri.innerHTML = '<option value="">-- Pilih santri --</option>' +
    (data||[]).map(s=>`<option value="${s.id}">${s.name}</option>`).join('');
}

// ======================= RENDER PER-KELAS (TABLE INPUT) =======================
async function renderPerKelas(class_id){
  tbodyPerKelas.innerHTML = '';
  if (!class_id) return;
  // ambil santri kelas tsb
  const { data, error } = await supabase.from('students')
    .select('id, name')
    .eq('class_id', class_id)
    .order('name');
  if (error) { showAlert(error.message, false); return; }

  // template baris input
  const violOpts = `
    <option value="">-- pilih --</option>
    <option value="Terlambat">Terlambat</option>
    <option value="Atribut tidak lengkap">Atribut tidak lengkap</option>
    <option value="Tidak mengikuti pelajaran">Tidak mengikuti pelajaran</option>
    <option value="Terlambat mengikuti pelajaran">Terlambat mengikuti pelajaran</option>
    <option value="__LAINNYA__">Lainnya…</option>
  `;

  const today = new Date().toISOString().slice(0,10);
  const rows = (data||[]).map(s => `
    <tr data-student="${s.id}">
      <td class="p-2 border">${s.name}</td>
      <td class="p-2 border">
        <div class="flex gap-2">
          <select class="violSel w-1/2 border rounded px-2 py-1">${violOpts}</select>
          <input class="violCustom w-1/2 border rounded px-2 py-1 hidden-input" placeholder="Isi bila 'Lainnya'">
        </div>
      </td>
      <td class="p-2 border"><input type="time" class="jam w-full border rounded px-2 py-1" /></td>
      <td class="p-2 border"><input type="date" value="${today}" class="tgl w-full border rounded px-2 py-1" /></td>
      <td class="p-2 border"><input type="text" class="ket w-full border rounded px-2 py-1" /></td>
    </tr>
  `).join('');
  tbodyPerKelas.innerHTML = rows;

  // toggle input lainnya
  $$('.violSel', tbodyPerKelas).forEach(sel => {
    sel.addEventListener('change', e => {
      const wrap = e.target.closest('td');
      const input = $('.violCustom', wrap);
      input.classList.toggle('hidden-input', e.target.value !== '__LAINNYA__');
      if (e.target.value !== '__LAINNYA__') input.value = '';
    });
  });
}

// ======================= TAB SWITCHING =======================
function showPanel(which){
  panelKelas.classList.toggle('hidden', which!=='kelas');
  panelSantri.classList.toggle('hidden', which!=='santri');
  panelLap.classList.toggle('hidden', which!=='lap');

  tabKelas.classList.toggle('border-blue-600', which==='kelas');
  tabKelas.classList.toggle('text-blue-600', which==='kelas');
  tabSantri.classList.toggle('border-blue-600', which==='santri');
  tabSantri.classList.toggle('text-blue-600', which==='santri');
  tabLap.classList.toggle('border-blue-600', which==='lap');
  tabLap.classList.toggle('text-blue-600', which==='lap');
}

tabKelas?.addEventListener('click', ()=>showPanel('kelas'));
tabSantri?.addEventListener('click', ()=>showPanel('santri'));
tabLap?.addEventListener('click',   ()=>showPanel('lap'));

// ======================= EVENT LISTENERS UTAMA =======================
// Per-kelas
selKelasPerKelas?.addEventListener('change', e => renderPerKelas(e.target.value));
btnSimpanKelas?.addEventListener('click', async () => {
  const class_id = selKelasPerKelas.value;
  if (!class_id) return showAlert('Pilih kelas terlebih dulu', false);

  const rows = $$('tr[data-student]', tbodyPerKelas);
  const payload = [];
  rows.forEach(tr => {
    const student_id = tr.getAttribute('data-student');
    const violSel = $('.violSel', tr);
    const violIn  = $('.violCustom', tr);
    const jam = $('.jam', tr).value || null;
    const tgl = $('.tgl', tr).value || null;
    const ket = $('.ket', tr).value || '';

    let violation = violSel.value;
    if (violation === '__LAINNYA__') violation = violIn.value.trim();

    if (violation && tgl) {
      payload.push({
        student_id,
        class_id,
        violation,
        time_at: jam,
        date_at: tgl,
        notes: ket
      });
    }
  });

  if (!payload.length) return showAlert('Tidak ada data yang diisi.', false);

  const { error } = await supabase.from('violations').insert(payload);
  if (error) return showAlert(error.message, false);
  showAlert('Berhasil menyimpan pelanggaran.', true);
});

// Per-santri: isi dropdown santri saat kelas berubah
selKelasPerSantri?.addEventListener('change', e => loadSantriByClass(e.target.value));

// Per-santri: toggle "Lainnya"
pelanggaranSantri?.addEventListener('change', e=>{
  pelanggaranSantriLain.classList.toggle('hidden-input', e.target.value !== '__LAINNYA__');
  if (e.target.value !== '__LAINNYA__') pelanggaranSantriLain.value = '';
});

// Simpan per-santri
btnSimpanSantri?.addEventListener('click', async ()=>{
  const class_id   = selKelasPerSantri.value;
  const student_id = selSantri.value;
  if (!class_id || !student_id) return showAlert('Pilih kelas & santri dulu.', false);

  let violation = pelanggaranSantri.value;
  if (violation === '__LAINNYA__') violation = (pelanggaranSantriLain.value||'').trim();
  const time_at   = jamSantri.value || null;
  const date_at   = tanggalSantri.value || null;
  const notes     = notesSantri.value || '';

  if (!violation || !date_at) return showAlert('Pelanggaran & tanggal wajib diisi.', false);

  const { error } = await supabase.from('violations').insert([{
    student_id, class_id, violation, time_at, date_at, notes
  }]);
  if (error) return showAlert(error.message, false);
  showAlert('Berhasil menyimpan.', true);
});

// ===== END: bootstrap awal =====

// (lanjutan file kamu: fungsi render laporan, sort kolom, generate PDF & kirim WA, hapus data, dll)
