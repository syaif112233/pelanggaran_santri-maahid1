/*************************************************
 * app-logic.js (FULL)
 * - Pisah alur per-kelas vs per-santri (aman)
 * - html2pdf v0.10.x: .set().from().toPdf().get('pdf')
 * - Upload ke /api/upload-report (Vercel serverless)
 * - WA langsung ke wali kelas (nama + nomor)
 * - Aksi hapus (disembunyikan saat PDF)
 * - Dropdown Pelanggaran: opsi "Lainnya…" -> input teks
 **************************************************/

/* ============== SUPABASE CLIENT (global) ============== */
// Supabase client diexpose oleh js/supabaseClient.js ke window.supabase.
// Di sini kita tunggu sampai siap agar tidak undefined.
async function getSupabase() {
  if (window.supabase) return window.supabase;
  await new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('Supabase client belum siap')), 3000);
    window.addEventListener('supabase-ready', () => {
      clearTimeout(t);
      resolve();
    }, { once: true });
  });
  return window.supabase;
}
const supabase = await getSupabase();

/* ================== UTIL & STATE ================== */
const $  = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

function showAlert(msg, ok = false) {
  // cari elemen alert bawaan jika ada, kalau tidak pakai alert()
  const el = $('#alert') || $('#app-alert') || null;
  if (el) {
    el.className = `my-3 rounded p-3 ${ok ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`;
    el.textContent = msg;
    el.style.display = 'block';
    setTimeout(() => (el.style.display = 'none'), 4000);
  } else {
    alert(msg);
  }
}

// normalisasi nomor ke format international (IDN)
function normalizePhone(p) {
  if (!p) return '';
  const digits = p.replace(/\D+/g, '');
  if (digits.startsWith('62')) return digits;
  if (digits.startsWith('0'))  return '62' + digits.slice(1);
  return digits; // sudah internasional atau custom
}

// build teks ringkasan subjudul
function buildSubtitle({ kelasName, studentName, periodeText }) {
  const bagianKelas = kelasName ? `Kelas: ${kelasName}` : 'Kelas: Semua';
  const bagianSantri = studentName ? ` | Santri: ${studentName}` : ' | Santri: Semua';
  const bagianPeriode = ` | Periode: ${periodeText || 'Semua Bulan'}`;
  return `${bagianKelas}${bagianSantri}${bagianPeriode}`;
}

// state terakhir untuk WA/PDF
let lastViewData = [];          // array hasil query tampilan
let lastClassMeta = null;       // { kelas, wali_name, wali_phone }

/* ======= DOM refs (multi-id helper agar fleksibel) ======= */
// Input per Kelas
const selectKelasPerKelas = $('#kelas-per-kelas') || $('#selectKelasPerKelas') || $('#kelas1');
const tbodyPerKelas       = $('#tbodyLaporan')    || $('#lap-body-kelas')      || $('#tbody-per-kelas');
const btnSimpanKelas      = $('#btnSimpanKelas')  || $('#btnSimpanPelanggaran') || $('#btnSaveKelas');

// Input per Santri
const selectKelasPerSantri = $('#kelas-per-santri') || $('#selectKelasPerSantri') || $('#kelas2');
const selectSantri         = $('#selectSantri')     || $('#santriDropdown')       || $('#santri2');
const selectPelanggaranS   = $('#pelanggaranSantri')|| $('#pelanggaran2');
const inputPelanggaranLainS= $('#pelanggaranSantriLain') || $('#pelanggaran2Lain');
const inputJamS            = $('#jamSantri')        || $('#jam2');
const inputTanggalS        = $('#tanggalSantri')    || $('#tanggal2');
const inputNotesS          = $('#notesSantri')      || $('#notes2');
const btnSimpanSantri      = $('#btnSimpanSantri')  || $('#btnSaveSantri');

