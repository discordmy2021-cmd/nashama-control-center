import { createClient } from '@supabase/supabase-js';

// رابط مشروعك المستخرج من الـ Project ID
const supabaseUrl = 'https://mrerhfvcejbuuhvsikcm.supabase.co';

// المفتاح العام (Publishable Key) الذي نسخته من صفحة API Keys
const supabaseAnonKey = 'sb_publishable_C3UGKC2h7NLijUAqsF0BYA_wb7Rjm8t'; // استبدله بالمفتاح الكامل لديك

export const supabase = createClient(supabaseUrl, supabaseAnonKey);