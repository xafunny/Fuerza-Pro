/*
  Fuerza Pro — js/groups.js
  Grupos de usuarios (solo admin).
  - Grupos manuales: nombre + miembros elegidos.
  - Grupos automáticos: detecta qué ejercicios comparten 2 o más usuarios
    y arma los grupos por ejercicio con un clic.
*/
import { S } from './state.js';
import { $, esc, genId, today } from './utils.js';
import { db, doc, setDoc, getDocs, deleteDoc, collection } from './db.js';

export async function renderGroups() {
  const el = $('groupsPanel'); if (!el) return;
  let snap;
  try { snap = await getDocs(collection(db,'grupos')); }
  catch(e) { el.innerHTML = '<p class="tmuted">Sin acceso a grupos.</p>'; return; }
  if (snap.empty) { el.innerHTML = '<p class="tmuted">No hay grupos creados aún.</p>'; return; }
  el.innerHTML = snap.docs.map(d => {
    const g = d.data();
    return `<div class="grp-card">
      <div class="grp-head">
        <div><div class="grp-name">${esc(g.name)}</div>
        <div class="tmuted" style="font-size:.72rem">${g.auto?'Automático por ejercicio':'Manual'} · ${g.miembros?.length||0} miembros · ${esc(g.creado||'')}</div></div>
        <button class="btn-sm danger" onclick="deleteGroup('${d.id}')">✕</button>
      </div>
      <div class="utags" style="margin-top:6px">${(g.miembros||[]).map(m=>`<span class="utag">${esc(m.username||m)}</span>`).join('')}</div>
    </div>`;
  }).join('');
}

window.openGroupModal = async () => {
  const { getAdminUsers } = await import('./admin.js');
  const users = await getAdminUsers();
  const all = [{ uid:S.UID, username:S.USERNAME }, ...users];
  $('groupMembers').innerHTML = all.map(u =>
    `<label class="radio-opt"><input type="checkbox" value="${u.uid}" data-name="${esc(u.username)}"/> ${esc(u.username)}</label>`).join('');
  $('groupName').value = '';
  $('ovGroup').classList.add('open');
};
window.closeGroupModal = () => $('ovGroup').classList.remove('open');

window.createGroup = async () => {
  const name = $('groupName').value.trim();
  if (!name) { alert('Ingresa un nombre para el grupo.'); return; }
  const miembros = [...document.querySelectorAll('#groupMembers input:checked')]
    .map(c => ({ uid:c.value, username:c.dataset.name }));
  if (miembros.length < 2) { alert('Selecciona al menos 2 miembros.'); return; }
  await setDoc(doc(db,'grupos',genId()), { name, miembros, auto:false, creado: today() });
  window.closeGroupModal();
  renderGroups();
};

window.deleteGroup = async id => {
  if (!confirm('¿Eliminar este grupo?')) return;
  await deleteDoc(doc(db,'grupos',id));
  renderGroups();
};

/* Grupos automáticos: agrupa por ejercicios que comparten ≥2 usuarios */
window.autoGroups = async () => {
  if (!confirm('Se crearán grupos automáticos por cada ejercicio que compartan 2 o más usuarios. ¿Continuar?')) return;
  const snap = await getDocs(collection(db,'usuarios'));
  const map = {}; /* nombreEjercicio -> [{uid,username}] */
  snap.docs.forEach(d => {
    const data = d.data();
    const names = [...new Set((data.exercises||[]).map(e => (e.name||'').trim().toLowerCase()).filter(Boolean))];
    names.forEach(n => {
      if (!map[n]) map[n] = [];
      map[n].push({ uid:d.id, username:data.username||d.id });
    });
  });
  let created = 0;
  for (const [name, users] of Object.entries(map)) {
    if (users.length < 2) continue;
    const nice = name.charAt(0).toUpperCase()+name.slice(1);
    await setDoc(doc(db,'grupos','auto_'+name.replace(/[^a-z0-9]/g,'_')), {
      name:`Ejercicio: ${nice}`, miembros:users, auto:true, creado: today() });
    created++;
  }
  alert(created ? `${created} grupos automáticos creados/actualizados.` : 'Ningún ejercicio es compartido por 2 o más usuarios todavía.');
  renderGroups();
};
