/*
  Fuerza Pro — js/exercises.js
  Rutina del día, tarjetas de ejercicio, biblioteca compartida y pesos.

  CAMBIOS:
  - Ahora TODOS los usuarios pueden agregar / editar / eliminar SUS PROPIOS
    ejercicios (antes solo el admin). El admin además puede editar los de otros.
  - Buscador en vivo: al escribir el nombre aparecen sugerencias de la
    biblioteca con su GIF; al elegir una (o si el nombre coincide) el GIF y el
    grupo muscular se cargan automáticamente.
  - Todo el texto de usuario se escapa con esc() (anti-XSS).
*/
import { S, DAYS } from './state.js';
import { $, esc, today, genId, formatDate } from './utils.js';
import { db, doc, getDoc, setDoc, save, saveUID } from './db.js';

/* ── Navegación de días ── */
export function renderDaysNav() {
  $('daysNav').innerHTML = DAYS.map(day => {
    const n = S.exercises.filter(e => e.day === day).length;
    return `<button class="dpill${day===S.currentDay?' active':''}" onclick="selDay('${day}')">${day}${n?`<span class="dc">${n}</span>`:''}</button>`;
  }).join('');
}

window.selDay = day => {
  S.currentDay = day;
  $('dayTitle').textContent = day.toUpperCase();
  renderDaysNav(); renderExercises();
};

/* ── Render de la lista ── */
export function renderExercises(exList, targetUID) {
  const list = $('exList');
  const src  = exList || S.exercises.filter(e => e.day === S.currentDay);
  if (!src.length) {
    list.innerHTML = `<div class="empty"><p>No hay ejercicios para <strong>${S.currentDay}</strong>.</p>
      <button class="btn-sm" onclick="openModal('${S.currentDay}')">Agregar ejercicio</button>
      <button class="btn-sm" onclick="openLibraryModal()" style="margin-left:6px">Biblioteca</button></div>`;
    return;
  }
  list.innerHTML = `<div class="ex-grid">${src.map((ex,i)=>buildCard(ex,i,src.length,targetUID)).join('')}</div>`;
}

export function buildCard(ex, idx, total, targetUID) {
  const isDone  = S.doneSet.includes(ex.id);
  /* Puede gestionar: su propia rutina siempre; la de otros solo si es admin */
  const canEdit = targetUID ? S.isAdmin : true;
  const wh      = ex.weightHistory || [];
  const lastW   = wh.length ? wh[wh.length-1] : null;
  const tu      = targetUID ? `,'${targetUID}'` : '';
  const gifHtml = ex.gif
    ? `<div class="cm"><img src="${esc(ex.gif)}" loading="lazy" alt="${esc(ex.name)}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"/><div class="cm-fb" style="display:none">${esc(ex.name.charAt(0).toUpperCase())}</div></div>`
    : `<div class="cm"><div class="cm-fb">${esc(ex.name.charAt(0).toUpperCase())}</div></div>`;
  return `<div class="ec">
    ${gifHtml}
    <div class="cb">
      ${ex.muscle?`<div class="ctag">${esc(ex.muscle)}</div>`:''}
      <div class="cn">${esc(ex.name)}</div>
      <div class="cmeta">
        ${ex.sets?`<span class="mi">${esc(ex.sets)} series</span>`:''}
        ${ex.reps?`<span class="mi">${esc(ex.reps)} reps</span>`:''}
        ${ex.rest?`<span class="mi">${esc(ex.rest)}</span>`:''}
        ${lastW?`<span class="mi wt">${esc(lastW.kg)} kg</span>`:''}
      </div>
      ${ex.notes?`<div class="cnotes">${esc(ex.notes)}</div>`:''}
    </div>
    <div class="cf">
      <button class="bdone${isDone?' on':''}" onclick="toggleDone('${ex.id}')">${isDone?'Completado':'Marcar hecho'}</button>
      <div class="ca-right">
        <button class="bi" onclick="openWeightModal('${ex.id}',${targetUID?`'${targetUID}'`:'null'})" title="Peso">kg</button>
        ${canEdit?`
        <button class="bi" onclick="editExercise('${ex.id}'${tu})" title="Editar">✎</button>
        ${idx>0?`<button class="bi" onclick="moveEx('${ex.id}','up'${tu})">↑</button>`:''}
        ${idx<total-1?`<button class="bi" onclick="moveEx('${ex.id}','down'${tu})">↓</button>`:''}
        <button class="bi danger" onclick="deleteExercise('${ex.id}'${tu})">✕</button>`:''}
      </div>
    </div>
  </div>`;
}

