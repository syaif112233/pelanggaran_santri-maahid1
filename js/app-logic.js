/* js/app-logic.js
   Versi full – laporan + input + kirim WA
   Menggunakan window.supabase dari js/supabaseClient.js
*/
// paling atas app-logic.js (sebelum kode lain)
const supabase = window.supabase;


/////////////////////// UTIL ///////////////////////
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

function showAlert(msg, ok = true) {
  // tampilkan notifikasi sederhana di atas (opsional ganti sesuai punyamu)
  const box = document.createElement('div');
  box.textContent = msg;
  box.className = `mx-auto my-3 max-w-4xl rounded border px-4 py-2 text-sm ${
    ok ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'
  }`;
  document.body.prepend(box);
  setTimeout(() => box.remove(), 3500);
}

function pad2(n) { return n.toString().padStart(2, '0'); }

function normalizePhone(idn) {
  if (!idn) return '';
  let s = String(idn).replace(/[^\d]/g, '');
  if (s.startsWith('0')) s = '62' + s.slice(1);
  if (!s.startsWith('62')) s = '62' + s;
  return s;
}

// untuk desktop WA kadang lebih stabil pakai api.whatsapp.com
function openWhatsApp(phone, text) {
  const p = normalizePhone(phone);
  const t = encodeURIComponent(text);
  const url = `https://api.whatsapp.com/send?phone=${p}&text=${t}`;
  window.open(url, '_blank');
}

/////////////////////// ELEMEN GLOBAL (TAB TAMPIL & CETAK) ///////////////////////
const selectKelas   = $('#selectKelas');
const selectSantri  = $('#selectSantri');     // opsional
const selectBulan   = $('#selectBulan');      // "Semua" / 1..12 (value numerik string)
const inputTahun    = $('#inputTahun');
const btnTampilkan  = $('#btnTampilkan');
const btnCetak      = $('#btnCetak');
const btnPdfWa      = $('#btnPdfWa');

const lapWrap       = $('#lap-wrap');     // wrapper yang diprint/pdf
const lapTable      = $('#lap-table');
const lapTitle      = $('#lap-title');
const lapSubtitle   = $('#lap-subtitle');
const lapMeta       = $('#lap-meta');
const tbodyLaporan  = $('#tbodyLaporan');

// simpan data terakhir untuk PDF/WA
let lastData = [];
let lastClassMeta = null; // { kelas: '10 A', wali_phone: '...', wali_name: '...' }

/////////////////////// HTML2PDF LOADER ///////////////////////
async function ensureHtml2Pdf() {
  if (window.html2pdf) return;
  // loader aman
  await new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
    s.defer = true;
    s.onload = resolve;
    s.onerror = () => reject(new Error('html2pdf gagal dimuat'));
    document.head.appendChild(s);
  });
}

/////////////////////// LOAD KELAS & SANTRI ///////////////////////
async function loadClasses() {
  const { data, error } = await supabase.from('classes')
    .select('id, kelas, wali_phone, wali_name')
    .order('kelas');
  if (error) { showAlert(error.message, false); return; }

  // DropDown Tampil & Cetak
  selectKelas.innerHTML = [
    `<option value="">Semua Kelas</option>`,
    ...data.map(c => `<option value="${c.id}">${c.kelas}</option>`)
  ].join('');

  // simpan map class_id -> meta, untuk WA
  classMap = {};
  data.forEach(c => { classMap[c.id] = c; });
}
let classMap = {};

async function loadStudentsByClass(classId) {
  if (!classId) {
    selectSantri.innerHTML = `<option value="">Semua Santri</option>`;
    return;
  }
  const { data, error } = await supabase.from('students')
    .select('id, name')
    .eq('class_id', classId)
    .order('name');
  if (error) { showAlert(error.message, false); return; }

  selectSantri.innerHTML = [
    `<option value="">Semua Santri</option>`,
    ...data.map(s => `<option value="${s.id}">${s.name}</option>`)
  ].join('');
}

selectKelas?.addEventListener('change', async () => {
  await loadStudentsByClass(selectKelas.value);
});

