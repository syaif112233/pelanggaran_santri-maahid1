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

// ====== Loading helpers ======
const _loadingEl   = document.getElementById('loading');
const _loadingT    = document.getElementById('loading-title');
const _loadingSub  = document.getElementById('loading-sub');

function showLoading(title = 'Memproses…', sub = 'Mohon tunggu sebentar') {
  if (_loadingEl) {
    if (_loadingT)   _loadingT.textContent  = title;
    if (_loadingSub) _loadingSub.textContent = sub;
    _loadingEl.classList.remove('hidden');
  }
}

function hideLoading() {
  _loadingEl?.classList.add('hidden');
}

// optional: cegah dobel klik
function setBusy(btn, busy = true) {
  if (!btn) return;
  btn.disabled = busy;
  btn.classList.toggle('opacity-50', busy);
  btn.classList.toggle('cursor-not-allowed', busy);
}


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
function todayStr(){ return new Date().toISOString().slice(0,10); }


// ===== REF ELEMEN (pakai fallback agar cocok dengan HTML lama/baru) =====
const tabKelas   = document.querySelector('#tab-kelas');
const tabSantri  = document.querySelector('#tab-santri');
const tabLap     = document.querySelector('#tab-laporan');

const panelKelas = document.querySelector('#panel-kelas');
const panelSantri= document.querySelector('#panel-santri');
const panelLap   = document.querySelector('#panel-laporan');

// Per-Kelas
const selKelasPerKelas = document.querySelector('#kelas-per-kelas') || document.querySelector('#selectKelas');
const tbodyPerKelas    = document.querySelector('#tbodyPerKelas')   || document.querySelector('#tbodyKelas');
const btnSimpanKelas   = document.querySelector('#btnSimpanKelas');

// Per-Santri
const selKelasPerSantri   = document.querySelector('#kelas-per-santri') || document.querySelector('#sanKelas');
const selSantri           = document.querySelector('#selectSantri')     || document.querySelector('#sanSantri');
const pelanggaranSantri   = document.querySelector('#pelanggaranSantri')|| document.querySelector('#sanViolSel');
const pelanggaranSantriLain = document.querySelector('#pelanggaranSantriLain') || document.querySelector('#sanViolCustom');
const jamSantri           = document.querySelector('#jamSantri')        || document.querySelector('#sanJam');
const tanggalSantri       = document.querySelector('#tanggalSantri')    || document.querySelector('#sanTanggal');
const notesSantri         = document.querySelector('#notesSantri')      || document.querySelector('#sanKet');
const btnSimpanSantri     = document.querySelector('#btnSimpanSantri')  || document.querySelector('#sanSimpan');

// Laporan / Tampilan & Cetak
const filterKelas  = document.querySelector('#filterKelas') || document.querySelector('#lapKelas');
const filterSantri = document.querySelector('#filterSantri')|| document.querySelector('#lapSantri');
const filterBulan  = document.querySelector('#filterBulan') || document.querySelector('#lapBulan');
const filterTahun  = document.querySelector('#filterTahun') || document.querySelector('#lapTahun');
const btnTampilkan = document.querySelector('#btnTampilkan');
const btnCetak     = document.querySelector('#btnCetak');
const btnPdfWa     = document.querySelector('#btnPdfWa');