/* ── Barra de progreso semanal ── */
export function updateWeekBar() {
  const total = S.exercises.length;
  const done  = S.exercises.filter(e => S.doneSet.includes(e.id)).length;
  const pct   = total === 0 ? 0 : Math.round(done/total*100);
  $('wbFill').style.width = pct + '%';
  $('wbPct').textContent  = pct + '%';
}

window.toggleDone = async id => {
  S.doneSet.includes(id) ? S.doneSet = S.doneSet.filter(d=>d!==id) : S.doneSet.push(id);
  await save({ doneSet: S.doneSet });
};

window.confirmResetWeek = () => {
  if (!confirm('¿Resetear tu semana? Solo se desmarcan los ejercicios completados. Los pesos no se pierden.')) return;
  S.doneSet = [];
  save({ doneSet: [] });
};

/* ── CRUD ── */
window.deleteExercise = async (id, targetUID) => {
  if (!confirm('¿Eliminar este ejercicio?')) return;
  const uid = targetUID || S.UID;
  const snap = await getDoc(doc(db,'usuarios',uid));
  const d = snap.data();
  d.exercises = (d.exercises||[]).filter(e => e.id !== id);
  await saveUID(uid, { exercises: d.exercises });
  if (uid === S.UID) { S.exercises = d.exercises; renderDaysNav(); renderExercises(); updateWeekBar(); }
  else window.adminLoadUser();
};

window.editExercise = async (id, targetUID) => {
  const uid = targetUID || S.UID;
  const snap = await getDoc(doc(db,'usuarios',uid));
  const ex = (snap.data()?.exercises||[]).find(e => e.id === id);
  if (!ex) return;
  $('exModalTitle').textContent = 'Editar ejercicio';
  $('fName').value = ex.name||''; $('fDay').value = ex.day||'Lunes';
  $('fSets').value = ex.sets||''; $('fReps').value = ex.reps||'';
  $('fRest').value = ex.rest||''; $('fMuscle').value = ex.muscle||'';
  $('fGif').value  = ex.gif ||''; $('fNotes').value = ex.notes||'';
  $('fWeight').value=''; $('fEditId').value = id;
  $('fTargetUser').value = targetUID||'';
  $('ovExercise').classList.add('open');
};

window.moveEx = async (id, dir, targetUID) => {
  const uid = targetUID || S.UID;
  const snap = await getDoc(doc(db,'usuarios',uid));
  const d = snap.data(); const exs = d.exercises||[];
  const idx = exs.findIndex(e => e.id === id);
  const ni = dir==='up' ? idx-1 : idx+1;
  if (ni < 0 || ni >= exs.length) return;
  [exs[idx],exs[ni]] = [exs[ni],exs[idx]];
  await saveUID(uid, { exercises: exs });
  if (uid === S.UID) { S.exercises = exs; renderExercises(); }
  else window.adminLoadUser();
};

/* ── Modal de ejercicio ── */
window.openModal = day => {
  $('exModalTitle').textContent = 'Nuevo ejercicio';
  $('fDay').value = day || S.currentDay;
  $('fEditId').value=''; $('fTargetUser').value='';
  $('ovExercise').classList.add('open');
};
window.closeModal = () => {
  $('ovExercise').classList.remove('open');
  ['fName','fSets','fReps','fRest','fGif','fNotes','fWeight','fEditId','fTargetUser']
    .forEach(id => $(id).value='');
  $('fMuscle').value='';
  hideNameSuggest();
  resetGifPreview();
};