/////////////////////// TAMPILKAN DATA ///////////////////////
async function tampilkanLaporan() {
  const classId = selectKelas.value || '';
  const studentId = selectSantri.value || '';
  const bulan = selectBulan.value || 'Semua';
  const tahun = inputTahun.value ? parseInt(inputTahun.value, 10) : (new Date()).getFullYear();

  // judul & sub
  lapTitle.textContent = 'Laporan Pelanggaran Santri';
  const kelasName = classId ? (classMap[classId]?.kelas || '-') : 'Semua';
  const santriLabel = studentId ? selectSantri.options[selectSantri.selectedIndex].text : 'Semua';
  const periodeLabel = (bulan === 'Semua') ? 'Semua Bulan' : new Date(2000, parseInt(bulan,10)-1, 1).toLocaleString('id-ID', { month: 'long' });
  lapSubtitle.textContent = `Kelas: ${kelasName} | Santri: ${santriLabel} | Periode: ${periodeLabel} ${tahun}`;
  lapMeta.textContent = '';

  // query view v_violations_expanded
  let query = supabase.from('v_violations_expanded')
    .select(`
      id,
      student_id,
      student_name,
      class_id,
      class_name,
      violation,
      date_at,
      time_at,
      notes
    `)
    .order('date_at', { ascending: true })
    .order('time_at', { ascending: true });

  if (classId) query = query.eq('class_id', classId);
  if (studentId) query = query.eq('student_id', studentId);

  // filter bulan/tahun
  if (bulan !== 'Semua') {
    // buat rentang awal-akhir bulan
    const m = parseInt(bulan, 10) - 1;
    const start = new Date(tahun, m, 1);
    const end = new Date(tahun, m + 1, 1);
    query = query.gte('date_at', start.toISOString().slice(0,10))
                 .lt('date_at', end.toISOString().slice(0,10));
  } else {
    const startY = `${tahun}-01-01`, endY = `${tahun+1}-01-01`;
    query = query.gte('date_at', startY).lt('date_at', endY);
  }

  const { data, error } = await query;
  if (error) { showAlert(error.message, false); return; }

  lastData = data || [];
  lastClassMeta = classId ? (classMap[classId] || null) : null;

  // render tabel
  tbodyLaporan.innerHTML = lastData.map((row, idx) => {
    const jam = row.time_at ? row.time_at.slice(0,8) : '';
    const tgl = row.date_at || '';
    return `
      <tr>
        <td class="p-2 border text-center">${idx+1}</td>
        <td class="p-2 border">${row.student_name || ''}</td>
        <td class="p-2 border">${row.class_name || ''}</td>
        <td class="p-2 border">${row.violation || ''}</td>
        <td class="p-2 border text-nowrap">${tgl}</td>
        <td class="p-2 border text-nowrap">${jam}</td>
        <td class="p-2 border">${row.notes || ''}</td>
        <td class="p-2 border col-aksi" data-col="aksi">
          <button class="btn-hapus" data-id="${row.id}">Hapus</button>
        </td>
      </tr>
    `;
  }).join('');

  showAlert(`Menampilkan ${lastData.length} data.`, true);
}
btnTampilkan?.addEventListener('click', tampilkanLaporan);
btnCetak?.addEventListener('click', () => window.print());

/////////////////////// HAPUS DATA ///////////////////////
tbodyLaporan?.addEventListener('click', async (e) => {
  const btn = e.target.closest('.btn-hapus');
  if (!btn) return;
  const id = btn.getAttribute('data-id');
  if (!id) return;

  if (!confirm('Yakin hapus pelanggaran ini?')) return;

  const { error } = await supabase.from('violations').delete().eq('id', id);
  if (error) { showAlert(error.message, false); return; }

  // refresh tampilan
  await tampilkanLaporan();
  showAlert('Data telah dihapus.', true);
});

