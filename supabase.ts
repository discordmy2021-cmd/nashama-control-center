import { createClient } from '@supabase/supabase-js';

// ضع رابط مشروعك الحقيقي هنا بين علامتي التنصيص
const supabaseUrl = 'https://xxxxxx.supabase.co'; 

// ضع مفتاح الـ Anon Key الحقيقي هنا بين علامتي التنصيص
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsIn...';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);