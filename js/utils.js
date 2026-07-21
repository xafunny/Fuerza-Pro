/*
  Fuerza Pro — js/utils.js
  Funciones auxiliares compartidas.
*/

export const $ = id => document.getElementById(id);

/*
  esc() — SEGURIDAD (anti-XSS).
  Todo texto escrito por un usuario que se inserte en innerHTML
  DEBE pasar por esta función. Antes la app insertaba nombres, notas,
  etc. sin escapar: un usuario podía inyectar HTML/JS en la vista del admin.
*/
export const esc = s => String(s ?? '')
  .replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')
  .replaceAll('"','&quot;').replaceAll("'",'&#39;');

export const today = () => new Date().toISOString().split('T')[0];
export const cap   = s => s.charAt(0).toUpperCase() + s.slice(1);
export const show  = (el,msg) => { el.textContent = msg; el.classList.remove('hidden'); };
export const hide  = el => el.classList.add('hidden');
export const genId = () => Date.now().toString(36) + Math.random().toString(36).slice(2,8);

export const formatDate = d => {
  if (!d) return '—';
  const [y,m,day] = d.split('-');
  return `${parseInt(day)} ${['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'][parseInt(m)-1]} ${y}`;
};

export const calcAge = fecha => {
  if (!fecha) return null;
  const n = new Date(), b = new Date(fecha + 'T00:00:00');
  let a = n.getFullYear() - b.getFullYear();
  if (n.getMonth() < b.getMonth() || (n.getMonth() === b.getMonth() && n.getDate() < b.getDate())) a--;
  return a;
};

export const authMsg = code => ({
  'auth/email-already-in-use':'Ese correo ya está registrado.',
  'auth/invalid-email':'Correo inválido.',
  'auth/weak-password':'Contraseña: mínimo 6 caracteres.',
  'auth/user-not-found':'No existe una cuenta con ese correo.',
  'auth/wrong-password':'Correo o contraseña incorrectos.',
  'auth/invalid-credential':'Correo o contraseña incorrectos.',
  'auth/too-many-requests':'Demasiados intentos. Espera unos minutos.'
}[code] || 'Error inesperado. Intenta de nuevo.');

/*
  Comprime una imagen a base64 (JPEG) para guardarla en Firestore
  sin necesitar Firebase Storage (que ya no es gratuito en proyectos nuevos).
  maxSide: lado máximo en px. Baja la calidad hasta caber en maxChars.
*/
export function fileToCompressedB64(file, maxSide = 800, maxChars = 700000) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith('image/')) { reject(new Error('Archivo no es una imagen')); return; }
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
      const cv = document.createElement('canvas');
      cv.width  = Math.round(img.width  * scale);
      cv.height = Math.round(img.height * scale);
      cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
      let q = 0.8, out = cv.toDataURL('image/jpeg', q);
      while (out.length > maxChars && q > 0.25) { q -= 0.1; out = cv.toDataURL('image/jpeg', q); }
      if (out.length > maxChars) { reject(new Error('Imagen demasiado grande, usa una más pequeña.')); return; }
      resolve(out);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('No se pudo leer la imagen')); };
    img.src = url;
  });
}

/* Avatar: soporta base64 (nuevo) y URL (heredado) */
export function avatarHtml(src, name, size) {
  const init = esc((name || 'U').charAt(0).toUpperCase());
  const style = `width:${size}px;height:${size}px`;
  if (src) {
    return `<div class="av" style="${style}"><img src="${esc(src)}" style="width:100%;height:100%;object-fit:cover;border-radius:50%" onerror="this.parentElement.textContent='${init}'"/></div>`;
  }
  return `<div class="av av-init" style="${style};font-size:${Math.round(size*0.42)}px">${init}</div>`;
}