window.previewGif = () => {
  let url = $('fGif').value.trim();
  const p = $('gifPreview'), e = $('gifErr');
  e.classList.add('hidden');
  if (!url) return;
  if (url.includes('giphy.com/gifs/') && !url.endsWith('.gif')) {
    const parts = url.split('-'); const hash = parts[parts.length-1].split('/')[0];
    if (hash) { url = `https://media.giphy.com/media/${hash}/giphy.gif`; $('fGif').value = url; }
  }
  p.innerHTML = '<span>Cargando...</span>';
  const img = new Image(); img.src = url;
  img.onload  = () => { p.innerHTML=''; img.style.cssText='width:100%;height:100%;object-fit:cover;border-radius:6px'; p.appendChild(img); p.classList.add('has-img'); };
  img.onerror = () => { e.classList.remove('hidden'); p.classList.remove('has-img'); p.innerHTML='<span>No se pudo cargar</span>'; };
};

function resetGifPreview() {
  const p = $('gifPreview');
  p.innerHTML = '<span>Vista previa aquí</span>';
  p.classList.remove('has-img');
  $('gifErr').classList.add('hidden');
}

/* ── Buscador en vivo con GIF (biblioteca) ──
   Mientras el usuario escribe el nombre, se muestran coincidencias de la
   biblioteca con miniatura del GIF. Al elegir, se autocompleta GIF y músculo. */
function hideNameSuggest(){ const b = $('nameSuggest'); if (b){ b.classList.add('hidden'); b.innerHTML=''; } }

document.addEventListener('input', e => {
  if (e.target.id !== 'fName') return;
  const val = e.target.value.trim().toLowerCase();
  const box = $('nameSuggest');
  if (!box) return;
  if (val.length < 2) { hideNameSuggest(); autoFillFromLibrary(val); return; }
  const matches = S.exLibrary.filter(x => x.name.toLowerCase().includes(val)).slice(0,6);
  if (!matches.length) { hideNameSuggest(); return; }
  box.innerHTML = matches.map((x,i) => `
    <div class="sug-row" onclick="pickSuggestion(${S.exLibrary.indexOf(x)})">
      ${x.gif?`<img src="${esc(x.gif)}" class="sug-gif" loading="lazy" onerror="this.style.display='none'"/>`:'<div class="sug-gif ph"></div>'}
      <div class="sug-info"><span>${esc(x.name)}</span>${x.muscle?`<small>${esc(x.muscle)}</small>`:''}</div>
    </div>`).join('');
  box.classList.remove('hidden');
  autoFillFromLibrary(val);
});

function autoFillFromLibrary(val){
  const found = S.exLibrary.find(x => x.name.toLowerCase() === val);
  if (found) {
    if (found.gif    && !$('fGif').value)    { $('fGif').value = found.gif; window.previewGif(); }
    if (found.muscle && !$('fMuscle').value) $('fMuscle').value = found.muscle;
  }
}

window.pickSuggestion = i => {
  const x = S.exLibrary[i]; if (!x) return;
  $('fName').value = x.name;
  if (x.gif)    { $('fGif').value = x.gif; window.previewGif(); }
  if (x.muscle) $('fMuscle').value = x.muscle;
  hideNameSuggest();
};

/* ── Guardar ejercicio ── */
window.saveExercise = async () => {
  const name   = $('fName').value.trim();
  const day    = $('fDay').value;
  const editId = $('fEditId').value;
  const tUID   = $('fTargetUser').value || S.UID;
  if (!name) { alert('Ingresa el nombre del ejercicio.'); return; }
  if (tUID !== S.UID && !S.isAdmin) { alert('Solo el administrador puede editar rutinas de otros.'); return; }

  /* GIF automático: si el nombre ya existe en la biblioteca y no pusieron GIF */
  let gif = $('fGif').value.trim();
  let muscle = $('fMuscle').value;
  const lib = S.exLibrary.find(x => x.name.toLowerCase() === name.toLowerCase());
  if (lib) { if (!gif && lib.gif) gif = lib.gif; if (!muscle && lib.muscle) muscle = lib.muscle; }

  const snap = await getDoc(doc(db,'usuarios',tUID));
  const d = snap.data()||{}; const exs = d.exercises||[];
  const weight = parseFloat($('fWeight').value);
  const newEx = { name, day,
    sets: $('fSets').value, reps: $('fReps').value, rest: $('fRest').value,
    muscle, gif, notes: $('fNotes').value.trim() };

  if (editId) {
    const idx = exs.findIndex(e => e.id === editId);
    if (idx >= 0) {
      exs[idx] = { ...exs[idx], ...newEx };
      if (weight > 0) { if (!exs[idx].weightHistory) exs[idx].weightHistory = []; exs[idx].weightHistory.push({ kg:weight, date:today() }); }
    }
  } else {
    exs.push({ id: genId(), ...newEx, weightHistory: weight>0?[{kg:weight,date:today()}]:[] });
    await addToLibrary(newEx);
  }
  await saveUID(tUID, { exercises: exs });
  window.closeModal();
  if (tUID === S.UID) {
    S.exercises = exs; S.currentDay = day;
    $('dayTitle').textContent = day.toUpperCase();
    renderDaysNav(); renderExercises(); updateWeekBar();
  } else window.adminLoadUser();
};

