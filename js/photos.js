/*
  Fuerza Pro — js/photos.js
  Fotos de avances — 100% PRIVADAS.

  Cómo funciona la privacidad:
  - Cada foto se guarda comprimida (base64) en la subcolección
    usuarios/{tuUID}/fotosProgreso de Firestore.
  - Las reglas del servidor (firestore.rules) solo permiten leer y escribir
    esa subcolección al DUEÑO de la cuenta. Ni siquiera el administrador
    puede verlas. Esto se aplica en el servidor de Google, no en el
    navegador, así que no se puede saltar modificando el código.
*/
import { S } from './state.js';
import { $, esc, formatDate, today, genId, fileToCompressedB64 } from './utils.js';
import { db, doc, setDoc, getDocs, deleteDoc, collection } from './db.js';

let photos = [];

window.renderProgressPhotos = async () => {
  const grid = $('photosGrid');
  grid.innerHTML = '<p class="tmuted">Cargando...</p>';
  try {
    const snap = await getDocs(collection(db,'usuarios',S.UID,'fotosProgreso'));
    photos = snap.docs.map(d => ({ id:d.id, ...d.data() }))
      .sort((a,b) => (b.date||'').localeCompare(a.date||''));
  } catch(e) { console.error(e); grid.innerHTML='<p class="tmuted">Error al cargar tus fotos.</p>'; return; }
  if (!photos.length) {
    grid.innerHTML = '<div class="empty"><p>Aún no has subido fotos de tu progreso.</p></div>';
    return;
  }
  grid.innerHTML = `<div class="photos-grid">` + photos.map(p => `
    <div class="photo-card">
      <img src="${esc(p.b64)}" loading="lazy" onclick="viewPhoto('${p.id}')"/>
      <div class="photo-meta">
        <span>${formatDate(p.date)}</span>
        <button class="bi danger" onclick="deleteProgressPhoto('${p.id}')">✕</button>
      </div>
      ${p.nota?`<div class="photo-note">${esc(p.nota)}</div>`:''}
    </div>`).join('') + `</div>`;
};

window.onProgressPhotoFile = async input => {
  const file = input.files?.[0];
  input.value = '';
  if (!file) return;
  const nota = prompt('Nota opcional para esta foto (peso, etapa, etc.):') || '';
  try {
    $('photosGrid').insertAdjacentHTML('afterbegin','<p class="tmuted" id="phUp">Subiendo foto...</p>');
    const b64 = await fileToCompressedB64(file, 900, 750000);
    const id = genId();
    await setDoc(doc(db,'usuarios',S.UID,'fotosProgreso',id), { b64, nota, date: today() });
    window.renderProgressPhotos();
  } catch(e) {
    document.getElementById('phUp')?.remove();
    alert(e.message || 'No se pudo subir la foto.');
  }
};

window.deleteProgressPhoto = async id => {
  if (!confirm('¿Eliminar esta foto?')) return;
  await deleteDoc(doc(db,'usuarios',S.UID,'fotosProgreso',id));
  window.renderProgressPhotos();
};

window.viewPhoto = id => {
  const p = photos.find(x => x.id === id); if (!p) return;
  $('photoViewImg').src = p.b64;
  $('photoViewMeta').textContent = `${formatDate(p.date)}${p.nota?' · '+p.nota:''}`;
  $('ovPhotoView').classList.add('open');
};
window.closePhotoView = () => $('ovPhotoView').classList.remove('open');
