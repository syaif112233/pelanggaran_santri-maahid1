// js/supabaseClient.js
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = 'https://qjcnqeyrzryuclwpmala.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFqY25xZXlyenJ5dWNsd3BtYWxhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI0MDIwNjgsImV4cCI6MjA3Nzk3ODA2OH0.WwYGa4gKjoJ8n4fuqpQifgpLPJxHlZuUbtdhiF0OGs8'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// api/upload-report.js
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    const { filename, base64 } = req.body || {};
    if (!filename || !base64) return res.status(400).json({ error: 'filename & base64 required' });

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SERVICE_KEY   = process.env.SUPABASE_SERVICE_KEY;
    const supa = createClient(SUPABASE_URL, SERVICE_KEY);

    // pastikan bucket ada
    const { data: buckets } = await supa.storage.listBuckets();
    if (!buckets?.find(b=>b.name==='reports')) {
      await supa.storage.createBucket('reports', { public: true });
    }

    // upload file
    const buffer = Buffer.from(base64, 'base64');
    const path = `${new Date().getFullYear()}/${filename}`;
    const { error: upErr } = await supa.storage.from('reports').upload(path, buffer, {
      contentType: 'application/pdf',
      upsert: true
    });
    if (upErr) return res.status(500).json({ error: upErr.message });

    // ambil public URL
    const { data } = supa.storage.from('reports').getPublicUrl(path);
    return res.status(200).json({ publicUrl: data.publicUrl });
  } catch (e) {
    return res.status(500).json({ error: e?.message || 'Upload error' });
  }
}


