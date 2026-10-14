import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'رابط_مشروع_الـ_supabase_خاصتك';
const supabaseAnonKey = 'مفتاح_الـ_anon_key_خاصتك';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);