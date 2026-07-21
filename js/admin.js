/*
  Fuerza Pro — js/admin.js
  Panel de administración (solo visible y permitido para admins).
  - Lista de usuarios con datos personales y respuestas del cuestionario.
  - Ver y editar rutinas/dietas de cualquier usuario.
  - Dar / quitar rol de administrador (solo el dueño puede hacerlo).
  - Eliminar usuarios (borra sus datos y bloquea su correo).
  - Migrar datos de las cuentas antiguas ("jhoao"/"karen" que estaban
    escritas en el código) hacia cuentas reales con correo verificado.
  - Copiar rutina entre usuarios.
*/
import { S, DAYS, MEALS } from './state.js';
import { $, esc, calcAge, avatarHtml, formatDate, genId } from './utils.js';
import { OWNER_EMAIL } from './firebase-config.js';
import { db, doc, getDoc, setDoc, getDocs, deleteDoc, collection, saveUID } from './db.js';
import { buildCard } from './exercises.js';
import { renderGroups } from './groups.js';

export async function getAdminUsers() {
  try {
    const snap = await getDocs(collection(db,'usuarios'));
    return snap.docs.map(d => ({ uid:d.id, ...d.data() })).filter(u => u.uid !== S.UID);
  } catch(e) { console.error('Error cargando usuarios:', e); return []; }
}

export async function renderAdmin() {
  if (!S.isAdmin) return;
  S.allUsers = await getAdminUsers();
  window.filterUsers();
  const sel = $('adminSel');
  sel.innerHTML = '<option value="">— Seleccionar —</option>' +
    S.allUsers.map(u => `<option value="${u.uid}">${esc(u.username||u.uid)}${u.nombre?` (${esc(u.nombre)})`:''}</option>`).join('');
  const all = [{ uid:S.UID, username:S.USERNAME }, ...S.allUsers];
  ['copyFrom','copyTo'].forEach(id => {
    const el = $(id);
    if (el) el.innerHTML = all.map(u => `<option value="${u.uid}">${esc(u.username||u.uid)}</option>`).join('');
  });
  renderGroups();
  renderLegacyDocs();
}

window.filterUsers = () => {
  const q = ($('userSearch')?.value||'').toLowerCase();
  const panel = $('usersPanel');
  if (!panel) return;
  if (!S.allUsers.length) { panel.innerHTML = '<p class="tmuted">No hay usuarios registrados aún.</p>'; return; }
  const filtered = S.allUsers.filter(u =>
    (u.username||'').toLowerCase().includes(q) || (u.nombre||'').toLowerCase().includes(q));
  const masc = filtered.filter(u => u.gender==='Masculino');
  const fem  = filtered.filter(u => u.gender==='Femenino');
  const otros= filtered.filter(u => !u.gender);
  const grp = (title, users) => {
    if (!users.length) return '';
    return `<div class="ugrp"><div class="ugt">${title} <span class="ugc">${users.length}</span></div>` +
      users.map(u => `<div class="urow" style="cursor:pointer" onclick="document.getElementById('adminSel').value='${u.uid}';adminLoadUser()">
        <div class="uri">${avatarHtml(u.avatarB64||u.avatarUrl||'', u.nombre||u.username, 32)}
          <div><span class="urn">${esc(u.username||u.uid)}</span>${u.nombre?`<span class="urnf">${esc(u.nombre)} ${esc(u.apellido||'')}</span>`:''}</div></div>
        <div class="utags">
          ${u.role==='admin'?'<span class="utag" style="background:var(--acc);color:#fff">ADMIN</span>':''}
          ${u.gender?`<span class="utag">${esc(u.gender)}</span>`:''}
          ${u.edad||u.fechaNac?`<span class="utag">${u.edad||calcAge(u.fechaNac)} años</span>`:''}
          ${u.level?`<span class="utag">${esc(u.level)}</span>`:''}
        </div></div>`).join('') + `</div>`;
  };
  panel.innerHTML = grp('Masculino',masc) + grp('Femenino',fem) + grp('Sin clasificar',otros);
  if (!filtered.length) panel.innerHTML = '<p class="tmuted">No se encontraron usuarios.</p>';
};

