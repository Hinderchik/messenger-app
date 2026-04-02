const SUPABASE_URL = 'https://igneocxwtgnjuklerizs.supabase.co';
const SUPABASE_KEY = 'sb_publishable_2QdRrPXwYOZs-lQASDrDfw_MLsZHMc-';

// Проверяем что supabase уже загружен
if (typeof supabase !== 'undefined') {
    window.supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
} else {
    window.addEventListener('load', () => {
        window.supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    });
}