// Tampilkan & Cetak
const selectKelasF   = $('#filterKelas')   || $('#kelas-tampil')  || $('#selectKelas');
const selectSantriF  = $('#filterSantri')  || $('#santri-tampil') || $('#selectStudent');
const selectBulanF   = $('#filterBulan')   || $('#bulan-tampil')  || $('#selectMonth');
const selectTahunF   = $('#filterTahun')   || $('#tahun-tampil')  || $('#selectYear');
const btnTampilkan   = $('#btnTampilkan')  || $('#btnShow');
const btnCetak       = $('#btnCetak')      || $('#btnPrint');
const btnPdfWa       = $('#btnPdfWa')      || $('#btnKirimWa') || $('#btnBuatPdfKirimWa');

// area laporan (yang di-PDF)
const lapWrap      = $('#lap-wrap');
const lapTitle     = $('#lap-title');
const lapSubtitle  = $('#lap-subtitle');
const lapMeta      = $('#lap-meta');
const lapTable     = $('#lap-table');
const tbodyView    = $('#tbodyLaporanView') || $('#lap-table tbody') || $('#tbody-tampil');

// “Aksi” (hapus) ada di HTML, tapi JANGAN ikut ke PDF.
// beri class khusus pada header/kolom aksi supaya mudah di-hide saat clone:
const COL_AKSI_HEADER_SEL = 'th[data-col="aksi"]';   // header aksi
const COL_AKSI_CELLS_SEL  = 'td[data-col="aksi"]';   // cell aksi

/* ============== LOAD OPTION KELAS (dipakai di semua tab) ============== */
async function loadClassesOptions() {
  const { data, error } = await supabase.from('classes').select('id, kelas, wali_name, wali_phone').order('kelas');
  if (error) { showAlert(error.message, false); return; }

  // helper isi dropdown kelas
  function fillKelasSelect(el) {
    if (!el) return;
    const opt = ['<option value="">-- pilih kelas --</option>']
      .concat(data.map(c => `<option value="${c.id}" data-wali-name="${c.wali_name||''}" data-wali-phone="${c.wali_phone||''}">${c.kelas}</option>`));
    el.innerHTML = opt.join('');
  }

  fillKelasSelect(selectKelasPerKelas);
  fillKelasSelect(selectKelasPerSantri);

  if (selectKelasF) {
    const all = ['<option value="">Semua Kelas</option>']
      .concat(data.map(c => `<option value="${c.id}" data-wali-name="${c.wali_name||''}" data-wali-phone="${c.wali_phone||''}">${c.kelas}</option>`));
    selectKelasF.innerHTML = all.join('');
  }
}
await loadClassesOptions();

/* =================== INPUT PER KELAS =================== */
async function loadStudentsTableByClass(classId) {
  if (!classId || !tbodyPerKelas) return;

  // ambil meta wali untuk WA
  const { data: meta } = await supabase.from('classes')
    .select('kelas, wali_name, wali_phone').eq('id', classId).single();
  lastClassMeta = meta || null;

  const { data: students, error } = await supabase
    .from('students').select('id, name, kelas, class_id')
    .eq('class_id', classId).order('name');

  if (error) { showAlert(error.message, false); return; }

  tbodyPerKelas.innerHTML = students.map((s, i) => `
    <tr data-student="${s.id}">
      <td class="p-2 text-center">${i + 1}</td>
      <td class="p-2">${s.name}</td>
      <td class="p-2">
        <select class="sel-viol form">
          <option value="">-- pilih --</option>
          <option>Terlambat</option>
          <option>Atribut tidak lengkap</option>
          <option>Tidak mengikuti pelajaran</option>
          <option>Terlambat mengikuti pelajaran</option>
          <option value="__LAINNYA__">Lainnya…</option>
        </select>
        <input class="inp-viol-lain sr-only form mt-1" placeholder="Isi pelanggaran lainnya" />
      </td>
      <td class="p-2"><input class="inp-jam  form" placeholder="hh:mm:ss" /></td>
      <td class="p-2"><input class="inp-tgl  form" type="date" /></td>
      <td class="p-2"><input class="inp-notes form" placeholder="Keterangan (opsional)" /></td>
    </tr>
  `).join('');

  // toggle input 'lainnya'
  tbodyPerKelas.querySelectorAll('select.sel-viol').forEach((sel) => {
    sel.addEventListener('change', (e) => {
      const td = e.currentTarget.closest('td');
      const lain = td.querySelector('.inp-viol-lain');
      if (e.currentTarget.value === '__LAINNYA__') {
        lain.classList.remove('sr-only');
        lain.focus();
      } else {
        lain.classList.add('sr-only');
        lain.value = '';
      }
    });
  });
}