/////////////////////// BUAT PDF & KIRIM WA ///////////////////////
btnPdfWa?.addEventListener('click', async () => {
  try { await ensureHtml2Pdf(); }
  catch (e) { showAlert(e.message || 'html2pdf belum dimuat', false); return; }

  if (!lastData.length) {
    showAlert('Tampilkan data dulu sebelum membuat PDF.', false);
    return;
  }

  // Sembunyikan kolom Aksi saat render PDF
  const aksiTh = lapTable.querySelector('th.col-aksi, #col-aksi');
  const aksiTds = $$('#lap-table td.col-aksi,[data-col="aksi"]');
  const oldDisplayTh = aksiTh ? aksiTh.style.display : null;
  const oldDisplaysTd = aksiTds.map(td => td.style.display);

  if (aksiTh) aksiTh.style.display = 'none';
  aksiTds.forEach(td => td.style.display = 'none');

  // Set judul/subtitle (jaga-jaga)
  if (!lapTitle?.textContent?.trim()) lapTitle.textContent = 'Laporan Pelanggaran Santri';
  if (!lapSubtitle?.textContent?.trim()) lapSubtitle.textContent = '';

  const opt = {
    margin: 10,
    filename: `laporan-pelanggaran-${Date.now()}.pdf`,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2 },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' }
  };

  try {
    // cara benar ambil Blob di v0.10.x (hindari RangeError: too many function arguments)
    const blob = await html2pdf()
      .set(opt)
      .from(lapWrap)
      .toPdf()
      .get('pdf')
      .then(pdf => pdf.output('blob'));

    // kembalikan kolom Aksi setelah render
    if (aksiTh) aksiTh.style.display = oldDisplayTh ?? '';
    aksiTds.forEach((td, i) => td.style.display = oldDisplaysTd[i] ?? '');

    // upload ke API serverless → dapet publicUrl
    let url = '';
    const base64 = await blobToBase64(blob);
    const res = await fetch('/api/upload-report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename: opt.filename, base64 })
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json?.error || 'Upload gagal');
    url = json.publicUrl;

    showAlert('PDF berhasil dibuat.', true);

    // rangkai pesan WA
    const ringkasan = lapSubtitle?.textContent?.trim() || '';
    let waTarget = '';
    let waliName = '';
    if (lastClassMeta?.wali_phone) {
      waTarget = normalizePhone(lastClassMeta.wali_phone);
      waliName = lastClassMeta.wali_name || '';
    }

    const text = [
      `Assalamu'alaikum`,
      waliName ? `${waliName},` : '',
      `Berikut laporan pelanggaran santri (${ringkasan}).`,
      `PDF: ${url}`
    ].filter(Boolean).join(' ');

    openWhatsApp(waTarget || '', text);
  } catch (e) {
    // kembalikan kolom Aksi jika belum
    if (aksiTh) aksiTh.style.display = oldDisplayTh ?? '';
    aksiTds.forEach((td, i) => td.style.display = oldDisplaysTd[i] ?? '');
    showAlert(e.message || 'Gagal membuat/mengunggah PDF', false);
  }
});

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => {
      const b64 = fr.result.split(',')[1];
      resolve(b64);
    };
    fr.onerror = reject;
    fr.readAsDataURL(blob);
  });
}

/////////////////////// INPUT – PILIHAN PELANGGARAN ///////////////////////
// Opsi global
const VIOLATION_OPTIONS = [
  'Terlambat',
  'Atribut tidak lengkap',
  'Tidak mengikuti pelajaran',
  'Terlambat mengikuti pelajaran',
  'Tidak memakai sepatu saat KBM',
  'Lainnya'
];

// helper: buat <select> pelanggaran + input lainnya (auto show)
function buildViolationSelect(nameForInput, placeholder = "isi jika memilih 'Lainnya'") {
  const wrap = document.createElement('div');
  wrap.className = 'flex gap-2 items-center';

  const sel = document.createElement('select');
  sel.className = 'border rounded px-2 py-1 w-full';
  sel.innerHTML = [
    `<option value="">-- pilih --</option>`,
    ...VIOLATION_OPTIONS.map(v => `<option value="${v}">${v}</option>`)
  ].join('');

  const txt = document.createElement('input');
  txt.type = 'text';
  txt.placeholder = placeholder;
  txt.className = 'border rounded px-2 py-1 flex-1';
  txt.style.display = 'none';

  sel.addEventListener('change', () => {
    if (sel.value === 'Lainnya') {
      txt.style.display = '';
      txt.focus();
    } else {
      txt.style.display = 'none';
      txt.value = '';
    }
  });

  wrap.appendChild(sel);
  wrap.appendChild(txt);
  return { wrap, select: sel, input: txt };
}

/* ====== INPUT PER KELAS (KOLEKTIF) ======
   Ekspektasi HTML:
   - #kelasKolektif (select), #tbodyKolektif (tempat baris nama santri)
   - tombol simpan kolektif: #btnSimpanKolektif
*/
const kelasKolektif = $('#kelasKolektif');
const tbodyKolektif = $('#tbodyKolektif');
const btnSimpanKolektif = $('#btnSimpanKolektif');

async function loadKolektifRows() {
  if (!kelasKolektif) return;
  const cid = kelasKolektif.value;
  tbodyKolektif.innerHTML = '';
  if (!cid) return;

  const { data, error } = await supabase.from('students')
    .select('id, name')
    .eq('class_id', cid).order('name');
  if (error) { showAlert(error.message, false); return; }

  tbodyKolektif.innerHTML = data.map(s => {
    return `
      <tr data-student="${s.id}">
        <td class="p-2 border">${s.name}</td>
        <td class="p-2 border v-slot"></td>
        <td class="p-2 border"><input type="time" class="inp-jam border rounded px-2 py-1 w-full" value="07:00"></td>
        <td class="p-2 border"><input type="date" class="inp-tgl border rounded px-2 py-1 w-full" value="${new Date().toISOString().slice(0,10)}"></td>
        <td class="p-2 border"><input type="text" class="inp-notes border rounded px-2 py-1 w-full" placeholder="Keterangan"></td>
      </tr>
    `;
  }).join('');

  // sisipkan dropdown pelanggaran + input lainnya
  $$('#tbodyKolektif .v-slot').forEach(cell => {
    const { wrap } = buildViolationSelect('pelanggaran');
    cell.appendChild(wrap);
  });
}

