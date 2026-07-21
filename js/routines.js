/*
  Fuerza Pro — js/routines.js
  Rutinas guardadas (plantillas). ARREGLO: ahora se pueden VER por días
  (botón "Ver") antes de aplicar; antes solo se podían aplicar a ciegas.
*/
import { S, DAYS } from './state.js';
import { $, esc, today, genId } from './utils.js';
import { db, doc, getDoc, getDocs, setDoc, deleteDoc, collection, save } from './db.js';
import { renderDaysNav, renderExercises, updateWeekBar } from './exercises.js';

window.openSaveRoutineModal = async () => {
  const sel = $('routineUserSel');
  if (S.isAdmin) {
    const { getAdminUsers } = await import('./admin.js');
    const users = await getAdminUsers();
    sel.innerHTML = `<option value="${S.UID}">${esc(S.USERNAME)} (yo)</option>` +
      users.map(u=>`<option value="${u.uid}">${esc(u.username)}</option>`).join('');
  } else {
    sel.innerHTML = `<option value="${S.UID}">${esc(S.USERNAME)} (yo)</option>`;
  }
  $('ovSaveRoutine').classList.add('open');
};
window.closeSaveRoutineModal = () => $('ovSaveRoutine').classList.remove('open');

window.saveRoutine = async () => {
  const name  = $('routineName').value.trim();
  const scope = document.querySelector('input[name="routineScope"]:checked')?.value;
  const uid   = $('routineUserSel').value;
  if (!name) { alert('Ingresa un nombre.'); return; }
  const snap = await getDoc(doc(db,'usuarios',uid));
  const exs = snap.data()?.exercises||[];
  const toSave = scope==='day' ? exs.filter(e=>e.day===S.currentDay) : exs;
  if (!toSave.length) { alert('No hay ejercicios para guardar.'); return; }
  const id = genId();
  await setDoc(doc(db,'rutinas',id), { id, name, scope,
    day: scope==='day'?S.currentDay:null, exercises: toSave, createdAt: today(), creador: S.USERNAME });
  window.closeSaveRoutineModal();
  alert(`Rutina "${name}" guardada.`);
};

window.openSavedRoutinesModal = async () => {
  const snap = await getDocs(collection(db,'rutinas'));
  const list = $('savedRoutinesList');
  $('routineDetail').classList.add('hidden');
  list.classList.remove('hidden');
  list.innerHTML = snap.empty
    ? '<p class="tmuted">No hay rutinas guardadas.</p>'
    : snap.docs.map(d => {
        const r = d.data();
        return `<div class="rrow">
          <div><div class="rname">${esc(r.name)}</div>
          <div class="rmeta">${r.scope==='day'?esc(r.day):'Semana completa'} · ${r.exercises?.length||0} ejercicios · ${esc(r.createdAt||'')}</div></div>
          <div style="display:flex;gap:6px;flex-wrap:wrap">
            <button class="btn-sm" onclick="viewRoutine('${d.id}')">Ver</button>
            <button class="btn-sm" onclick="applyRoutine('${d.id}')">Aplicar</button>
            ${S.isAdmin?`<button class="btn-sm danger" onclick="deleteRoutine('${d.id}')">Eliminar</button>`:''}
          </div></div>`;
      }).join('');
  $('ovSavedRoutines').classList.add('open');
};
window.closeSavedRoutinesModal = () => $('ovSavedRoutines').classList.remove('open');

/* ── Ver detalle por días (ARREGLADO) ── */
window.viewRoutine = async id => {
  const snap = await getDoc(doc(db,'rutinas',id));
  if (!snap.exists()) return;
  const r = snap.data();
  const det = $('routineDetail');
  const byDay = DAYS.map(day => ({ day, exs:(r.exercises||[]).filter(e=>e.day===day) })).filter(x=>x.exs.length);
  det.innerHTML = `
    <button class="link-btn" onclick="backToRoutineList()">← Volver a la lista</button>
    <h3 class="ssub" style="margin:8px 0">${esc(r.name)}</h3>
    ${byDay.map(({day,exs}) => `
      <div style="margin-bottom:10px">
        <div style="font-size:.74rem;font-weight:600;color:var(--acc);text-transform:uppercase;margin-bottom:4px">${day} · ${exs.length}</div>
        ${exs.map(ex=>`<div class="hrow" style="padding:6px 10px">
          <span style="flex:1;font-size:.8rem">${esc(ex.name)}</span>
          ${ex.sets||ex.reps?`<span class="utag">${esc(ex.sets||'?')}×${esc(ex.reps||'?')}</span>`:''}
          ${ex.rest?`<span class="utag">${esc(ex.rest)}</span>`:''}
        </div>`).join('')}
      </div>`).join('')}
    <button class="btn-primary" onclick="applyRoutine('${id}')">Aplicar esta rutina</button>`;
  $('savedRoutinesList').classList.add('hidden');
  det.classList.remove('hidden');
};
window.backToRoutineList = () => window.openSavedRoutinesModal();

window.applyRoutine = async id => {
  const snap = await getDoc(doc(db,'rutinas',id));
  if (!snap.exists()) return;
  const r = snap.data();
  const exs = (r.exercises||[]).map(e => ({ ...e, id: genId() }));
  S.exercises = [...S.exercises, ...exs];
  await save({ exercises: S.exercises });
  window.closeSavedRoutinesModal();
  renderDaysNav(); renderExercises(); updateWeekBar();
  alert(`Rutina "${r.name}" aplicada.`);
};

window.deleteRoutine = async id => {
  if (!confirm('¿Eliminar esta rutina?')) return;
  await deleteDoc(doc(db,'rutinas',id));
  window.openSavedRoutinesModal();
};