const lapWrap     = document.querySelector('#lap-wrap');
const lapTitle    = document.querySelector('#lap-title');
const lapSubtitle = document.querySelector('#lap-subtitle');
const lapMeta     = document.querySelector('#lap-meta');
const tbodyLaporanView = document.querySelector('#tbodyLaporanView') || document.querySelector('#tbodyLaporan');


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
// setelah loadKelasSemua() atau di inisialisasi awal
if (filterTahun && !filterTahun.value) {
  filterTahun.value = String(new Date().getFullYear());
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
function setActiveTab(btn, active) {
  btn.classList.toggle('border-blue-600', active);
  btn.classList.toggle('text-blue-600', active);
  btn.classList.toggle('border-transparent', !active);
  btn.classList.toggle('text-gray-600', !active);
}

function showPanel(which) {
  panelKelas.classList.toggle('hidden', which !== 'kelas');
  panelSantri.classList.toggle('hidden', which !== 'santri');
  panelLap.classList.toggle('hidden', which !== 'lap');

  setActiveTab(tabKelas, which === 'kelas');
  setActiveTab(tabSantri, which === 'santri');
  setActiveTab(tabLap, which === 'lap');
}

tabKelas?.addEventListener('click', () => showPanel('kelas'));
tabSantri?.addEventListener('click', () => {
  showPanel('santri');
  if (tanggalSantri && !tanggalSantri.value)
    tanggalSantri.value = todayStr(); // default tanggal hari ini
});
tabLap?.addEventListener('click', async () => {
  showPanel('lap');
  try {
    await loadFilterKelas();
    await loadFilterSantriByClass(filterKelas?.value || '');
  } catch (e) {
    showAlert(e.message || 'Gagal menyiapkan filter laporan', false);
  }
});

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

// ===== Inisialisasi awal =====
if (tanggalSantri) tanggalSantri.value = todayStr();

try {
  showPanel?.('kelas');           // tampilkan tab "Input per Kelas" saat load
  await loadKelasSemua();         // <-- penting: isi semua dropdown kelas
} catch (e) {
  showAlert(e.message || 'Gagal memuat data awal', false);
}



// (lanjutan file kamu: fungsi render laporan, sort kolom, generate PDF & kirim WA, hapus data, dll)

/******************** UTIL TAMBAHAN (format) ********************/
const fmtTime = (t) => (t || '').toString().slice(0,5);           // "07:40:00" -> "07:40"
const fmtDate = (d) => (d || '').toString().slice(0,10);          // "2025-11-02T..." -> "2025-11-02"
const byId      = (id) => document.getElementById(id);

/******************** STATE LAPORAN ********************/
let lastLaporan = [];           // cache hasil query tampilkan
let lastClassMeta = null;       // cache info kelas terpilih (wali)

/******************** POPULATE FILTER LAPORAN ********************/
/******************** POPULATE FILTER LAPORAN ********************/
function updatePdfButtonsState() {
  const isAll = !filterKelas || filterKelas.value === ''; // "" = 'Semua Kelas'
  [btnPdfWa, btnCetak].forEach(btn => {
    if (!btn) return;
    btn.disabled = isAll;
    btn.classList.toggle('opacity-50', isAll);
    btn.classList.toggle('cursor-not-allowed', isAll);
  });
}

async function loadFilterKelas() {
  if (!filterKelas) return;

  // reset & tambah "Semua Kelas"
  filterKelas.innerHTML = '';
  filterKelas.add(new Option('Semua Kelas', ''));

  // ambil daftar kelas
  const { data, error } = await supabase
    .from('classes')
    .select('id, kelas, wali_name, wali_phone')
    .order('kelas', { ascending: true });

  if (error) throw error;

  // isi options kelas
  (data || []).forEach(r => {
    const o = new Option(r.kelas, r.id);
    o.dataset.wali_name  = r.wali_name  || '';
    o.dataset.wali_phone = r.wali_phone || '';
    filterKelas.add(o);
  });

  // setelah options terisi, sinkron meta & state tombol
  syncWaliFromFilter();
  updatePdfButtonsState();
}


async function loadFilterSantriByClass(classId) {
  if (!filterSantri) return;
  filterSantri.innerHTML = '';
  filterSantri.add(new Option('Semua Santri', ''));
  if (!classId) return;

  const { data, error } = await supabase
    .from('students')
    .select('id, name')
    .eq('class_id', classId)
    .order('name', { ascending: true });

  if (error) throw error;
  data.forEach(s => filterSantri.add(new Option(s.name, s.id)));
}

// simpan meta wali tiap kali kelas filter berubah (untuk WA)
function syncWaliFromFilter() {
  lastClassMeta = null;
  if (!filterKelas) return;
  const sel = filterKelas.options[filterKelas.selectedIndex];
  if (!sel) return;
  lastClassMeta = {
    wali_name : sel.dataset.wali_name || '',
    wali_phone: sel.dataset.wali_phone || '',
  };
}

// function monthToNumber(val) {
//   const v = String(val || '').trim().toLowerCase();
//   if (!v) return null;
//   const n = parseInt(v, 10);
//   if (!Number.isNaN(n) && n >= 1 && n <= 12) return n;

//   const map = {
//     'januari':1,'februari':2,'maret':3,'april':4,'mei':5,'juni':6,
//     'juli':7,'agustus':8,'september':9,'oktober':10,'november':11,'desember':12,
//     'january':1,'february':2,'march':3,'april':4,'may':5,'june':6,
//     'july':7,'august':8,'september':9,'october':10,'november':11,'december':12,
//     'semua': null, 'all': null
//   };
//   return map[v] ?? null;
// }
function monthToNumber(val) {
  const v = String(val || '').trim().toLowerCase();
  if (!v) return null;

  // dukung value gabungan seperti "10|Oktober"
  const first = v.split('|')[0];

  const n = parseInt(first, 10);
  if (!Number.isNaN(n) && n >= 1 && n <= 12) return n;

  const map = {
    'januari':1,'februari':2,'maret':3,'april':4,'mei':5,'juni':6,
    'juli':7,'agustus':8,'september':9,'oktober':10,'november':11,'desember':12,
    'january':1,'february':2,'march':3,'april':4,'may':5,'june':6,
    'july':7,'august':8,'september':9,'october':10,'november':11,'december':12,
    'semua': null, 'all': null
  };
  return map[first] ?? null;
}



/******************** QUERY & RENDER LAPORAN ********************/
//async function queryLaporan() {
//  const classId = filterKelas?.value || '';
//  const studentId = filterSantri?.value || '';
//  const bulan = (filterBulan?.value || '').padStart(2, '0');
//  const tahun = (filterTahun?.value || '').trim();

  // ambil dari view yang sudah kamu buat: v_violations_expanded
//  let q = supabase.from('v_violations_expanded')
  // pakai alias: ambil "kelas" tapi beri nama "class_name"
//  .select('id, student_id, student_name, class_id, kelas, violation, date_at, time_at, notes')
//  .order('date_at', { ascending: false })
//  .order('time_at', { ascending: false });


//  if (classId)   q = q.eq('class_id', classId);
//  if (studentId) q = q.eq('student_id', studentId);

  // filter bulan/tahun apabila diisi
//  if (tahun) {
//    q = q.filter('date_at', 'gte', `${tahun}-01-01`).filter('date_at', 'lte', `${tahun}-12-31`);
//  }
//  if (bulan && tahun) {
//    q = q.filter('date_at', 'gte', `${tahun}-${bulan}-01`)
//         .filter('date_at', 'lt',  `${tahun}-${bulan === '12' ? '13' : (('0'+(parseInt(bulan)+1)).slice(-2))}-01`);
//  }

//  const { data, error } = await q;
//  if (error) throw error;
// lastLaporan = data || [];
//}

// async function queryLaporan() {
//   const classId   = filterKelas?.value || '';
//   const studentId = filterSantri?.value || '';

//   const yearNum  = parseInt((filterTahun?.value || '').trim(), 10);
//   const bulanNum = monthToNumber(filterBulan?.value);

//   let q = supabase
//     .from('v_violations_expanded')
//     .select('id, student_id, student_name, class_id, kelas, violation, date_at, time_at, notes')
//     .order('date_at', { ascending: false })
//     .order('time_at', { ascending: false });

//   if (classId)   q = q.eq('class_id', classId);
//   if (studentId) q = q.eq('student_id', studentId);

//   // === Filter tanggal yang benar ===
//   if (bulanNum && !yearNum) {
//     // kalau user pilih bulan tapi tahun kosong → kasih info & hentikan
//     showAlert('Pilih Tahun terlebih dulu saat memfilter berdasarkan Bulan.', false);
//     const { data, error } = await q; // tanpa filter tanggal
//     if (error) throw error;
//     lastLaporan = data || [];
//     return;
//   }

//   if (yearNum && bulanNum) {
//     const mm   = String(bulanNum).padStart(2, '0');
//     const y2   = bulanNum === 12 ? yearNum + 1 : yearNum;
//     const mm2  = String(bulanNum === 12 ? 1 : bulanNum + 1).padStart(2, '0');
//     const start = `${yearNum}-${mm}-01`; // inklusif
//     const end   = `${y2}-${mm2}-01`;     // eksklusif
//     q = q.gte('date_at', start).lt('date_at', end);
//   } else if (yearNum) {
//     q = q.gte('date_at', `${yearNum}-01-01`).lte('date_at', `${yearNum}-12-31`);
//   }

//   const { data, error } = await q;
//   if (error) throw error;
//   lastLaporan = data || [];
// }

async function queryLaporan() {
  const classId   = filterKelas?.value || '';
  const studentId = filterSantri?.value || '';

  const yearNum  = parseInt((filterTahun?.value || '').trim(), 10);
  const bulanNum = monthToNumber(filterBulan?.value);

  let q = supabase
    .from('v_violations_expanded')
    .select('id, student_id, student_name, class_id, kelas, violation, date_at, time_at, notes')
    .order('date_at', { ascending: false })
    .order('time_at', { ascending: false });

  if (classId)   q = q.eq('class_id', classId);
  if (studentId) q = q.eq('student_id', studentId);

  // === Filter tanggal yang benar ===
  if (bulanNum && !yearNum) {
    showAlert('Pilih Tahun terlebih dulu saat memfilter berdasarkan Bulan.', false);
    const { data, error } = await q; // tanpa filter tanggal
    if (error) throw error;
    lastLaporan = data || [];
    return;
  }

  if (yearNum && bulanNum) {
    const mm   = String(bulanNum).padStart(2, '0');
    const y2   = bulanNum === 12 ? yearNum + 1 : yearNum;
    const mm2  = String(bulanNum === 12 ? 1 : bulanNum + 1).padStart(2, '0');
    const start = `${yearNum}-${mm}-01`;
    const end   = `${y2}-${mm2}-01`;

    **console.log('[FILTER BULAN]', { yearNum, bulanNum, start, end });**

    q = q.gte('date_at', start).lt('date_at', end);
  } else if (yearNum) {
    **console.log('[FILTER TAHUN]', { yearNum, span: 'full-year' });**
    q = q.gte('date_at', `${yearNum}-01-01`).lte('date_at', `${yearNum}-12-31`);
  }

  const { data, error } = await q;
  if (error) throw error;
  lastLaporan = data || [];
}




function renderLaporanTable() {
  const tbody = tbodyLaporanView || byId('tbodyLaporan') || byId('tbodyLaporanView');
  if (!tbody) return;

  tbody.innerHTML = '';
  lastLaporan.forEach((row, i) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="p-2 border text-center">${i+1}</td>
      <td class="p-2 border">${row.student_name || ''}</td>
      <td class="p-2 border">${row.kelas   || ''}</td>
      <td class="p-2 border">${row.violation    || ''}</td>
      <td class="p-2 border">${fmtDate(row.date_at) || ''}</td>
      <td class="p-2 border">${fmtTime(row.time_at) || ''}</td>
      <td class="p-2 border">${row.notes || ''}</td>
      <td class="p-2 border col-aksi">
        <button class="btn-hapus px-2 py-1 text-white bg-rose-600 rounded" data-id="${row.id}">Hapus</button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  // subtitle & meta (kalau ada elemennya)
  if (lapSubtitle) {
    const k = filterKelas?.selectedOptions?.[0]?.text || 'Semua Kelas';
    const s = filterSantri?.selectedOptions?.[0]?.text || 'Semua Santri';
    const b = (filterBulan?.selectedOptions?.[0]?.text || 'Semua');
    const t = filterTahun?.value || 'Semua Tahun';
    lapSubtitle.textContent = `Kelas: ${k} | Santri: ${s} | Periode: ${b} ${t}`;
  }
}

/******************** HAPUS DATA (delegasi 1 listener) ********************/
(document.querySelector('#tbodyLaporan') || document.querySelector('#tbodyLaporanView'))?.addEventListener('click', async (e) => {
  const btn = e.target.closest('.btn-hapus');
  if (!btn) return;
  const id = btn.dataset.id;
  if (!id) return;
  if (!confirm('Hapus data pelanggaran ini?')) return;

  const { error } = await supabase.from('violations').delete().eq('id', id);
  if (error) { showAlert(error.message || 'Gagal hapus', false); return; }

  showAlert('Data dihapus.', true);
  await queryLaporan();
  renderLaporanTable();
});

/******************** CETAK (print CSS sudah A4 landscape) ********************/
btnCetak?.addEventListener('click', () => {
  document.body.classList.add('pdf-mode');   // sembunyikan kolom aksi saat print
  window.print();
  setTimeout(() => document.body.classList.remove('pdf-mode'), 500);
});

/******************** PDF & KIRIM WA ********************/
function getLapContainerForPdf() {
  // pakai #lap-wrap kalau ada; kalau tidak, pakai table
  return lapWrap || document.querySelector('#lap-table');
}

console.log('html2pdf type:', typeof window.html2pdf);


async function ensureHtml2Pdf() {
  if (typeof window.html2pdf === 'function' || typeof window.html2pdf === 'object') return;
  throw new Error('html2pdf belum termuat');
}

async function generatePdfBlob(sourceEl, opt) {
  await ensureHtml2Pdf();
  if (!sourceEl) throw new Error('Elemen laporan tidak ditemukan.');

  document.body.classList.add('pdf-mode');

  const instance = html2pdf().set(opt).from(sourceEl).toPdf();
  const pdf = await instance.get('pdf');  // html2pdf v0.10.x → TANPA callback
  const blob = pdf.output('blob');

  document.body.classList.remove('pdf-mode');
  return blob;
}

//function arrayBufferToBase64(buffer) {
//  return btoa(String.fromCharCode(...new Uint8Array(buffer)));
//}

//async function uploadReport(filename, base64) {
// const res = await fetch('/api/upload-report', {
//    method: 'POST',
//    headers: { 'Content-Type': 'application/json' },
//    body: JSON.stringify({ filename, base64 })
//  });
//  const json = await res.json();
//  if (!res.ok) throw new Error(json?.error || 'Upload gagal');
//  return json.publicUrl;
//}

// GANTI fungsi upload lama (yang fetch ke /api) dengan ini
async function uploadReportDirect(blob, filename) {
  const folder = new Date().getFullYear().toString();
  const path = `${folder}/${Date.now()}_${filename}`;

  const { error: upErr } = await supabase
    .storage
    .from('reports')
    .upload(path, blob, { contentType: 'application/pdf', upsert: true });

  if (upErr) throw upErr;

  const { data: pub } = supabase
    .storage
    .from('reports')
    .getPublicUrl(path);

  return pub.publicUrl; // <- ini yang dipakai buat WA
}


function openWaWithReport(publicUrl) {
  // Ambil meta wali dari filter (kamu sudah punya syncWaliFromFilter)
  syncWaliFromFilter();
  const phone = normalizePhone(lastClassMeta?.wali_phone || '');
  const waliName = lastClassMeta?.wali_name ? `Bapak/Ibu ${lastClassMeta.wali_name}` : 'Wali Kelas';
  const ringkasan =
    lapSubtitle?.textContent?.trim() ||
    `Kelas: ${filterKelas?.selectedOptions?.[0]?.text || 'Semua Kelas'} | Periode: ${(filterBulan?.selectedOptions?.[0]?.text || 'Semua')} ${(filterTahun?.value || '')}`;

  const text = encodeURIComponent(
    `Assalamu'alaikum ${waliName}. Berikut laporan pelanggaran santri (${ringkasan}).\nPDF: ${publicUrl}`
  );

  const waUrl = phone
    ? `https://api.whatsapp.com/send?phone=${phone}&text=${text}`
    : `https://api.whatsapp.com/send?text=${text}`;

  window.open(waUrl, '_blank');
}


function blobToBase64(blob){
  return new Promise((resolve, reject)=>{
    const reader = new FileReader();
    reader.onload = () => {
      const res = reader.result || '';
      // hasil dataURL: "data:application/pdf;base64,XXXXX"
      const base64 = String(res).split(',')[1] || '';
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}


btnPdfWa?.addEventListener('click', async () => {
  setBusy(btnPdfWa, true);
  showLoading('Menyiapkan PDF', 'Merender tabel laporan…');

  try {
    if (!filterKelas?.value) {
  hideLoading(); setBusy(btnPdfWa, false);
  return showAlert('Pilih kelas tertentu dulu (bukan "Semua Kelas") sebelum membuat & mengirim PDF.', false);
}

    if (!lastLaporan.length) {
      hideLoading(); setBusy(btnPdfWa,false);
      return showAlert('Tampilkan data dulu sebelum membuat PDF.', false);
    }

    const sourceEl = getLapContainerForPdf();
    const opt = {
      margin: 10,
      filename: `laporan-pelanggaran-${Date.now()}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' }
    };

    // 1) render pdf -> blob
    const blob = await generatePdfBlob(sourceEl, opt);

    // 2) upload
    showLoading('Mengunggah laporan', 'Mengirim file ke server…');
    
    // SEBELUM:
    // const base64 = await blobToBase64(blob);
    // const publicUrl = await uploadReport(opt.filename, base64);
    
    // SESUDAH:
    const publicUrl = await uploadReportDirect(blob, opt.filename);


    // 3) buka WA
    showLoading('Membuka WhatsApp', 'Menyiapkan pesan…');
    openWaWithReport(publicUrl);

  } catch (e) {
    showAlert(e.message || 'Gagal membuat/mengunggah PDF', false);
  } finally {
    hideLoading();
    setBusy(btnPdfWa, false);
  }
});




/******************** TAMPILKAN (klik) ********************/
btnTampilkan?.addEventListener('click', async () => {
  try {
    syncWaliFromFilter();
    await queryLaporan();
    renderLaporanTable();
    showAlert(`Menampilkan ${lastLaporan.length} data.`, true);
  } catch (e) {
    showAlert(e.message || 'Gagal menampilkan data', false);
  }
});

/******************** REAKSI PERUBAHAN KELAS (isi dropdown santri) ********************/
filterKelas?.addEventListener('change', async () => {
  syncWaliFromFilter();
  updatePdfButtonsState();
  await loadFilterSantriByClass(filterKelas.value || '');
});

/******************** INIT PANEL LAPORAN SAAT TAB DIBUKA ********************/
tabLap?.addEventListener('click', async () => {
  showPanel?.('lap');
  try {
    await loadFilterKelas();
    updatePdfButtonsState();
    await loadFilterSantriByClass(filterKelas?.value || '');
  } catch (e) {
    showAlert(e.message || 'Gagal menyiapkan filter laporan', false);
  }
});

filterBulan?.addEventListener('change', async () => {
  await queryLaporan();
  renderLaporanTable();
});

filterTahun?.addEventListener('change', async () => {
  await queryLaporan();
  renderLaporanTable();
});


