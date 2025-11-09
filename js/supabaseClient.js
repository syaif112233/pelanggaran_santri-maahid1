import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = 'https://cukvamnbkvvlgqxsauts.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN1a3ZhbW5ia3Z2bGdxeHNhdXRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI2MzkzMjksImV4cCI6MjA3ODIxNTMyOX0.1LL9KWtvWKQjZaXoScn7lo1NwHFZa79BaIe6W_kRckU'

const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
window.supabase = client
window.dispatchEvent(new Event('supabase-ready'))

//import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

//const SUPABASE_URL = 'https://qjcnqeyrzryuclwpmala.supabase.co'
//const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFqY25xZXlyenJ5dWNsd3BtYWxhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI0MDIwNjgsImV4cCI6MjA3Nzk3ODA2OH0.WwYGa4gKjoJ8n4fuqpQifgpLPJxHlZuUbtdhiF0OGs8'

//window.supabase = createClient(supabaseUrl, supabaseKey);

// beri tahu app-logic kalau sudah siap
//window.dispatchEvent(new Event('supabase-ready'));