/* ── Biblioteca compartida ── */
export async function loadExLibrary() {
  const snap = await getDoc(doc(db,'config','exLibrary'));
  S.exLibrary = snap.exists() ? (snap.data().items||[]) : [];
  renderExLibraryList();
}

export async function addToLibrary(ex) {
  if (!ex.name) return;
  const exists = S.exLibrary.find(e => e.name.toLowerCase() === ex.name.toLowerCase());
  if (exists) {
    /* Completar GIF/músculo si estaban vacíos */
    let changed = false;
    if (!exists.gif && ex.gif)       { exists.gif = ex.gif; changed = true; }
    if (!exists.muscle && ex.muscle) { exists.muscle = ex.muscle; changed = true; }
    if (changed) await setDoc(doc(db,'config','exLibrary'), { items: S.exLibrary }, { merge:true });
    return;
  }
  S.exLibrary.push({ name:ex.name, gif:ex.gif||'', muscle:ex.muscle||'' });
  await setDoc(doc(db,'config','exLibrary'), { items: S.exLibrary }, { merge:true });
  renderExLibraryList();
}

function renderExLibraryList() {
  const el = $('exLibraryList');
  if (!el) return;
  if (!S.exLibrary.length) {
    el.innerHTML = '<p class="tmuted">Aún no hay ejercicios en la biblioteca. Se agregan automáticamente al crear ejercicios nuevos.</p>';
    return;
  }
  el.innerHTML = S.exLibrary.map((ex,i)=>`
    <div class="lib-row">
      ${ex.gif?`<img src="${esc(ex.gif)}" class="lib-gif" loading="lazy" onerror="this.style.display='none'"/>`:'<div class="lib-gif-ph"></div>'}
      <div class="lib-info">
        <div class="lib-name">${esc(ex.name)}</div>
        ${ex.muscle?`<span class="utag">${esc(ex.muscle)}</span>`:''}
      </div>
      <div style="display:flex;gap:4px">
        <button class="btn-sm" onclick="useFromLibrary(${i})">Usar</button>
        ${S.isAdmin?`<button class="btn-sm danger" onclick="deleteFromLibrary(${i})">✕</button>`:''}
      </div>
    </div>`).join('');
}

window.useFromLibrary = i => {
  const ex = S.exLibrary[i];
  window.closeLibraryModal();
  window.openModal(S.currentDay);
  $('fName').value = ex.name;
  $('fGif').value = ex.gif||''; if (ex.gif) window.previewGif();
  $('fMuscle').value = ex.muscle||'';
};

window.deleteFromLibrary = async i => {
  if (!confirm(`¿Eliminar "${S.exLibrary[i].name}" de la biblioteca?`)) return;
  S.exLibrary.splice(i,1);
  await setDoc(doc(db,'config','exLibrary'), { items: S.exLibrary });
  renderExLibraryList();
};

window.openLibraryModal  = () => { renderExLibraryList(); $('ovLibrary').classList.add('open'); };
window.closeLibraryModal = () => $('ovLibrary').classList.remove('open');