selectKelasPerKelas?.addEventListener('change', (e) => {
  loadStudentsTableByClass(e.target.value);
});

btnSimpanKelas?.addEventListener('click', async () => {
  if (!selectKelasPerKelas?.value) { showAlert('Pilih kelas dulu.', false); return; }

  const rows = Array.from(tbodyPerKelas?.querySelectorAll('tr') || []);
  const payload = [];

  rows.forEach(tr => {
    const student_id = tr.getAttribute('data-student');
    const violSel  = tr.querySelector('.sel-viol');
    const violLain = tr.querySelector('.inp-viol-lain');
    const jam      = tr.querySelector('.inp-jam')?.value || '';
    const tgl      = tr.querySelector('.inp-tgl')?.value || '';
    const notes    = tr.querySelector('.inp-notes')?.value || '';

    let violation = violSel?.value || '';
    if (violation === '__LAINNYA__') violation = violLain?.value?.trim() || '';

    // baris kosong lewati
    if (!student_id || !violation) return;

    payload.push({
      student_id,
      class_id: selectKelasPerKelas.value,
      violation,
      time_at: jam || null,
      date_at: tgl || null,
      notes: notes || null,
      input_at: new Date().toISOString()
    });
  });

  if (!payload.length) { showAlert('Tidak ada baris berisi.', false); return; }

  const { error } = await supabase.from('violations').insert(payload);
  if (error) { showAlert(error.message, false); return; }

  showAlert('Data pelanggaran tersimpan.', true);
  // optional: kosongkan input
  rows.forEach(tr => {
    tr.querySelector('.sel-viol').value = '';
    tr.querySelector('.inp-viol-lain').classList.add('sr-only');
    tr.querySelector('.inp-viol-lain').value = '';
    tr.querySelector('.inp-jam').value = '';
    tr.querySelector('.inp-tgl').value = '';
    tr.querySelector('.inp-notes').value = '';
  });
});

/* =================== INPUT PER SANTRI =================== */
async function loadStudentsSelectByClass(classId) {
  if (!classId || !selectSantri) return;

  // ambil meta wali untuk WA
  const { data: meta } = await supabase.from('classes')
    .select('kelas, wali_name, wali_phone').eq('id', classId).single();
  lastClassMeta = meta || null;

  const { data: students, error } = await supabase
    .from('students').select('id, name, class_id')
    .eq('class_id', classId).order('name');

  if (error) { showAlert(error.message, false); return; }

  selectSantri.innerHTML =
    `<option value="">-- Pilih santri --</option>` +
    students.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
}

selectKelasPerSantri?.addEventListener('change', (e) => {
  loadStudentsSelectByClass(e.target.value);
});

// toggle Lainnya (per-santri)
selectPelanggaranS?.addEventListener('change', (e) => {
  if (!inputPelanggaranLainS) return;
  if (e.target.value === '__LAINNYA__') {
    inputPelanggaranLainS.classList.remove('sr-only');
    inputPelanggaranLainS.focus();
  } else {
    inputPelanggaranLainS.classList.add('sr-only');
    inputPelanggaranLainS.value = '';
  }
});

