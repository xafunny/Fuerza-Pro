/*
  Fuerza Pro — js/cycle.js
  Ciclo de entrenamiento global e historial de ciclos.
  Solo el admin configura o finaliza ciclos (protegido también por reglas).
*/
import { S, DAYS } from './state.js';
import { $, esc, today, genId, formatDate } from './utils.js';
import { db, doc, setDoc, getDocs, deleteDoc, collection } from './db.js';

export function renderCycle() {
  const hero = $('cycleHero');
  const cfg  = $('cycleConfig');
  if (cfg) cfg.classList.toggle('hidden', !S.isAdmin);
  const cycle = S.cycle;
  if (cycle?.start) { $('cyStart').value = cycle.start; $('cyEnd').value = cycle.end; $('cyName').value = cycle.name||''; }
  if (!cycle?.start || !cycle?.end) { hero.innerHTML = '<p class="tmuted">No hay ciclo configurado.</p>'; return; }
  const t0 = new Date(); t0.setHours(0,0,0,0);
  const start = new Date(cycle.start+'T00:00:00'), end = new Date(cycle.end+'T00:00:00');
  const total = Math.round((end-start)/86400000);
  const elapsed = Math.round((t0-start)/86400000);
  const rem = Math.round((end-t0)/86400000);
  const pct = Math.min(100, Math.max(0, Math.round(elapsed/total*100)));
  let status = '';
  if (t0 < start) status = `<div class="cbadge pending">Comienza en ${Math.round((start-t0)/86400000)} días</div>`;
  else if (t0 > end) status = '<div class="cbadge done">Ciclo completado</div>';
  else { const w = Math.floor(rem/7), d = rem%7; const txt = [(w>0?`${w} sem`:''),(d>0?`${d} días`:'')].filter(Boolean).join(' y '); status = `<div class="cbadge ${rem<=7?'warn':'active'}">Quedan ${txt}</div>`; }
  const finBtn = S.isAdmin && t0>=start && t0<=end ? `<button class="btn-sm danger" style="margin-top:14px" onclick="finalizeCycle()">Finalizar ciclo ahora</button>` : '';
  hero.innerHTML = `${cycle.name?`<div class="cy-name">${esc(cycle.name)}</div>`:''}
    <div class="cy-dates">${formatDate(cycle.start)} <span>—</span> ${formatDate(cycle.end)}</div>
    ${status}
    <div class="cy-track"><div class="cy-fill" style="width:${pct}%"></div></div>
    <div class="cy-labels"><span>Inicio</span><span>${pct}% completado</span><span>Fin</span></div>
    <div class="cy-stats">
      <div class="cs"><span class="csv">${total}</span><span class="csl">días totales</span></div>
      <div class="cs"><span class="csv">${Math.max(0,elapsed)}</span><span class="csl">cursados</span></div>
      <div class="cs"><span class="csv">${Math.max(0,rem)}</span><span class="csl">restantes</span></div>
    </div>${finBtn}`;
}

window.saveCycle = async () => {
  if (!S.isAdmin) return;
  const s = $('cyStart').value, e = $('cyEnd').value, n = $('cyName').value.trim();
  if (!s || !e) { alert('Selecciona fechas.'); return; }
  if (e <= s) { alert('El fin debe ser posterior al inicio.'); return; }
  if (S.cycle?.start && !S.cycle?.finalizado) {
    const t0 = new Date(); t0.setHours(0,0,0,0);
    const end = new Date(S.cycle.end+'T00:00:00');
    if (t0 <= end) {
      if (!confirm('Ya hay un ciclo activo. ¿Deseas finalizarlo y crear uno nuevo?')) return;
      await guardarCicloEnHistorial(true);
    }
  }
  await setDoc(doc(db,'config','ciclo'), { start:s, end:e, name:n, finalizado:false });
  alert(`Ciclo "${n||'sin nombre'}" guardado correctamente.`);
  renderCycle(); renderCycleHistory();
};

