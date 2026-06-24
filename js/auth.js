/* ============================================================
   AUTH.JS — Supabase Authentication Management
   ============================================================
   Handles login, registration, and access control
*/

/**
 * Initialize authentication on login page
 */
async function initAuthPage() {
  try {
    console.log('[Auth] initAuthPage starting...');
    
    // Make sure Supabase config is available
    if (typeof window.initializeSupabase !== 'function') {
      console.error('[Auth] initializeSupabase not available');
      alert('ระบบไม่พร้อม - ฟังก์ชัน Supabase ไม่พร้อม');
      return;
    }

    // Initialize Supabase client
    console.log('[Auth] Calling initializeSupabase...');
    const initSuccess = await window.initializeSupabase();
    
    if (!initSuccess) {
      console.error('[Auth] Supabase initialization failed');
      alert('ระบบไม่พร้อม - ไม่สามารถ connect ไปยัง Supabase');
      return;
    }

    console.log('[Auth] ✅ Supabase initialized successfully');

    // Check if user already logged in
    const user = await window.getCurrentUser();
    if (user) {
      console.log('[Auth] User already logged in, redirecting...');
      // Redirect to main app
      window.location.href = 'index.html';
      return;
    }

    // Bind login form event listeners
    document.getElementById('loginBtn').addEventListener('click', handleLogin);

    // Allow Enter key on login form
    document.getElementById('loginPassword').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') handleLogin();
    });

    document.getElementById('loginUsername').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') handleLogin();
    });

    console.log('[Auth] Login page initialized successfully');
  } catch (err) {
    console.error('[Auth] initAuthPage error:', err);
    alert('เกิดข้อผิดพลาด: ' + err.message);
  }
}

/**
 * Show login form
 */
function showLoginForm() {
  document.getElementById('loginForm').style.display = 'block';
  document.getElementById('registerForm').style.display = 'none';
  document.getElementById('errorMsg').style.display = 'none';
  document.getElementById('successMsg').style.display = 'none';
  document.getElementById('loginUsername').focus();
}

/**
 * Show register form
 */
function showRegisterForm() {
  document.getElementById('loginForm').style.display = 'none';
  document.getElementById('registerForm').style.display = 'block';
  document.getElementById('errorMsg').style.display = 'none';
  document.getElementById('successMsg').style.display = 'none';
  document.getElementById('registerName').focus();
}

/**
 * Show loading state
 */
function setLoading(isLoading) {
  document.getElementById('loading').style.display = isLoading ? 'block' : 'none';
  document.getElementById('loginForm').style.opacity = isLoading ? '0.5' : '1';
  document.getElementById('registerForm').style.opacity = isLoading ? '0.5' : '1';
  document.getElementById('loginBtn').disabled = isLoading;
  document.getElementById('registerBtn').disabled = isLoading;
}

/**
 * Show error message
 */
function showError(message) {
  const el = document.getElementById('errorMsg');
  el.textContent = message;
  el.style.display = 'block';
  document.getElementById('successMsg').style.display = 'none';
}

/**
 * Show success message
 */
function showSuccess(message) {
  const el = document.getElementById('successMsg');
  el.textContent = message;
  el.style.display = 'block';
  document.getElementById('errorMsg').style.display = 'none';
}

/**
 * Handle login - ✅ ใช้ Supabase Auth จริง
 */