btnSimpanSantri?.addEventListener('click', async () => {
  if (!selectKelasPerSantri?.value) { showAlert('Pilih kelas dulu.', false); return; }
  if (!selectSantri?.value)        { showAlert('Pilih santri dulu.', false); return; }

  let violation = selectPelanggaranS?.value || '';
  if (violation === '__LAINNYA__') {
    violation = (inputPelanggaranLainS?.value || '').trim();
  }
  if (!violation) { showAlert('Isi pelanggaran.', false); return; }

  const payload = {
    student_id: selectSantri.value,
    class_id: selectKelasPerSantri.value,
    violation,
    time_at: (inputJamS?.value || null),
    date_at: (inputTanggalS?.value || null),
    notes: (inputNotesS?.value || null),
    input_at: new Date().toISOString()
  };

  const { error } = await supabase.from('violations').insert(payload);
  if (error) { showAlert(error.message, false); return; }
  showAlert('Pelanggaran santri tersimpan.', true);

  // reset ringan
  if (selectPelanggaranS) selectPelanggaranS.value = '';
  if (inputPelanggaranLainS) { inputPelanggaranLainS.value=''; inputPelanggaranLainS.classList.add('sr-only'); }
  if (inputJamS) inputJamS.value = '';
  if (inputTanggalS) inputTanggalS.value = '';
  if (inputNotesS) inputNotesS.value = '';
});

/* =================== TAMPILKAN & CETAK =================== */
function monthNumToRange(m) {
  if (!m) return [1,12];
  const n = +m; return [n,n];
}

async function queryViewData({ classId, studentId, month, year }) {
  // view: v_violations_expanded (wajib punya kolom kelas)
  let q = supabase.from('v_violations_expanded').select(`
    id, student_id, student_name, class_id, class_name, violation, time_at, date_at, notes, input_at
  `);

  if (classId)  q = q.eq('class_id', classId);
  if (studentId) q = q.eq('student_id', studentId);
  if (year)      q = q.gte('date_at', `${year}-01-01`).lte('date_at', `${year}-12-31`);
  if (month) {
    const mm = String(month).padStart(2,'0');
    if (year) q = q.gte('date_at', `${year}-${mm}-01`).lte('date_at', `${year}-${mm}-31`);
  }
  q = q.order('date_at', { ascending: true }).order('time_at', { ascending: true });
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

function fillViewTable(data) {
  if (!tbodyView) return;
  tbodyView.innerHTML = data.map((r, i) => `
    <tr>
      <td class="p-2 text-center">${i+1}</td>
      <td class="p-2">${r.student_name || ''}</td>
      <td class="p-2">${r.class_name || ''}</td>
      <td class="p-2">${r.violation || ''}</td>
      <td class="p-2">${r.date_at || ''}</td>
      <td class="p-2">${r.time_at || ''}</td>
      <td class="p-2">${r.notes || ''}</td>
      <td class="p-2" data-col="aksi">
        <button class="btn-hapus px-2 py-1 bg-rose-600 text-white rounded" data-id="${r.id}">Hapus</button>
      </td>
    </tr>
  `).join('');

  // pasang handler hapus
  tbodyView.querySelectorAll('.btn-hapus').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-id');
      if (!confirm('Hapus data ini?')) return;
      const { error } = await supabase.from('violations').delete().eq('id', id);
      if (error) { showAlert(error.message, false); return; }
      btn.closest('tr')?.remove();
      showAlert('Data terhapus.', true);
    });
  });
}