window.adminLoadUser = async () => {
  const uid = $('adminSel').value;
  const panel = $('adminPanel');
  if (!uid) { panel.innerHTML=''; return; }
  const snap = await getDoc(doc(db,'usuarios',uid));
  if (!snap.exists()) { panel.innerHTML = '<p class="tmuted">Sin datos.</p>'; return; }
  const d = snap.data(), uname = d.username||uid;
  const esOwner = S.EMAIL === OWNER_EMAIL;
  panel.innerHTML = `
    <div class="auh">
      <div style="display:flex;align-items:center;gap:10px">${avatarHtml(d.avatarB64||d.avatarUrl||'', d.nombre||uname, 40)}
        <div><div class="aun">${esc(uname)} ${d.role==='admin'?'<span class="utag" style="background:var(--acc);color:#fff">ADMIN</span>':''}</div>
        ${d.nombre?`<div class="tmuted" style="font-size:.78rem">${esc(d.nombre)} ${esc(d.apellido||'')}</div>`:''}</div></div>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        <button class="btn-sm" onclick="adminOpenEx('${uid}')">+ Ejercicio</button>
        <button class="btn-sm" onclick="openMealModal('${S.currentDietDay}','${uid}')">+ Comida</button>
        ${esOwner?`<button class="btn-sm" onclick="toggleAdminRole('${uid}')">${d.role==='admin'?'Quitar admin':'Hacer admin'}</button>`:''}
      </div>
    </div>
    <div class="stabs" style="margin-bottom:12px">
      <button class="stab" onclick="adminShowInfo('${uid}')">📋 Datos</button>
      ${DAYS.map(day => { const n=(d.exercises||[]).filter(e=>e.day===day).length; return `<button class="stab" onclick="adminShowDay('${day}','${uid}')">${day}${n?` (${n})`:''}</button>`; }).join('')}
      <button class="stab" onclick="adminShowDiet('${uid}')">Dieta</button>
    </div>
    <div id="adminContent"></div>`;
  window.adminShowInfo(uid);
};

/* Datos personales + respuestas del cuestionario (solo lo ve el admin) */
window.adminShowInfo = async uid => {
  const snap = await getDoc(doc(db,'usuarios',uid));
  const d = snap.data()||{};
  const row = (l,v) => v ? `<div class="mtr"><span>${l}</span><span><strong>${esc(v)}</strong></span><span></span></div>` : '';
  $('adminContent').innerHTML = `<div class="med-table">
    ${row('Nombre completo', [d.nombre,d.apellido].filter(Boolean).join(' '))}
    ${row('Correo', d.email)}
    ${row('Teléfono', d.telefono)}
    ${row('Sexo', d.gender)}
    ${row('Edad', d.edad ? d.edad+' años' : (d.fechaNac ? calcAge(d.fechaNac)+' años' : ''))}
    ${row('Fecha de nacimiento', d.fechaNac ? formatDate(d.fechaNac) : '')}
    ${row('Ciudad', d.ciudad)}
    ${row('Nivel de actividad', d.level)}
    ${row('Días por semana', d.diasSemana)}
    ${row('Experiencia', d.experiencia)}
    ${row('Entrena en', d.lugarEntreno)}
    ${row('Lesiones', d.lesiones)}
    ${row('Objetivos', (d.goals||[]).join(', '))}
    ${row('Objetivo escrito', d.objetivo)}
    ${row('Cuenta creada', d.creadoEn ? d.creadoEn.split('T')[0] : '')}
  </div>
  <p class="tmuted mt8" style="font-size:.72rem">Las fotos de avances de los usuarios son privadas: ni siquiera el administrador puede verlas.</p>`;
};