async function handleLogin() {
  const username = document.getElementById('loginUsername').value.trim();
  const password = document.getElementById('loginPassword').value;

  if (!username || !password) {
    showError('กรุณากรอกชื่อผู้ใช้และรหัสผ่าน');
    return;
  }

  console.log('[Login] Attempting Supabase Auth with:', username);
  setLoading(true);

  try {
    // แปลง username เป็น email (ใช้รูปแบบ username@tbr.local ที่สร้างใน Supabase Auth)
    const email = username.includes('@') ? username : `${username}@tbr.local`;
    
    // ✅ ใช้ Supabase Auth จริง (ฟังก์ชันนี้มีอยู่แล้วใน supabaseConfig.js)
    const result = await window.signIn(email, password);
    
    if (!result || !result.user) {
      console.error('[Login] Supabase Auth failed');
      showError('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
      setLoading(false);
      return;
    }

    console.log('[Login] ✅ Supabase Auth successful for:', email);
    
    // ตอนนี้มี session จริงแล้ว → auth.uid() ใช้งานได้ → RLS ผ่าน
    // ดึง role จาก profiles ไว้ให้ UI ใช้ (แหล่งความจริงของ auth คือ session ของ supabase เอง)
    const sb = window.getSupabase();
    const { data: profile, error: profileError } = await sb
      .from('profiles')
      .select('role, full_name')
      .eq('id', result.user.id)
      .single();

    if (profileError) {
      console.warn('[Login] Profile fetch error:', profileError.message);
    }

    // เก็บข้อมูลแสดงผลใน localStorage (สำหรับ UI ใช้อ้างอิง)
    localStorage.setItem('tbr_user_session', JSON.stringify({
      user_id: result.user.id,
      email: result.user.email,
      username,
      role: profile?.role || 'technician',
      full_name: profile?.full_name || username,
      login_time: new Date().toISOString()
    }));

    showSuccess('เข้าสู่ระบบสำเร็จ');
    
    // Redirect to main app after short delay
    setTimeout(() => {
      window.location.href = 'index.html';
    }, 1000);

  } catch (err) {
    console.error('[Login] Supabase Auth error:', err.message);
    showError('เข้าสู่ระบบไม่สำเร็จ: ' + err.message);
    setLoading(false);
  }
}

/**
 * Handle registration
 */
async function handleRegister() {
  const name = document.getElementById('registerName').value.trim();
  const email = document.getElementById('registerEmail').value.trim();
  const password = document.getElementById('registerPassword').value;
  const confirm = document.getElementById('registerConfirm').value;
  const roleId = document.getElementById('registerRole').value;

  // Validate inputs
  if (!name || !email || !password || !roleId) {
    showError('กรุณากรอกข้อมูลให้ครบถ้วน');
    return;
  }

  if (password !== confirm) {
    showError('รหัสผ่านไม่ตรงกัน');
    return;
  }

  if (password.length < 6) {
    showError('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร');
    return;
  }

  setLoading(true);

  try {
    // Sign up user
    const signUpResult = await signUp(email, password, name);
    
    if (!signUpResult || !signUpResult.user) {
      showError('ลงทะเบียนไม่สำเร็จ - อีเมลอาจถูกใช้งานแล้ว');
      setLoading(false);
      return;
    }

    // Create user profile with role
    await createUserProfile(signUpResult.user.id, email, name, roleId);

    showSuccess('ลงทะเบียนสำเร็จ! กรุณารอการอนุมัติจากผู้จัดการ');
    
    // Clear form
    setTimeout(() => {
      showLoginForm();
      document.getElementById('loginEmail').value = email;
      document.getElementById('loginPassword').value = '';
    }, 2000);

  } catch (err) {
    console.error('Register error:', err);
    showError('ลงทะเบียนไม่สำเร็จ: ' + err.message);
    setLoading(false);
  }
}

/**
 * Create user profile in database
 */
async function createUserProfile(userId, email, name, roleId) {
  try {
    // Get role ID from role name
    const roleMap = {
      'admin': 1,
      'technician': 2,
      'front_desk': 3
    };

    const { error } = await supabase
      .from('users')
      .insert([{
        id: userId,
        email,
        name,
        role_id: roleMap[roleId],
        active: false // Require admin approval
      }]);

    if (error) throw error;
    return true;
  } catch (err) {
    console.error('createUserProfile error:', err);
    return false;
  }
}

/**
 * Demo login with test accounts
 */
async function handleDemoLogin() {
  document.getElementById('loginEmail').value = 'admin@tbr.local';
  document.getElementById('loginPassword').value = 'admin123';
  
  setTimeout(() => {
    handleLogin();
  }, 100);
}

/**
 * Check authentication on main page load - ✅ ตรวจ Supabase Auth ทีแรก
 */
async function checkAuth() {
  try {
    // ALWAYS initialize Supabase first (needed for multi-user data sync)
    console.log('[Auth] Initializing Supabase...');
    const ready = await initSupabaseService();
    
    if (!ready) {
      console.warn('[Auth] Supabase initialization failed');
      // ถ้า Supabase ไม่พร้อม ให้ goto login ทีเดียว
      window.location.href = 'login.html';
      return false;
    }

    // ✅ ตรวจ Supabase Auth session (ทีแรก)
    const user = await window.getCurrentUser?.();
    
    if (user && user.id) {
      console.log(`✅ User authenticated (Supabase Auth): ${user.email} (${user.role})`);
      currentUser = {
        user_id: user.id,
        email: user.email,
        username: user.email.split('@')[0],
        role: user.role || 'technician',
        full_name: user.full_name || user.email
      };
      currentUserRole = user.role || 'technician';
      
      // เก็บแบบ UI reference เพื่อ bootstrap หลังจาก loadData
      localStorage.setItem('tbr_user_session', JSON.stringify(currentUser));
      
      console.log('[Auth] ✅ checkAuth complete - user verified (Supabase Auth)');
      return true;
    }

    // ถ้าไม่มี Supabase Auth session → ไป login
    console.log('[Auth] No authenticated user, redirecting to login.html');
    window.location.href = 'login.html';
    return false;

  } catch (err) {
    console.error('[Auth] checkAuth error:', err.message);
    window.location.href = 'login.html';
    return false;
  }
}

/**
 * Sign out current user - ✅ ใช้ Supabase Auth signOut
 */
async function handleSignOut() {
  try {
    // ✅ Sign out จาก Supabase Auth ทีแรก
    if (typeof window.signOut === 'function') {
      await window.signOut();
      console.log('[Auth] Supabase Auth signed out');
    }
    
    // Clear localStorage session
    localStorage.removeItem('tbr_user_session');
    currentUser = null;
    currentUserRole = null;
    
    console.log('[Auth] User signed out');
    window.location.href = 'login.html';
  } catch (err) {
    console.error('[Auth] Sign out error:', err.message);
    // Fallback: clear localStorage and redirect anyway
    localStorage.removeItem('tbr_user_session');
    window.location.href = 'login.html';
  }
}

console.log('[Auth] auth.js loaded. Waiting for login page to call initAuthPage()');

// Export to window for login.html to call
window.initAuthPage = initAuthPage;

