// import { supabase } from './supabaseClient.js'

// ===== INSERT: Per Kelas (batch baris yang diisi pelanggaran) =====
export async function saveViolationsBatch(selectedClassId, rows) {
  // rows: [{ student_id, violation, time, date, notes }, ...]
  const payload = (rows || [])
    .map(r => ({
      student_id: r.student_id || null,
      class_id: selectedClassId || null,
      violation: (r.violation || '').trim(),
      time_at: r.time ? r.time.trim() : null,     // 'HH:mm'
      date_at: r.date ? r.date.trim() : null,     // 'YYYY-MM-DD'
      notes: (r.notes || '').trim() || null,
    }))
    .filter(x => x.student_id && x.class_id && x.violation)

  const { error } = await supabase.from('violations').insert(payload)
  if (error) throw new Error(error.message)
  return true
}

// ===== INSERT: Per Santri (ambil class_id dari students) =====
export async function saveViolationSingle(selectedStudentId, { violation, time_at, date_at, notes }) {
  const { data: srow, error: sErr } = await supabase
    .from('students')
    .select('id, class_id')
    .eq('id', selectedStudentId)
    .single()

  if (sErr || !srow) throw new Error('Data siswa tidak ditemukan')

  const { error: insErr } = await supabase.from('violations').insert([{
    student_id: srow.id,
    class_id: srow.class_id,
    violation: (violation || '').trim(),
    time_at: time_at || null,
    date_at: date_at || null,
    notes: (notes || '').trim() || null,
  }])

  if (insErr) throw new Error(insErr.message)
  return true
}

// ===== QUERY: View v_violations_expanded =====
export async function fetchViolations({ classId, studentId, bulan, tahun }) {
  let q = supabase.from('v_violations_expanded').select('*')

  if (classId)   q = q.eq('class_id', classId)
  if (studentId) q = q.eq('student_id', studentId)

  if (bulan && tahun) {
    const mm = String(bulan).padStart(2, '0')
    const start = `${tahun}-${mm}-01`
    const end   = `${tahun}-${mm}-31` // cukup praktis
    q = q.gte('date_at', start).lte('date_at', end)
  }

  const { data, error } = await q.order('date_at', { ascending: false })
  if (error) throw new Error(error.message)
  return data
}
