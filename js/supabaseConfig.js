/* ============================================================
   SUPABASE CONFIG — Supabase Authentication & Database
   ============================================================ */

// === DEBUG: File started ===
if (typeof window !== 'undefined') {
  window.supabaseConfigLoading = true;
  console.log('[supabaseConfig.js] File execution started');
}

// 🔐 Supabase credentials
const SUPABASE_URL = 'https://tgtuxvmuapiltmkulvlk.supabase.co';
const SUPABASE_KEY = 'sb_publishable_8mmv4aAB8mPRvYe459ZwGQ_KVVJROax';

// State
let supabase = null;
let supabaseReady = false;

// === Functions ===

async function initializeSupabase() {
  try {
    if (!SUPABASE_URL || SUPABASE_URL === 'YOUR_SUPABASE_URL') {
      console.warn('[Supabase] Credentials not configured');
      return false;
    }
    supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    supabaseReady = true;
    console.log('[Supabase] ✅ Initialized');
    return true;
  } catch (err) {
    console.error('[Supabase] Initialize error:', err.message);
    return false;
  }
}

async function getCurrentUser() {
  if (!supabaseReady) return null;
  try {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) throw error;
    return user;
  } catch (err) {
    console.error('[Supabase] getCurrentUser error:', err.message);
    return null;
  }
}

async function getUserProfile(userId) {
  if (!supabaseReady) return null;
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*, roles(*)')
      .eq('id', userId)
      .single();
    if (error) throw error;
    return data;
  } catch (err) {
    console.error('[Supabase] getUserProfile error:', err.message);
    return null;
  }
}

async function signUp(email, password, name) {
  if (!supabaseReady) return null;
  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name } }
    });
    if (error) throw error;
    return data;
  } catch (err) {
    console.error('[Supabase] signUp error:', err.message);
    return null;
  }
}

async function signIn(email, password) {
  if (!supabaseReady) return null;
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    if (error) throw error;
    return data;
  } catch (err) {
    console.error('[Supabase] signIn error:', err.message);
    return null;
  }
}

async function signOut() {
  if (!supabaseReady) return false;
  try {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    return true;
  } catch (err) {
    console.error('[Supabase] signOut error:', err.message);
    return false;
  }
}

function onAuthStateChange(callback) {
  if (!supabaseReady) return null;
  return supabase.auth.onAuthStateChange((event, session) => {
    callback(event, session);
  });
}

// === EXPORT TO WINDOW ===
console.log('[supabaseConfig.js] Exporting functions...');
window.initializeSupabase = initializeSupabase;
window.getCurrentUser = getCurrentUser;
window.getUserProfile = getUserProfile;
window.signUp = signUp;
window.signIn = signIn;
window.signOut = signOut;
window.onAuthStateChange = onAuthStateChange;

console.log('[supabaseConfig.js] ✅ All functions exported');
window.supabaseConfigReady = true;
