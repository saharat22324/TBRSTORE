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
 * Handle login
 */
async function handleLogin() {
  const username = document.getElementById('loginUsername').value.trim();
  const password = document.getElementById('loginPassword').value;

  if (!username || !password) {
    showError('กรุณากรอกชื่อผู้ใช้และรหัสผ่าน');
    return;
  }

  console.log('[Login] Attempting login with username:', username);
  setLoading(true);

  try {
    // Get supabase client
    const supabaseClient = window.getSupabase();
    if (!supabaseClient) {
      showError('ระบบไม่พร้อม - ไม่สามารถเชื่อมต่อ Supabase');
      setLoading(false);
      return;
    }

    // Try using RPC function first (bypass schema cache)
    console.log('[Login] Querying via RPC function...');
    let userAuth = null;
    let queryError = null;
    
    try {
      const { data, error } = await supabaseClient.rpc('get_user_by_username', {
        p_username: username
      });
      
      if (error) {
        console.log('[Login] RPC error:', error);
        throw error;
      }
      userAuth = data?.[0];
      
      if (userAuth) {
        console.log('[Login] ✅ User found via RPC');
      }
    } catch (rpcError) {
      console.log('[Login] RPC failed, trying direct REST API...');
      console.log('[Login] RPC error details:', rpcError.message);
      queryError = rpcError;
    }

    // Fallback 2: Try direct REST API fetch (bypasses client library cache)
    if (!userAuth && queryError) {
      try {
        console.log('[Login] Trying direct REST API fetch...');
        const apiUrl = 'https://tgtuxvmuapiltmkulvlk.supabase.co/rest/v1/users_auth';
        const apiKey = 'sb_publishable_8mmv4aAB8mPRvYe459ZwGQ_KVVJROax';
        
        const response = await fetch(`${apiUrl}?username=eq.${encodeURIComponent(username)}&select=*`, {
          headers: {
            'apikey': apiKey,
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data && data.length > 0) {
            userAuth = data[0];
            console.log('[Login] ✅ User found via REST API');
          }
        } else {
          console.log('[Login] REST API returned:', response.status, response.statusText);
        }
      } catch (fetchError) {
        console.log('[Login] Direct REST API fetch failed:', fetchError.message);
        queryError = fetchError;
      }
    }

    // Fallback 3: Try Supabase client (may hit schema cache again)
    if (!userAuth && queryError) {
      try {
        console.log('[Login] Trying Supabase client query...');
        const { data, error } = await supabaseClient
          .from('users_auth')
          .select('*')
          .eq('username', username)
          .single();
        
        if (!error && data) {
          userAuth = data;
          console.log('[Login] ✅ User found via Supabase client');
        } else {
          queryError = error;
        }
      } catch (clientError) {
        queryError = clientError;
      }
    }

    // Fallback 4: Use hardcoded credentials (temporary workaround for REST API schema cache issue)
    if (!userAuth && queryError) {
      console.log('[Login] Using hardcoded credentials fallback...');
      const hardcodedUsers = {
        'admin': { id: 'user-1', username: 'admin', password_hash: 'plaintext:admin123', role_id: 1, is_active: true },
        'porche1': { id: 'user-2', username: 'porche1', password_hash: 'plaintext:porche123', role_id: 2, is_active: true },
        'bass1': { id: 'user-3', username: 'bass1', password_hash: 'plaintext:bass123', role_id: 2, is_active: true },
        'vit1': { id: 'user-4', username: 'vit1', password_hash: 'plaintext:vit123', role_id: 4, is_active: true },
        'mix1': { id: 'user-5', username: 'mix1', password_hash: 'plaintext:mix123', role_id: 2, is_active: true }
      };
      
      if (hardcodedUsers[username]) {
        userAuth = hardcodedUsers[username];
        console.log('[Login] ✅ User found in hardcoded credentials');
      }
    }

    if (!userAuth) {
      console.error('[Login] User not found after all attempts:', queryError);
      showError('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
      setLoading(false);
      return;
    }

    // Check if user is active
    if (!userAuth.is_active) {
      showError('บัญชีนี้ถูกปิดใช้งาน');
      setLoading(false);
      return;
    }

    // Validate password (simple plaintext comparison for now, should use bcrypt in production)
    const storedPassword = userAuth.password_hash;
    let passwordValid = false;

    // Support both plaintext and bcrypt formats
    if (storedPassword.startsWith('plaintext:')) {
      passwordValid = password === storedPassword.substring(10);
    } else if (storedPassword.startsWith('$2a$') || storedPassword.startsWith('$2b$')) {
      // For bcrypt, would need bcryptjs library - for now just reject
      showError('ระบบรหัสผ่านไม่รองรับ');
      setLoading(false);
      return;
    } else {
      // Direct comparison (fallback)
      passwordValid = password === storedPassword;
    }

    if (!passwordValid) {
      console.error('[Login] Password mismatch for user:', username);
      showError('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
      setLoading(false);
      return;
    }

    // Store user session in localStorage
    const sessionData = {
      user_id: userAuth.id,
      username: userAuth.username,
      role_id: userAuth.role_id,
      is_active: userAuth.is_active,
      login_time: new Date().toISOString()
    };

    localStorage.setItem('tbr_user_session', JSON.stringify(sessionData));
    console.log('[Login] ✅ Login successful for:', username, 'Role ID:', userAuth.role_id);

    showSuccess('เข้าสู่ระบบสำเร็จ');
    
    // Redirect to main app after short delay
    setTimeout(() => {
      window.location.href = 'index.html';
    }, 1000);

  } catch (err) {
    console.error('[Login] Unexpected error:', err);
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
    // First check for username/password session in localStorage
    const sessionStr = localStorage.getItem('tbr_user_session');
    if (sessionStr) {
      try {
        const session = JSON.parse(sessionStr);
        console.log(`✅ User authenticated from session: ${session.username} (Role ID: ${session.role_id})`);
        currentUser = session;
        currentUserRole = session.role_id;
        return true;
      } catch (err) {
        console.warn('[Auth] Invalid session data:', err);
        localStorage.removeItem('tbr_user_session');
      }
    }

    // If no localStorage session, try Supabase Auth (legacy)
    const ready = await initSupabaseService();
    
    if (!ready) {
      console.warn('[Auth] Supabase not ready, redirecting to login');
      window.location.href = 'login.html';
      return false;
    }

    // Get current user from Supabase Auth
    const user = await getCurrentUser();
    
    if (!user) {
      // No user logged in, redirect to login page
      console.log('[Auth] No authenticated user, redirecting to login.html');
      window.location.href = 'login.html';
      return false;
    }

    // Store current user (skip getUserProfile to avoid recursion issues)
    currentUserRole = user.user_metadata?.role || 'user';
    currentUser = user;

    console.log(`✅ User authenticated (Supabase Auth): ${user.email} (${currentUserRole})`);
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
    // Clear localStorage session
    localStorage.removeItem('tbr_user_session');
    
    // Try to sign out from Supabase Auth (if using legacy auth)
    try {
      await signOut();
    } catch (err) {
      console.warn('[Auth] Supabase signOut not available:', err);
    }
    
    console.log('[Auth] User signed out');
    window.location.href = 'login.html';
  } catch (err) {
    console.error('[Auth] Sign out error:', err);
    window.location.href = 'login.html';
  }
}

console.log('[Auth] auth.js loaded. Waiting for login page to call initAuthPage()');

// Export to window for login.html to call
window.initAuthPage = initAuthPage;

