/* ============================================================
   FIREBASE SERVICE — Compat SDK (v11)
   ============================================================
   ใช้ Firestore Cloud Database เก็บข้อมูลบน Cloud
   รองรับ (default) database ซึ่ง Spark/Blaze Plan ให้ได้ฟรี
*/

// Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyDUFLXIG8JgFhuT3LABHz1loLWVT_Nc8Q",
  authDomain: "tbr-store.firebaseapp.com",
  projectId: "tbr-store",
  storageBucket: "tbr-store.firebasestorage.app",
  messagingSenderId: "4205339157",
  appId: "1:4205339157:web:f7cef483fea9f307849338",
  measurementId: "G-YRT2CLKRZY"
};

// Global Firebase objects
let db, auth;
let isFirebaseReady = false;

/**
 * Initialize Firebase connection (Compat SDK v11) - WITH TIMEOUT
 */
async function initializeFirebase() {
  try {
    // ตรวจสอบว่า Firebase SDK ได้โหลดแล้ว
    if (typeof firebase === 'undefined') {
      console.warn('[Firebase] SDK ยังไม่โหลด - ใช้ localStorage แทน');
      return false;
    }

    // ตรวจสอบว่า API Key ใช้งานได้
    const apiKey = firebaseConfig.apiKey;
    if (!apiKey || apiKey.length < 20) {
      console.warn('[Firebase] API Key ไม่ถูกต้อง - ใช้ localStorage แทน');
      return false;
    }

    console.log('[Firebase] Attempting to initialize...');
    return false;  // Skip Firebase for now - just return false
    
  } catch (err) {
    console.error('[Firebase] Initialize error:', err);
    console.log('[Firebase] ⚠️  ใช้ localStorage แทน');
    return false;
  }
}

    isFirebaseReady = true;
    console.log(`[Firebase] ✅ เชื่อมต่อ Firestore สำเร็จ`);
    
    return true;
  } catch (err) {
    console.error('[Firebase] Initialize error:', err);
    console.log('[Firebase] ⚠️  ใช้ localStorage แทน');
    return false;
  }
}

/**
 * Save data to Cloud (Firebase Firestore) - Compat SDK
 */
async function saveToCloud(collectionName, data) {
  if (!isFirebaseReady) {
    console.warn('[Firebase] ยังไม่พร้อม - ข้าม Cloud save');
    return false;
  }

  try {
    const docRef = db.collection(collectionName).doc(collectionName);
    await docRef.set(data);
    console.log('[Firebase] ✅ บันทึกสำเร็จ:', collectionName);
    return true;
  } catch (err) {
    console.error('[Firebase] Save error:', err);
    if (typeof showToast === 'function') {
      showToast('บันทึก Cloud ไม่สำเร็จ', 'err');
    }
    return false;
  }
}

/**
 * Load data from Cloud (Firebase Firestore) - with timeout - Compat SDK
 */
async function loadFromCloud(collectionName) {
  if (!isFirebaseReady) {
    console.warn('[Firebase] ยังไม่พร้อม - ข้าม Cloud load');
    return null;
  }

  try {
    // 5-second timeout
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('timeout')), 5000)
    );
    
    const docRef = db.collection(collectionName).doc(collectionName);
    const racePromise = Promise.race([
      docRef.get(),
      timeoutPromise
    ]);
    
    const doc = await racePromise;
    
    if (doc.exists()) {
      console.log('[Firebase] ✅ โหลดสำเร็จ:', collectionName);
      return doc.data();
    }
    return null;
  } catch (err) {
    console.error('[Firebase] Load error:', err.message);
    return null;
  }
}

/**
 * Real-time listener for Cloud Firestore - Compat SDK
 */
function setupRealtimeSync(collectionName, callback) {
  if (!isFirebaseReady) return;

  try {
    db.collection(collectionName)
      .doc(collectionName)
      .onSnapshot((doc) => {
        if (doc.exists()) {
          callback(doc.data());
        }
      });
  } catch (err) {
    console.error('[Firebase] Real-time sync error:', err);
  }
}

/**
 * Delete data from Cloud - Compat SDK
 */
async function deleteFromCloud(collectionName) {
  if (!isFirebaseReady) return false;

  try {
    await db.collection(collectionName).doc(collectionName).delete();
    console.log('[Firebase] ✅ ลบสำเร็จ:', collectionName);
    return true;
  } catch (err) {
    console.error('[Firebase] Delete error:', err);
    return false;
  }
}

// Initialize Firebase when script loads
initializeFirebase().catch(err => {
  console.error('[Firebase] Initialization failed:', err);
});
