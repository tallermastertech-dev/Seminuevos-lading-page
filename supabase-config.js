/**
 * Supabase Configuration
 * =====================
 */
const SUPABASE_URL = 'https://gfvmugsbizmvlziljxir.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_g0Iw9r4zRCBadMPtiF5kNA_x8_n4p8v';

let supabaseClient = null;

function initSupabaseClient() {
    try {
        const _sb = window.supabase || (typeof supabase !== 'undefined' ? supabase : null);
        if (_sb && typeof _sb.createClient === 'function') {
            supabaseClient = _sb.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
            return supabaseClient;
        }
    } catch (e) {
        console.warn("Supabase init notice:", e);
    }
    return null;
}

initSupabaseClient();
