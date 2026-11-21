/* Supabase konfiqurasiyası (ictimaidir; təhlükəsizliyi supabase/schema.sql-dəki RLS qaydaları təmin edir).
   Supabase → Project Settings → API: "Project URL" və "anon public" açarı.
   Diqqət: "service_role" açarını BURAYA YAZMAYIN! */
export const SUPABASE_URL = 'https://nanrrqdalbislehufvbl.supabase.co';          // məs. https://abcdxyz.supabase.co
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5hbnJycWRhbGJpc2xlaHVmdmJsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTUyMzA3MjYsImV4cCI6MjExMDgwNjcyNn0.JHerxMxtdOUhB8uicxcQR2ozDr7dcwdkP9TtDVk1bhI';     // "anon" / "publishable" açar (eyJ... və ya sb_publishable_...)
export const GOOGLE_ENABLED = false;     // Google girişini Supabase-də qoşandan sonra true edin
export const CEO_EMAIL = 'rareacademyy@gmail.com';   // bu Gmail ilə daxil olan avtomatik CEO/admin olur (schema.sql-dakı is_ceo() ilə eyni)