kelasKolektif?.addEventListener('change', loadKolektifRows);

btnSimpanKolektif?.addEventListener('click', async () => {
  const cid = kelasKolektif.value;
  if (!cid) { showAlert('Pilih kelas dulu.', false); return; }

  const rows = $$('#tbodyKolektif tr');
  const payload = [];

  rows.forEach(tr => {
    const student_id = tr.getAttribute('data-student');
    const sel = tr.querySelector('select');
    const txt = tr.querySelector('input[type="text"].border');
    const jam = tr.querySelector('.inp-jam')?.value || '07:00';
    const tgl = tr.querySelector('.inp-tgl')?.value || new Date().toISOString().slice(0,10);
    const notes = tr.querySelector('.inp-notes')?.value || '';

    let violation = sel?.value || '';
    if (violation === 'Lainnya') violation = txt?.value?.trim() || '';

    if (violation) {
      payload.push({
        class_id: cid,
        student_id,
        violation,
        time_at: jam,
        date_at: tgl,
        notes
      });
    }
  });

  if (!payload.length) { showAlert('Tidak ada baris yang diisi.', false); return; }

  const { error } = await supabase.from('violations').insert(payload);
  if (error) { showAlert(error.message, false); return; }

  showAlert('Pelanggaran tersimpan.', true);
  // opsional refresh tab tampil
});

/* ====== INPUT PER SANTRI (TUNGGAL) ======
   Ekspektasi HTML:
   - #kelasTunggal (select), #santriTunggal (select)
   - #violationWrapTunggal (div kosong untuk inject select+input)
   - #jamTunggal (input time), #tglTunggal (input date), #notesTunggal (input text)
   - #btnSimpanTunggal
*/
const kelasTunggal = $('#kelasTunggal');
const santriTunggal = $('#santriTunggal');
const violationWrapTunggal = $('#violationWrapTunggal');
const jamTunggal = $('#jamTunggal');
const tglTunggal = $('#tglTunggal');
const notesTunggal = $('#notesTunggal');
const btnSimpanTunggal = $('#btnSimpanTunggal');

let vSelTunggal = null;

kelasTunggal?.addEventListener('change', async () => {
  const cid = kelasTunggal.value;
  if (!cid) {
    santriTunggal.innerHTML = `<option value="">-- Pilih santri --</option>`;
    return;
  }
  const { data, error } = await supabase.from('students').select('id,name').eq('class_id', cid).order('name');
  if (error) { showAlert(error.message, false); return; }
  santriTunggal.innerHTML = [
    `<option value="">-- Pilih santri --</option>`,
    ...data.map(s => `<option value="${s.id}">${s.name}</option>`)
  ].join('');
});

// inject dropdown + input lainnya
if (violationWrapTunggal) {
  const comp = buildViolationSelect('pelanggaran_tunggal');
  violationWrapTunggal.appendChild(comp.wrap);
  vSelTunggal = comp;
}

btnSimpanTunggal?.addEventListener('click', async () => {
  const cid = kelasTunggal.value;
  const sid = santriTunggal.value;
  if (!cid || !sid) { showAlert('Pilih kelas & santri dulu.', false); return; }

  let violation = vSelTunggal?.select.value || '';
  if (violation === 'Lainnya') {
    violation = vSelTunggal?.input.value?.trim() || '';
  }
  const time_at = jamTunggal?.value || '07:00';
  const date_at = tglTunggal?.value || new Date().toISOString().slice(0,10);
  const notes = notesTunggal?.value || '';

  if (!violation) { showAlert('Pelanggaran belum diisi.', false); return; }

  const { error } = await supabase.from('violations').insert([{
    class_id: cid, student_id: sid, violation, time_at, date_at, notes
  }]);

  if (error) { showAlert(error.message, false); return; }
  showAlert('Pelanggaran tersimpan.', true);
});

/////////////////////// INIT ///////////////////////
(async function init() {
  try {
    await loadClasses();
    // set default tahun
    if (inputTahun && !inputTahun.value) {
      inputTahun.value = (new Date()).getFullYear();
    }
    // jika di tab tampil – langsung load santri sesuai kelas terpilih (kalau ada value preset)
    if (selectKelas && selectKelas.value) {
      await loadStudentsByClass(selectKelas.value);
    }
    // kolektif rows (jika ada elemen)
    if (kelasKolektif && kelasKolektif.value) {
      await loadKolektifRows();
    }
  } catch (e) {
    showAlert(e.message || 'Gagal inisialisasi', false);
  }
})();
