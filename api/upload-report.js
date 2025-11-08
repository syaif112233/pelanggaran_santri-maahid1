// api/upload-report.js
import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

    const { filename, base64 } = req.body || {}
    if (!filename || !base64) return res.status(400).json({ error: 'filename & base64 required' })

    const SUPABASE_URL = process.env.SUPABASE_URL
    const SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY
    if (!SUPABASE_URL || !SERVICE_KEY) return res.status(500).json({ error: 'Missing env' })

    const supa = createClient(SUPABASE_URL, SERVICE_KEY)
    const bucket = 'reports'

    // pastikan bucket ada
    const { data: buckets, error: lbErr } = await supa.storage.listBuckets()
    if (lbErr) return res.status(500).json({ error: lbErr.message })
    if (!buckets?.find(b => b.name === bucket)) {
      const { error: cbErr } = await supa.storage.createBucket(bucket, { public: true })
      if (cbErr) return res.status(500).json({ error: cbErr.message })
    }

    const buf = Buffer.from(base64, 'base64')
    const path = `${new Date().getFullYear()}/${filename}`

    const { error: upErr } = await supa.storage.from(bucket).upload(path, buf, {
      contentType: 'application/pdf',
      upsert: true
    })
    if (upErr) return res.status(500).json({ error: upErr.message })

    const { data } = supa.storage.from(bucket).getPublicUrl(path)
    return res.status(200).json({ publicUrl: data.publicUrl })
  } catch (e) {
    return res.status(500).json({ error: e?.message || 'Upload error' })
  }
}
