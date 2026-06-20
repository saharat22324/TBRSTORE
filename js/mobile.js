/* ============================================================
   MOBILE.JS — Mobile & Touch Optimization
   TBR Service Center System
   ============================================================ */

/* ── Detect device type ── */
const isMobile = () => /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
const isTablet = () => /iPad|Android/i.test(navigator.userAgent) && window.innerWidth >= 600;

/* ── Device info ── */
const device = {
  type: isMobile() ? (isTablet() ? 'tablet' : 'phone') : 'desktop',
  isTouchDevice: () => (('ontouchstart' in window) || (navigator.maxTouchPoints > 0) || (navigator.msMaxTouchPoints > 0)),
  viewport: () => ({
    width: window.innerWidth,
    height: window.innerHeight,
    isPortrait: window.innerHeight > window.innerWidth
  })
};

/* ── Add touch-friendly class to body ── */
if (device.isTouchDevice()) {
  document.body.classList.add('touch-device');
}

/* ── Add viewport class ── */
function updateViewportClass() {
  const vp = device.viewport();
  document.body.classList.remove('mobile', 'tablet', 'desktop');
  document.body.classList.add(device.type);
  
  if (vp.isPortrait) {
    document.body.classList.add('portrait');
    document.body.classList.remove('landscape');
  } else {
    document.body.classList.add('landscape');
    document.body.classList.remove('portrait');
  }
}

/* ── Update on resize ── */
window.addEventListener('resize', updateViewportClass);
window.addEventListener('orientationchange', () => {
  setTimeout(updateViewportClass, 100);
});

/* ── Initialize on load ── */
updateViewportClass();

/* ── Prevent double tap zoom on buttons ── */
function setupTapHandling() {
  const buttons = document.querySelectorAll('button, a, [role="button"]');
  buttons.forEach(btn => {
    let lastTap = 0;
    btn.addEventListener('touchend', (e) => {
      const now = Date.now();
      if (now - lastTap < 300) e.preventDefault();
      lastTap = now;
    }, false);
  });
}

/* ── Safe area for notch devices ── */
function setupSafeArea() {
  const style = document.createElement('style');
  style.textContent = `
    @supports(padding: max(0px)) {
      body {
        padding-left: max(12px, env(safe-area-inset-left));
        padding-right: max(12px, env(safe-area-inset-right));
        padding-top: max(12px, env(safe-area-inset-top));
        padding-bottom: max(12px, env(safe-area-inset-bottom));
      }
    }
  `;
  document.head.appendChild(style);
}

setupSafeArea();

/* ── Enhanced touch feedback ── */
document.addEventListener('touchstart', function() {}, false);

/* ── Improve form inputs on mobile ── */
function improveFormInputs() {
  const inputs = document.querySelectorAll('input[type="email"], input[type="password"], input[type="text"]');
  inputs.forEach(input => {
    input.addEventListener('focus', () => {
      // Auto-focus textarea on mobile for better UX
      setTimeout(() => {
        input.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 300);
    });
  });
}

/* ── Initialize improvements ── */
if (device.type !== 'desktop') {
  setupTapHandling();
  improveFormInputs();
  
  // Prevent pinch-zoom on input focus
  document.addEventListener('touchmove', function(e) {
    if (e.touches.length > 1) {
      e.preventDefault();
    }
  }, false);
}

/* ── Export device info for other modules ── */
if (typeof window !== 'undefined') {
  window.deviceInfo = device;
}
