/*
  Fuerza Pro — js/diet.js
  Plan de alimentación por día y tiempo de comida.
*/
import { S, DAYS, MEALS } from './state.js';
import { $, esc, genId } from './utils.js';
import { db, doc, getDoc, saveUID } from './db.js';

export function renderDietNav() {
  $('dietNav').innerHTML = DAYS.map(day => {
    const n = S.meals.filter(m => m.day === day).length;
    return `<button class="dpill${day===S.currentDietDay?' active':''}" onclick="selDietDay('${day}')">${day}${n?`<span class="dc">${n}</span>`:''}</button>`;
  }).join('');
  renderDietContent();
}
window.selDietDay = day => { S.currentDietDay = day; $('dietTitle').textContent = day.toUpperCase(); renderDietNav(); };

export function renderDietContent(mealList, tUID) {
  const cont = $('dietContent');
  const src  = (mealList||S.meals).filter(m => m.day === S.currentDietDay);
  const canEdit = tUID ? S.isAdmin : S.isAdmin; /* la dieta la gestiona el admin (entrenador) */
  if (!src.length) {
    cont.innerHTML = `<div class="empty"><p>No hay comidas para <strong>${S.currentDietDay}</strong>.</p>${canEdit?`<button class="btn-sm" onclick="openMealModal('${S.currentDietDay}')">Agregar comida</button>`:''}</div>`;
    return;
  }
  let html = '';
  MEALS.forEach(time => {
    const tm = src.filter(m => m.time === time); if (!tm.length) return;
    const tC = tm.reduce((s,m)=>s+(parseFloat(m.cal)||0),0);
    const tP = tm.reduce((s,m)=>s+(parseFloat(m.prot)||0),0);
    const tCa= tm.reduce((s,m)=>s+(parseFloat(m.carbs)||0),0);
    const tF = tm.reduce((s,m)=>s+(parseFloat(m.fat)||0),0);
    const tu = tUID?`,'${tUID}'`:'';
    html += `<div class="ms"><div class="msh"><span class="mst">${time}</span><div class="mmr">${tC?`<span class="mtag cal">${Math.round(tC)} kcal</span>`:''}${tP?`<span class="mtag prot">P: ${Math.round(tP)}g</span>`:''}${tCa?`<span class="mtag carbs">C: ${Math.round(tCa)}g</span>`:''}${tF?`<span class="mtag fat">G: ${Math.round(tF)}g</span>`:''}</div></div>${tm.map(m=>`<div class="mi-row"><div class="mi-body"><div class="mi-name">${esc(m.name)}${m.qty?` <span class="mi-qty">${esc(m.qty)}</span>`:''}</div><div class="mi-mac">${m.cal?`<span class="mtag sm cal">${esc(m.cal)} kcal</span>`:''}${m.prot?`<span class="mtag sm prot">P:${esc(m.prot)}g</span>`:''}${m.carbs?`<span class="mtag sm carbs">C:${esc(m.carbs)}g</span>`:''}${m.fat?`<span class="mtag sm fat">G:${esc(m.fat)}g</span>`:''}</div>${m.notes?`<div class="cnotes">${esc(m.notes)}</div>`:''}</div>${canEdit?`<div class="mi-act"><button class="bi" onclick="editMeal('${m.id}'${tu})">✎</button><button class="bi danger" onclick="deleteMeal('${m.id}'${tu})">✕</button></div>`:''}</div>`).join('')}</div>`;
  });
  cont.innerHTML = html;
}

window.openMealModal = (day, tUID) => {
  $('mealTitle').textContent = 'Nueva comida';
  $('mDay').value = day || S.currentDietDay;
  $('mEditId').value = ''; $('mTargetUser').value = tUID||'';
  $('ovMeal').classList.add('open');
};
window.closeMealModal = () => {
  $('ovMeal').classList.remove('open');
  ['mName','mQty','mCal','mProt','mCarbs','mFat','mNotes','mEditId','mTargetUser'].forEach(id=>$(id).value='');
};

window.editMeal = async (id, tUID) => {
  const uid = tUID || S.UID;
  const snap = await getDoc(doc(db,'usuarios',uid));
  const m = (snap.data()?.meals||[]).find(m => m.id === id); if (!m) return;
  $('mealTitle').textContent = 'Editar comida';
  $('mTime').value = m.time||'Desayuno'; $('mDay').value = m.day||S.currentDietDay;
  $('mName').value = m.name||''; $('mQty').value = m.qty||'';
  $('mCal').value = m.cal||''; $('mProt').value = m.prot||'';
  $('mCarbs').value = m.carbs||''; $('mFat').value = m.fat||'';
  $('mNotes').value = m.notes||'';
  $('mEditId').value = id; $('mTargetUser').value = tUID||'';
  $('ovMeal').classList.add('open');
};

window.deleteMeal = async (id, tUID) => {
  if (!confirm('¿Eliminar?')) return;
  const uid = tUID || S.UID;
  const snap = await getDoc(doc(db,'usuarios',uid));
  const d = snap.data();
  d.meals = (d.meals||[]).filter(m => m.id !== id);
  await saveUID(uid, { meals: d.meals });
  if (uid === S.UID) { S.meals = d.meals; renderDietNav(); } else window.adminShowDiet(uid);
};

window.saveMeal = async () => {
  const name = $('mName').value.trim();
  const tUID = $('mTargetUser').value || S.UID;
  if (!name) { alert('Ingresa el nombre del alimento.'); return; }
  const editId = $('mEditId').value;
  const meal = { id: editId || genId(), time: $('mTime').value, day: $('mDay').value, name,
    qty: $('mQty').value.trim(), cal: $('mCal').value, prot: $('mProt').value,
    carbs: $('mCarbs').value, fat: $('mFat').value, notes: $('mNotes').value.trim() };
  const snap = await getDoc(doc(db,'usuarios',tUID));
  const d = snap.data()||{}; const mls = d.meals||[];
  if (editId) { const i = mls.findIndex(m=>m.id===editId); if (i>=0) mls[i] = meal; }
  else mls.push(meal);
  await saveUID(tUID, { meals: mls });
  window.closeMealModal();
  if (tUID === S.UID) { S.meals = mls; renderDietNav(); } else window.adminShowDiet(tUID);
};