window.adminShowDay = (day, uid) => {
  S.currentDay = day;
  getDoc(doc(db,'usuarios',uid)).then(snap => {
    const exs = (snap.data()?.exercises||[]).filter(e => e.day === day);
    const ac = $('adminContent');
    if (!exs.length) { ac.innerHTML = `<p class="tmuted">Sin ejercicios para ${day}.</p>`; return; }
    ac.innerHTML = `<div class="ex-grid">${exs.map((ex,i)=>buildCard(ex,i,exs.length,uid)).join('')}</div>`;
  });
};

window.adminShowDiet = async uid => {
  const snap = await getDoc(doc(db,'usuarios',uid));
  const mls = snap.data()?.meals||[];
  const ac = $('adminContent');
  ac.innerHTML = `<div class="stabs" style="margin-bottom:10px">${DAYS.map(d=>`<button class="stab${d===S.currentDietDay?' active':''}" onclick="adminSetDietDay('${d}','${uid}')">${d}</button>`).join('')}</div><div id="adminDietInner"></div>`;
  const inner = $('adminDietInner');
  const dayM = mls.filter(m => m.day === S.currentDietDay);
  if (!dayM.length) { inner.innerHTML = `<p class="tmuted">Sin comidas para ${S.currentDietDay}.</p>`; return; }
  let html = '';
  MEALS.forEach(time => {
    const tm = dayM.filter(m => m.time === time); if (!tm.length) return;
    html += `<div class="ms"><div class="msh"><span class="mst">${time}</span></div>${tm.map(m=>`<div class="mi-row"><div class="mi-body"><div class="mi-name">${esc(m.name)}</div></div><div class="mi-act"><button class="bi" onclick="editMeal('${m.id}','${uid}')">✎</button><button class="bi danger" onclick="deleteMeal('${m.id}','${uid}')">✕</button></div></div>`).join('')}</div>`;
  });
  inner.innerHTML = html;
};
/* ARREGLO: antes el onclick hacía `currentDietDay='X'` sobre una variable de
   módulo que no existía en window, por lo que el cambio de día no funcionaba. */
window.adminSetDietDay = (d, uid) => { S.currentDietDay = d; window.adminShowDiet(uid); };

window.adminOpenEx = uid => {
  $('fTargetUser').value = uid;
  $('fEditId').value = '';
  $('exModalTitle').textContent = 'Nuevo ejercicio';
  $('ovExercise').classList.add('open');
};

/* ── Dar / quitar admin (solo el dueño) ── */
window.toggleAdminRole = async uid => {
  if (S.EMAIL !== OWNER_EMAIL) { alert('Solo el administrador principal puede cambiar roles.'); return; }
  const snap = await getDoc(doc(db,'usuarios',uid));
  const d = snap.data()||{};
  const nuevo = d.role === 'admin' ? 'user' : 'admin';
  if (!confirm(`¿${nuevo==='admin'?'Dar':'Quitar'} permisos de administrador a "${d.username||uid}"?`)) return;
  await saveUID(uid, { role: nuevo });
  alert('Rol actualizado.');
  renderAdmin(); window.adminLoadUser();
};

/* ── Eliminar usuario ── */
window.deleteSelectedUser = async () => {
  const uid = $('adminSel').value;
  if (!uid) { alert('Selecciona un usuario primero.'); return; }
  const snap = await getDoc(doc(db,'usuarios',uid));
  const d = snap.data()||{};
  const uname = d.username||uid;
  if (!confirm(`¿Eliminar al usuario "${uname}" y todos sus datos? Su correo quedará bloqueado y no podrá volver a entrar.`)) return;
  /* Bloquear el correo para que no pueda re-entrar (la cuenta de Auth solo
     puede borrarse desde la consola de Firebase; ver LEEME.md) */
  if (d.email) await setDoc(doc(db,'bloqueados', d.email.toLowerCase().replaceAll('/','_')), { email:d.email, fecha:new Date().toISOString() });
  await deleteDoc(doc(db,'usuarios',uid));
  if (d.username) { try { await deleteDoc(doc(db,'usernames',d.username)); } catch(e) {} }
  alert(`Usuario "${uname}" eliminado y bloqueado.`);
  $('adminPanel').innerHTML='';
  await renderAdmin();
};

