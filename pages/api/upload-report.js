// api/upload-report.js
const { createClient } = require('@supabase/supabase-js')

module.exports = async (req, res) => {
  try {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' })
      return
    }

    const { filename, base64 } = req.body || {}
    if (!filename || !base64) {
      res.status(400).json({ error: 'filename & base64 required' })
      return
    }

    const SUPABASE_URL = process.env.SUPABASE_URL
    const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY
    if (!SUPABASE_URL || !SERVICE_KEY) {
      res.status(500).json({ error: 'Missing SUPABASE_URL or SUPABASE_SERVICE_KEY' })
      return
    }

    const supa = createClient(SUPABASE_URL, SERVICE_KEY)
    const bucket = 'reports'

    // pastikan bucket ada
    const { data: buckets, error: lbErr } = await supa.storage.listBuckets()
    if (lbErr) { res.status(500).json({ error: lbErr.message }); return }
    if (!buckets?.some(b => b.name === bucket)) {
      const { error: cbErr } = await supa.storage.createBucket(bucket, { public: true })
      if (cbErr) { res.status(500).json({ error: cbErr.message }); return }
    }

    const buffer = Buffer.from(base64, 'base64')
    const path = `${new Date().getFullYear()}/${filename}`

    const { error: upErr } = await supa.storage.from(bucket).upload(path, buffer, {
      contentType: 'application/pdf',
      upsert: true
    })
    if (upErr) { res.status(500).json({ error: upErr.message }); return }

    const { data } = supa.storage.from(bucket).getPublicUrl(path)
    res.status(200).json({ publicUrl: data.publicUrl })
  } catch (e) {
    res.status(500).json({ error: e?.message || 'Upload error' })
  }
}
