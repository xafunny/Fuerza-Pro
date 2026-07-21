/*
  Fuerza Pro — js/profile.js
  Perfil del usuario. ARREGLO de la foto de perfil: ahora se sube el archivo
  directamente (se comprime y guarda en Firestore) y se ve en toda la app.
  Ya no hay que subirla a imgur y pegar un link.
*/
import { S } from './state.js';
import { $, esc, calcAge, avatarHtml, fileToCompressedB64 } from './utils.js';
import { db, doc, getDoc, save } from './db.js';

let pendingAvatarB64 = null;

export function loadProfileFields(data) {
  $('pNombre').value   = data.nombre||'';
  $('pApellido').value = data.apellido||'';
  $('pFecha').value    = data.fechaNac||'';
  $('pTel').value      = data.telefono||'';
  $('pCiudad').value   = data.ciudad||'';
  $('pObjetivo').value = data.objetivo||'';
  updateHeaderAvatar(data.avatarB64||data.avatarUrl||'', data.nombre||S.USERNAME);
  const pav = $('profileAvatar');
  if (pav) pav.innerHTML = avatarHtml(pendingAvatarB64||data.avatarB64||data.avatarUrl||'', data.nombre||S.USERNAME, 84);
  renderProfileCard(data);
}

export function renderProfile() {
  getDoc(doc(db,'usuarios',S.UID)).then(snap => { if (snap.exists()) loadProfileFields(snap.data()); });
}

function renderProfileCard(data) {
  const card = $('profileInfoCard'); if (!card) return;
  const edad = data.fechaNac ? calcAge(data.fechaNac) : '—';
  card.innerHTML = `<div class="pcard">
    <div class="pcard-av">${avatarHtml(data.avatarB64||data.avatarUrl||'', data.nombre||S.USERNAME, 60)}</div>
    <div class="pcard-info">
      <div class="pcard-name">${esc(data.nombre||'')} ${esc(data.apellido||'')}</div>
      <div class="pcard-meta">${edad!=='—'?`${edad} años · `:''}${esc(data.ciudad||'')}</div>
      ${data.gender?`<span class="utag">${esc(data.gender)}</span>`:''}
      ${data.level?`<span class="utag">${esc(data.level)}</span>`:''}
      ${(data.goals||[]).map(g=>`<span class="utag">${esc(g)}</span>`).join('')}
    </div></div>`;
}

export function updateHeaderAvatar(src, name) {
  const el = $('headerAvatar');
  if (el) el.innerHTML = avatarHtml(src, name, 28);
}

/* Subida real de la foto de perfil */
window.onAvatarFile = async input => {
  const file = input.files?.[0];
  input.value = '';
  if (!file) return;
  try {
    pendingAvatarB64 = await fileToCompressedB64(file, 256, 120000);
    $('profileAvatar').innerHTML = avatarHtml(pendingAvatarB64, $('pNombre').value||S.USERNAME, 84);
    alert('Foto lista. Pulsa "Guardar cambios" para confirmarla.');
  } catch(e) { alert(e.message||'No se pudo procesar la imagen.'); }
};

window.saveProfile = async () => {
  const data = {
    nombre:   $('pNombre').value.trim(),
    apellido: $('pApellido').value.trim(),
    fechaNac: $('pFecha').value,
    edad:     calcAge($('pFecha').value),
    telefono: $('pTel').value.trim(),
    ciudad:   $('pCiudad').value.trim(),
    objetivo: $('pObjetivo').value.trim()
  };
  if (pendingAvatarB64) { data.avatarB64 = pendingAvatarB64; data.avatarUrl = ''; }
  await save(data);
  pendingAvatarB64 = null;
  alert('Perfil guardado correctamente.');
};