/* ── Migración de cuentas antiguas ──
   Antes jhoao y karen existían solo en el código y sus datos se guardaron en
   documentos con ID 'jhoao' y 'karen' (no un UID real de Firebase Auth).
   Esta herramienta copia esos datos a la cuenta real (ya registrada y
   verificada) que elijas, y luego elimina el documento antiguo. */
async function renderLegacyDocs() {
  const el = $('legacyPanel'); if (!el) return;
  const snap = await getDocs(collection(db,'usuarios'));
  const legacy = snap.docs.filter(d => d.id === (d.data().username||'') && d.id.length < 20);
  if (!legacy.length) { el.innerHTML = '<p class="tmuted">No hay cuentas antiguas por migrar. ✔</p>'; return; }
  const all = [{ uid:S.UID, username:S.USERNAME }, ...S.allUsers];
  el.innerHTML = legacy.map(d => `
    <div class="hrow" style="flex-wrap:wrap;gap:8px">
      <span style="flex:1"><strong>${esc(d.id)}</strong> (cuenta antigua)</span>
      <select class="fi" style="max-width:180px" id="mig-${esc(d.id)}">
        <option value="">Migrar a...</option>
        ${all.map(u=>`<option value="${u.uid}">${esc(u.username||u.uid)}</option>`).join('')}
      </select>
      <button class="btn-sm" onclick="migrateLegacy('${esc(d.id)}')">Migrar</button>
    </div>`).join('');
}

window.migrateLegacy = async legacyId => {
  const destUid = document.getElementById('mig-'+legacyId)?.value;
  if (!destUid) { alert('Selecciona la cuenta destino.'); return; }
  if (!confirm(`Se copiarán los ejercicios, dieta y progreso de "${legacyId}" a la cuenta seleccionada y se eliminará el documento antiguo. ¿Continuar?`)) return;
  const oldSnap = await getDoc(doc(db,'usuarios',legacyId));
  if (!oldSnap.exists()) { alert('No existe.'); return; }
  const oldD = oldSnap.data();
  const newSnap = await getDoc(doc(db,'usuarios',destUid));
  const newD = newSnap.data()||{};
  /* Combinar sin borrar lo que ya tenga la cuenta nueva */
  const merged = {
    exercises:   [...(newD.exercises||[]),   ...(oldD.exercises||[])],
    meals:       [...(newD.meals||[]),       ...(oldD.meals||[])],
    bodyData:    [...(newD.bodyData||[]),    ...(oldD.bodyData||[])].sort((a,b)=>(a.date||'').localeCompare(b.date||'')),
    medidasData: [...(newD.medidasData||[]), ...(oldD.medidasData||[])].sort((a,b)=>(a.date||'').localeCompare(b.date||''))
  };
  await saveUID(destUid, merged);
  await deleteDoc(doc(db,'usuarios',legacyId));
  alert(`Datos de "${legacyId}" migrados correctamente.`);
  renderAdmin();
};

/* ── Copiar rutina ── */
window.openCopyRoutine = async () => { await renderAdmin(); $('ovCopy').classList.add('open'); };
window.closeCopyRoutine = () => $('ovCopy').classList.remove('open');
window.executeCopyRoutine = async () => {
  const from = $('copyFrom').value, to = $('copyTo').value;
  if (!from || !to || from === to) { alert('Selecciona usuarios distintos.'); return; }
  const snapF = await getDoc(doc(db,'usuarios',from)), snapT = await getDoc(doc(db,'usuarios',to));
  if (!snapF.exists()) { alert('Usuario origen no encontrado.'); return; }
  const fromEx = (snapF.data().exercises||[]).map(e => ({ ...e, id: genId() }));
  const toEx = [...(snapT.data()?.exercises||[]), ...fromEx];
  await saveUID(to, { exercises: toEx });
  window.closeCopyRoutine();
  alert('Rutina copiada correctamente.');
};