/* ── Peso por ejercicio ── */
window.openWeightModal = async (id, targetUID) => {
  S.editWeightId = id;
  const uid = targetUID || S.UID;
  const snap = await getDoc(doc(db,'usuarios',uid));
  const ex = (snap.data()?.exercises||[]).find(e => e.id === id);
  if (!ex) return;
  $('wModalTitle').textContent = ex.name;
  $('wKg').value = '';
  $('ovWeight').dataset.tuid = targetUID||'';
  const wh = ex.weightHistory||[];
  $('wHistWrap').innerHTML = wh.length
    ? `<div class="wht">Historial</div><div class="whl">${[...wh].reverse().map((w,i)=>`<div class="whr"><span>${formatDate(w.date)}</span><span class="wkg">${esc(w.kg)} kg</span><button class="bi danger" onclick="deleteWeightEntry('${id}',${wh.length-1-i},'${targetUID||''}')">✕</button></div>`).join('')}</div>`
    : '<p class="tmuted" style="margin-bottom:12px">Sin registros de peso aún.</p>';
  $('ovWeight').classList.add('open');
};
window.closeWeightModal = () => { $('ovWeight').classList.remove('open'); S.editWeightId = null; };

window.saveWeight = async () => {
  const kg = parseFloat($('wKg').value);
  if (!kg || kg <= 0) { alert('Ingresa un peso válido.'); return; }
  const tuid = $('ovWeight').dataset.tuid || S.UID;
  const snap = await getDoc(doc(db,'usuarios',tuid));
  const d = snap.data();
  const ex = (d.exercises||[]).find(e => e.id === S.editWeightId);
  if (!ex) return;
  if (!ex.weightHistory) ex.weightHistory = [];
  ex.weightHistory.push({ kg, date: today() });
  await saveUID(tuid, { exercises: d.exercises });
  if (tuid === S.UID) S.exercises = d.exercises;
  window.closeWeightModal();
};

window.deleteWeightEntry = async (exId, idx, tuid) => {
  if (!confirm('¿Eliminar este registro?')) return;
  const uid = tuid || S.UID;
  const snap = await getDoc(doc(db,'usuarios',uid));
  const d = snap.data();
  const ex = (d.exercises||[]).find(e => e.id === exId);
  if (ex) { ex.weightHistory.splice(idx,1); await saveUID(uid, { exercises: d.exercises }); }
  window.openWeightModal(exId, tuid || null);
};

/* ── Mover / intercambiar días ── */
window.openMoveModal = async () => {
  $('moveFrom').value = S.currentDay;
  const sel = $('moveUserSel');
  if (S.isAdmin) {
    const { getAdminUsers } = await import('./admin.js');
    const users = await getAdminUsers();
    sel.innerHTML = `<option value="${S.UID}">${esc(S.USERNAME)} (yo)</option>` +
      users.map(u => `<option value="${u.uid}">${esc(u.username)}</option>`).join('');
    sel.parentElement.classList.remove('hidden');
  } else {
    sel.innerHTML = `<option value="${S.UID}">${esc(S.USERNAME)} (yo)</option>`;
    sel.parentElement.classList.add('hidden');
  }
  $('ovMove').classList.add('open');
};
window.closeMoveModal = () => $('ovMove').classList.remove('open');

window.executeMoveExercises = async () => {
  const from = $('moveFrom').value, to = $('moveTo').value;
  const action = document.querySelector('input[name="moveAction"]:checked')?.value;
  const uid = $('moveUserSel').value || S.UID;
  if (from === to) { alert('Selecciona días distintos.'); return; }
  const snap = await getDoc(doc(db,'usuarios',uid));
  let exs = snap.data()?.exercises||[];
  if (action === 'swap') {
    exs = exs.map(ex => ex.day===from ? {...ex,day:to} : ex.day===to ? {...ex,day:from} : ex);
  } else {
    exs = exs.map(ex => ex.day===from ? {...ex,day:to} : ex);
  }
  await saveUID(uid, { exercises: exs });
  if (uid === S.UID) S.exercises = exs;
  window.closeMoveModal(); renderDaysNav(); renderExercises();
  alert(`Ejercicios ${action==='swap'?'intercambiados':'movidos'} correctamente.`);
};
