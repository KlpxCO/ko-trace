const $ = id => document.getElementById(id);
const video = $('camera'), message = $('cameraMessage'), frame = $('imageFrame'), image = $('overlayImage');
const filePicker = $('filePicker'), opacity = $('opacity'), opacityValue = $('opacityValue');
let stream = null, facing = 'environment', locked = false, flipX = false, flipY = false;
let x = 0, y = 0, dragging = false, startX = 0, startY = 0, baseX = 0, baseY = 0, toastTimer;
let zoom = 1, pointers = new Map(), pinchStartDistance = 0, pinchStartZoom = 1;

function toast(text) {
  const el = $('toast'); el.textContent = text; el.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), 2300);
}
function updateTransform() { image.style.transform = `scale(${flipX ? -1 : 1}, ${flipY ? -1 : 1})`; }
function updateZoom() { frame.style.transform = `translate(-50%, -50%) scale(${zoom})`; }
function pointerDistance(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
function updatePosition() {
  frame.style.left = `calc(50% + ${x}px)`;
  frame.style.top = `calc(50% + ${y}px)`;
}
async function startCamera() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    toast('No se pudo acceder a la cámara en este dispositivo.'); return;
  }
  try {
    if (stream) stream.getTracks().forEach(track => track.stop());
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: facing } }, audio: false });
    video.srcObject = stream;
    await video.play();
    message.classList.add('hidden');
    $('cameraStatus').textContent = facing === 'environment' ? 'CÁMARA TRASERA ACTIVA' : 'CÁMARA FRONTAL ACTIVA';
    document.querySelector('.live-dot').classList.add('active');
    toast(facing === 'environment' ? 'Cámara trasera activada' : 'Cámara frontal activada');
  } catch (err) {
    console.error(err);
    toast('No se pudo abrir la cámara. Revisa los permisos de Android.');
  }
}
$('startCamera').addEventListener('click', startCamera);
$('switchCamera').addEventListener('click', async () => {
  facing = facing === 'environment' ? 'user' : 'environment';
  await startCamera();
});
$('chooseImage').addEventListener('click', () => filePicker.click());
filePicker.addEventListener('change', () => {
  const file = filePicker.files && filePicker.files[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) { toast('Selecciona un archivo de imagen.'); return; }
  const url = URL.createObjectURL(file);
  image.onload = () => {
    frame.classList.remove('hidden');
    $('imageStatus').textContent = 'IMAGEN LISTA';
    $('lockImage').disabled = false; $('flipH').disabled = false; $('flipV').disabled = false;
    locked = false; frame.classList.remove('locked');
    $('lockImage').classList.remove('active'); $('lockImage').innerHTML = '<span class="button-symbol">⌑</span> Bloquear';
    x = 0; y = 0; zoom = 1; pointers.clear(); dragging = false; flipX = false; flipY = false;
    updatePosition(); updateTransform(); updateZoom(); applyOpacity();
    toast('Imagen cargada. Arrástrala para colocarla.');
  };
  image.onerror = () => toast('No se pudo cargar esa imagen.');
  image.src = url;
  filePicker.value = '';
});
function applyOpacity() {
  const value = Number(opacity.value);
  image.style.opacity = String(value / 100);
  opacityValue.innerHTML = `${value}<span>%</span>`;
}
opacity.addEventListener('input', applyOpacity);
$('lockImage').addEventListener('click', () => {
  if (frame.classList.contains('hidden')) return;
  locked = !locked;
  frame.classList.toggle('locked', locked);
  $('lockImage').classList.toggle('active', locked);
  $('lockImage').innerHTML = locked ? '<span class="button-symbol">🔒</span> Desbloquear' : '<span class="button-symbol">⌑</span> Bloquear';
  toast(locked ? 'Imagen bloqueada' : 'Imagen desbloqueada');
});
$('flipH').addEventListener('click', () => { flipX = !flipX; updateTransform(); toast('Volteo horizontal aplicado'); });
$('flipV').addEventListener('click', () => { flipY = !flipY; updateTransform(); toast('Volteo vertical aplicado'); });

function setTheme(theme) {
  document.body.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]').setAttribute('content', theme === 'light' ? '#f4f5f2' : '#101116');
  $('darkTheme').classList.toggle('active', theme === 'dark');
  $('lightTheme').classList.toggle('active', theme === 'light');
  try { localStorage.setItem('ko-trace-theme', theme); } catch (_) {}
}
try { setTheme(localStorage.getItem('ko-trace-theme') || 'dark'); } catch (_) { setTheme('dark'); }
$('darkTheme').addEventListener('click', () => setTheme('dark'));
$('lightTheme').addEventListener('click', () => setTheme('light'));
const panel = $('settingsPanel'), backdrop = $('settingsBackdrop');
function openSettings() {
  panel.classList.add('open'); panel.setAttribute('aria-hidden', 'false');
  backdrop.classList.remove('hidden'); document.body.style.overflow = 'hidden';
}
function closeSettings() {
  panel.classList.remove('open'); panel.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
  setTimeout(() => backdrop.classList.add('hidden'), 260);
}
$('settingsOpen').addEventListener('click', openSettings);
$('settingsClose').addEventListener('click', closeSettings);
backdrop.addEventListener('click', closeSettings);
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeSettings(); });

frame.addEventListener('pointerdown', e => {
  if (locked) return;
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  try { frame.setPointerCapture(e.pointerId); } catch (_) {}
  if (pointers.size === 2) {
    const pts = [...pointers.values()];
    pinchStartDistance = pointerDistance(pts[0], pts[1]);
    pinchStartZoom = zoom;
    dragging = false;
  } else if (pointers.size === 1) {
    dragging = true; startX = e.clientX; startY = e.clientY; baseX = x; baseY = y;
  }
  e.preventDefault();
});
frame.addEventListener('pointermove', e => {
  if (!pointers.has(e.pointerId) || locked) return;
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pointers.size >= 2) {
    const pts = [...pointers.values()];
    const distance = pointerDistance(pts[0], pts[1]);
    if (pinchStartDistance > 0) {
      zoom = Math.max(0.35, Math.min(3.5, pinchStartZoom * distance / pinchStartDistance));
      updateZoom();
    }
    dragging = false;
  } else if (dragging) {
    x = baseX + e.clientX - startX; y = baseY + e.clientY - startY;
    updatePosition();
  }
});
function stopDrag(e) {
  pointers.delete(e.pointerId);
  if (pointers.size === 1) {
    const remaining = [...pointers.values()][0];
    startX = remaining.x; startY = remaining.y; baseX = x; baseY = y;
    dragging = true;
  } else {
    dragging = false;
    pinchStartDistance = 0;
  }
}
frame.addEventListener('pointerup', stopDrag);
frame.addEventListener('pointercancel', stopDrag);
frame.addEventListener('lostpointercapture', e => {
  if (pointers.has(e.pointerId)) stopDrag(e);
});
document.addEventListener('visibilitychange', () => {
  // Android puede suspender la cámara al cambiar de aplicación.
});
applyOpacity();