btnTampilkan?.addEventListener('click', async () => {
  try {
    const classId = selectKelasF?.value || '';
    const studentId = selectSantriF?.value || '';
    const month = selectBulanF?.value || '';
    const year  = selectTahunF?.value || '';

    // ambil meta kelas (untuk subtitle + WA)
    if (classId) {
      const { data: meta } = await supabase.from('classes')
        .select('kelas, wali_name, wali_phone').eq('id', classId).single();
      lastClassMeta = meta || null;
    } else {
      lastClassMeta = null;
    }

    const data = await queryViewData({ classId, studentId, month, year });
    lastViewData = data;

    // HEADERS
    if (lapTitle)    lapTitle.textContent = 'Laporan Pelanggaran Santri';
    if (lapSubtitle) lapSubtitle.textContent = buildSubtitle({
      kelasName: lastClassMeta?.kelas || '',
      studentName: (selectSantriF && selectSantriF.value && selectSantriF.options[selectSantriF.selectedIndex]?.text) || '',
      periodeText: (month ? `Bulan ${month}` : 'Semua Bulan')
    });
    if (lapMeta)     lapMeta.textContent = '';

    fillViewTable(data);
    showAlert(`Menampilkan ${data.length} data.`, true);
  } catch (e) {
    showAlert(e.message || 'Gagal menampilkan data', false);
  }
});

btnCetak?.addEventListener('click', () => {
  window.print();
});

/* =================== PDF + KIRIM WA =================== */
async function ensureHtml2Pdf() {
  if (window.html2pdf) return;
  // html2pdf sudah kamu load via <script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js" defer>
  // kalau masih belum ready, tunggu sejenak
  await new Promise((r) => setTimeout(r, 300));
  if (!window.html2pdf) throw new Error('html2pdf belum dimuat. Pastikan <script html2pdf> ada di <head>.');
}

function cloneForPdf() {
  // clone lapWrap dan HILANGKAN kolom Aksi + ruang kosong atas
  const node = lapWrap.cloneNode(true);
  // hilangkan header aksi
  node.querySelectorAll(COL_AKSI_HEADER_SEL).forEach(th => th.remove());
  // hilangkan cell aksi
  node.querySelectorAll(COL_AKSI_CELLS_SEL).forEach(td => td.remove());
  // rapikan margin atas
  node.style.marginTop = '0';
  return node;
}

async function makePdfBlobFrom(node) {
  const opt = {
    margin: [10,10,10,10],                  // mm
    filename: `laporan-pelanggaran-${Date.now()}.pdf`,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, windowWidth: document.documentElement.clientWidth },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
  };

  const blob = await html2pdf()
    .set(opt)
    .from(node)
    .toPdf()
    .get('pdf')
    .then(pdf => pdf.output('blob'));

  return { blob, filename: opt.filename };
}

async function uploadToApi({ filename, blob }) {
  const buf = await blob.arrayBuffer();
  const base64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
  const res = await fetch('/api/upload-report', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filename, base64 })
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error || 'Upload gagal (balasan bukan JSON).');
  return json.publicUrl;
}

btnPdfWa?.addEventListener('click', async () => {
  try {
    await ensureHtml2Pdf();
    if (!lastViewData.length) { showAlert('Tampilkan data dulu sebelum membuat PDF.', false); return; }

    const node = cloneForPdf();
    const { blob, filename } = await makePdfBlobFrom(node);
    const publicUrl = await uploadToApi({ filename, blob });
    showAlert('PDF berhasil dibuat & diunggah.', true);

    // susun pesan WA
    const ringkasan = lapSubtitle?.textContent?.trim() || '';
    const waliName  = lastClassMeta?.wali_name || '';
    const waliPhone = normalizePhone(lastClassMeta?.wali_phone || '');

    const text = `Assalamu'alaikum ${waliName ? 'Bapak/Ibu '+waliName : ''}. Berikut laporan pelanggaran santri (${ringkasan}). PDF: ${publicUrl}`;
    const waUrl = waliPhone
      ? `https://api.whatsapp.com/send?phone=${encodeURIComponent(waliPhone)}&text=${encodeURIComponent(text)}`
      : `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;

    window.open(waUrl, '_blank');
  } catch (e) {
    showAlert(e.message || 'Gagal membuat/mengirim PDF', false);
  }
});

/* =================== INIT AWAL (optional) =================== */
// Jika di halaman “Tampilkan & Cetak” kamu ingin defaultnya langsung tampil:
// btnTampilkan?.click();
