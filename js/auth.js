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
    
    // Wait for initializeSupabase function to be available
    let attempts = 0;
    while (typeof window.initializeSupabase !== 'function' && attempts < 50) {
      await new Promise(resolve => setTimeout(resolve, 100));
      attempts++;
      if (attempts % 5 === 0) {
        console.log(`[Auth] Waiting for initializeSupabase... attempt ${attempts}/50`);
      }
    }

    if (typeof window.initializeSupabase !== 'function') {
      console.error('[Auth] supabaseConfig.js functions not available after 5 seconds');
      alert('ระบบไม่พร้อม กรุณารีโหลดหน้า');
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
    document.getElementById('showRegisterBtn').addEventListener('click', showRegisterForm);
    document.getElementById('showLoginBtn').addEventListener('click', showLoginForm);
    document.getElementById('registerBtn').addEventListener('click', handleRegister);
    document.getElementById('demoBtn').addEventListener('click', handleDemoLogin);

    // Allow Enter key on forms
    document.getElementById('loginPassword').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') handleLogin();
    });

    document.getElementById('registerConfirm').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') handleRegister();
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
  document.getElementById('loginEmail').focus();
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
 * Handle login
 */
async function handleLogin() {
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;

  if (!email || !password) {
    showError('กรุณากรอกอีเมลและรหัสผ่าน');
    return;
  }

  console.log('[Login] Attempting login with:', email);
  setLoading(true);

  try {
    console.log('[Login] Checking signIn function...', typeof signIn);
    console.log('[Login] window.signIn:', typeof window.signIn);
    
    if (typeof signIn !== 'function' && typeof window.signIn !== 'function') {
      console.error('[Login] signIn not available!');
      showError('ระบบยังไม่พร้อม - signIn ไม่ available');
      setLoading(false);
      return;
    }
    
    const result = await signIn(email, password);
    console.log('[Login] signIn result:', result);
    
    if (!result) {
      showError('อีเมลหรือรหัสผ่านไม่ถูกต้อง');
      setLoading(false);
      return;
    }

    showSuccess('เข้าสู่ระบบสำเร็จ');
    
    // Redirect to main app after short delay
    setTimeout(() => {
      window.location.href = 'index.html';
    }, 1000);

  } catch (err) {
    console.error('Login error:', err);
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
 * Check authentication on main page load
 */
async function checkAuth() {
  try {
    // Initialize Supabase
    const ready = await initSupabaseService();
    
    if (!ready) {
      console.warn('[Auth] Supabase not ready, using fallback mode');
      // Use localStorage fallback
      return true;
    }

    // Get current user
    const user = await getCurrentUser();
    
    if (!user) {
      // Redirect to login page
      window.location.href = 'login.html';
      return false;
    }

    // Store current user (skip getUserProfile to avoid recursion issues)
    currentUserRole = user.user_metadata?.role || 'user';
    currentUser = user;

    console.log(`✅ User authenticated: ${user.email} (${currentUserRole})`);
    return true;

  } catch (err) {
    console.error('[Auth] checkAuth error:', err);
    window.location.href = 'login.html';
    return false;
  }
}

/**
 * Sign out current user
 */
async function handleSignOut() {
  try {
    const result = await signOut();
    if (result) {
      window.location.href = 'login.html';
    }
  } catch (err) {
    console.error('Sign out error:', err);
  }
}

console.log('[Auth] auth.js loaded. Waiting for login page to call initAuthPage()');