async function guardarCicloEnHistorial(silencioso=false) {
  const cycle = S.cycle;
  if (!cycle?.start) return;
  const usersSnap = await getDocs(collection(db,'usuarios'));
  const usersData = [];
  usersSnap.docs.forEach(d => {
    const data = d.data();
    const weekSnapshot = DAYS.map(day => ({
      day,
      exercises: (data.exercises||[]).filter(ex => ex.day === day).map(ex => {
        const wh = ex.weightHistory||[];
        const cycleWeights = wh.filter(w => w.date >= cycle.start && w.date <= today());
        const lastW = cycleWeights.length ? cycleWeights[cycleWeights.length-1] : (wh.length ? wh[wh.length-1] : null);
        return { name: ex.name, sets: ex.sets||'', reps: ex.reps||'',
          peso: lastW ? `${lastW.kg} kg` : 'Sin registro',
          historialPesos: cycleWeights.map(w=>`${w.kg}kg (${formatDate(w.date)})`).join(', ')||'—' };
      })
    })).filter(x => x.exercises.length > 0);
    if (weekSnapshot.length > 0) usersData.push({ uid:d.id, username:data.username||d.id, semana:weekSnapshot });
  });
  const histId = genId();
  await setDoc(doc(db,'historialCiclos',histId), {
    id: histId, cycleName: cycle.name||'Sin nombre',
    cycleStart: cycle.start, cycleEnd: today(),
    finalizadoAntes: !silencioso, usuarios: usersData, guardadoEn: today()
  });
  await setDoc(doc(db,'config','ciclo'), { ...cycle, end: today(), finalizado:true }, { merge:true });
  if (!silencioso) { alert('Ciclo finalizado y guardado correctamente.'); renderCycle(); renderCycleHistory(); }
}

window.finalizeCycle = async () => {
  if (!S.isAdmin) return;
  if (!confirm('¿Finalizar el ciclo ahora? Se guardará un historial con todos los ejercicios y pesos de todos los usuarios.')) return;
  await guardarCicloEnHistorial(false);
};

export async function renderCycleHistory() {
  const el = $('cycleHistory'); if (!el) return;
  let snap;
  try { snap = await getDocs(collection(db,'historialCiclos')); }
  catch(e) { el.innerHTML=''; return; }
  if (snap.empty) { el.innerHTML=''; return; }
  const docs = [...snap.docs].sort((a,b)=>(b.data().guardadoEn||'').localeCompare(a.data().guardadoEn||''));
  el.innerHTML = `<h3 class="ssub mt16">Historial de ciclos</h3>` +
    docs.map(d => {
      const c = d.data();
      const usersHtml = c.usuarios?.length
        ? c.usuarios.map(u=>`
            <div style="margin-bottom:12px">
              <div style="font-size:.78rem;font-weight:600;color:var(--acc);margin-bottom:6px;text-transform:uppercase">👤 ${esc(u.username)}</div>
              ${(u.semana||[]).map(day=>`
                <div style="margin-bottom:6px">
                  <div style="font-size:.72rem;font-weight:600;color:var(--txt2);text-transform:uppercase;margin-bottom:3px">${day.day}</div>
                  ${day.exercises.map(ex=>`<div class="hrow" style="padding:5px 10px;flex-wrap:wrap;gap:4px"><span style="flex:1;font-size:.8rem;min-width:120px">${esc(ex.name)}</span><span class="utag">${esc(ex.sets)}×${esc(ex.reps)}</span><span class="utag wt">${esc(ex.peso)}</span>${ex.historialPesos&&ex.historialPesos!=='—'?`<span class="utag" style="font-size:.65rem;opacity:.7" title="Historial del ciclo">📈 ${esc(ex.historialPesos)}</span>`:''}</div>`).join('')}
                </div>`).join('')}
            </div>`).join('<hr style="border-color:var(--bd);margin:8px 0"/>')
        : (c.semana||[]).map(day=>`
            <div style="margin-bottom:8px">
              <div style="font-size:.74rem;font-weight:600;color:var(--txt2);text-transform:uppercase;margin-bottom:4px">${day.day}</div>
              ${day.exercises.map(ex=>`<div class="hrow" style="padding:6px 10px"><span style="flex:1;font-size:.8rem">${esc(ex.name)}</span><span class="utag">${esc(ex.sets)}×${esc(ex.reps)}</span><span class="utag wt">${esc(ex.peso)}</span></div>`).join('')}
            </div>`).join('');
      return `<div class="card mb16">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:6px">
          <div>
            <div class="card-title" style="margin-bottom:4px">${esc(c.cycleName)} <span class="utag">${c.finalizadoAntes?'Finalizado antes':'Completado'}</span></div>
            <div class="tmuted" style="margin-bottom:10px;font-size:.78rem">${formatDate(c.cycleStart)} — ${formatDate(c.cycleEnd)}</div>
          </div>
          ${S.isAdmin?`<button class="btn-sm danger" onclick="deleteCycleHistory('${d.id}')">✕ Eliminar</button>`:''}
        </div>${usersHtml}</div>`;
    }).join('');
}

window.deleteCycleHistory = async histId => {
  if (!confirm('¿Eliminar este ciclo del historial?')) return;
  await deleteDoc(doc(db,'historialCiclos',histId));
  renderCycleHistory();
};
