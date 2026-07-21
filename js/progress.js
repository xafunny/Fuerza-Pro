/*
  Fuerza Pro — js/progress.js
  Composición corporal, medidas y gráficas (Chart.js).
*/
import { S, MK, ML } from './state.js';
import { $, esc, today, genId, formatDate, cap } from './utils.js';
import { save } from './db.js';

window.switchProg = sub => {
  ['comp','medidas','graficas','fotos'].forEach(s => {
    $(`pp${cap(s)}`)?.classList.toggle('hidden', s !== sub);
    $(`pst${cap(s)}`)?.classList.toggle('active', s === sub);
  });
  if (sub==='comp')     renderBodyData();
  if (sub==='medidas')  renderMedidasData();
  if (sub==='graficas') renderGraficas();
  if (sub==='fotos')    window.renderProgressPhotos?.();
};

/* ── Composición corporal ── */
window.openBodyModal = editId => {
  ['bEdad','bEstatura','bPeso','bAgua','bGrasa','bHueso','bVisceral','bMusculo','bBMI','bBMR','bEdadFisio'].forEach(id=>$(id).value='');
  if (editId) {
    const rec = S.bodyData.find(r => r.id === editId);
    if (rec) {
      $('bDate').value = rec.date||''; $('bEdad').value = rec.edad||'';
      $('bEstatura').value = rec.estatura||''; $('bPeso').value = rec.peso||'';
      $('bAgua').value = rec.agua||''; $('bGrasa').value = rec.grasa||'';
      $('bHueso').value = rec.hueso||''; $('bVisceral').value = rec.visceral||'';
      $('bMusculo').value = rec.musculo||''; $('bBMI').value = rec.bmi||'';
      $('bBMR').value = rec.bmr||''; $('bEdadFisio').value = rec.edadFisio||'';
    }
  } else $('bDate').value = today();
  S.editBodyId = editId||null;
  $('ovBody').classList.add('open');
};
window.closeBodyModal = () => { $('ovBody').classList.remove('open'); S.editBodyId = null; };

window.saveBody = async () => {
  const date = $('bDate').value; if (!date) { alert('Selecciona una fecha.'); return; }
  const peso = parseFloat($('bPeso').value)||null;
  const est  = parseFloat($('bEstatura').value)||null;
  const edad = parseFloat($('bEdad').value)||null;
  let bmi = parseFloat($('bBMI').value)||null;
  let bmr = parseFloat($('bBMR').value)||null;
  if (!bmi && peso && est) bmi = +(peso/((est/100)**2)).toFixed(1);
  if (!bmr && peso && est && edad) bmr = Math.round(10*peso + 6.25*est - 5*edad + 5);
  const record = { id: S.editBodyId||genId(), date, edad, estatura:est, peso,
    agua: parseFloat($('bAgua').value)||null, grasa: parseFloat($('bGrasa').value)||null,
    hueso: parseFloat($('bHueso').value)||null, visceral: parseFloat($('bVisceral').value)||null,
    musculo: parseFloat($('bMusculo').value)||null, bmi, bmr,
    edadFisio: parseFloat($('bEdadFisio').value)||null };
  if (S.editBodyId) { const i = S.bodyData.findIndex(r=>r.id===S.editBodyId); if (i>=0) S.bodyData[i]=record; }
  else S.bodyData.push(record);
  S.bodyData.sort((a,b)=>a.date.localeCompare(b.date));
  await save({ bodyData: S.bodyData });
  window.closeBodyModal(); renderBodyData();
};

function semaforo(){ return ''; } /* reservado para indicadores de rango */

export function renderBodyData() {
  const el = $('bodyLatest'), hist = $('bodyHist');
  if (!S.bodyData.length) { el.innerHTML='<div class="empty"><p>Agrega tu primera medición de composición corporal.</p></div>'; hist.innerHTML=''; return; }
  const last = S.bodyData[S.bodyData.length-1];
  const fields=[{k:'peso',l:'Peso',u:'kg'},{k:'estatura',l:'Estatura',u:'cm'},{k:'grasa',l:'Grasa',u:'%'},{k:'musculo',l:'Músculo',u:'%'},{k:'agua',l:'Agua',u:'%'},{k:'bmi',l:'BMI',u:''},{k:'bmr',l:'BMR',u:'kcal'},{k:'visceral',l:'G. Visceral',u:''},{k:'hueso',l:'Masa ósea',u:'kg'},{k:'edadFisio',l:'Edad fisiol.',u:'años'}];
  el.innerHTML = `<div class="stat-grid">${fields.filter(f=>last[f.k]!=null).map(f=>`<div class="scard"><div class="sv">${last[f.k]}<span>${f.u}</span></div><div class="sl">${f.l}</div>${semaforo(f.k,last[f.k])}</div>`).join('')}</div><p class="tmuted mt8">Última actualización: <strong>${formatDate(last.date)}</strong></p>`;
  hist.innerHTML = `<h3 class="ssub mt16">Historial</h3>` + [...S.bodyData].reverse().map((r,i)=>`<div class="hrow"><div class="hdate">${formatDate(r.date)}</div><div class="htags">${r.peso?`<span class="htag">${r.peso}kg</span>`:''}${r.grasa?`<span class="htag">${r.grasa}%gr</span>`:''}${r.musculo?`<span class="htag">${r.musculo}%mu</span>`:''}${r.bmi?`<span class="htag">BMI ${r.bmi}</span>`:''}</div><div style="display:flex;gap:4px"><button class="bi" onclick="openBodyModal('${r.id}')">✎</button><button class="bi danger" onclick="deleteBody(${S.bodyData.length-1-i})">✕</button></div></div>`).join('');
}
window.deleteBody = async i => { if (!confirm('¿Eliminar?')) return; S.bodyData.splice(i,1); await save({bodyData:S.bodyData}); renderBodyData(); };

/* ── Medidas corporales ── */
window.openMedidasModal = editId => {
  MK.forEach(k => { const el = $('m'+k); if (el) el.value=''; });
  $('mDate').value = '';
  if (editId) {
    const rec = S.medidasData.find(r => r.id === editId);
    if (rec) { $('mDate').value = rec.date||''; MK.forEach(k => { const el=$('m'+k); if (el) el.value = rec[k]||''; }); }
  } else $('mDate').value = today();
  S.editMedId = editId||null;
  $('ovMedidas').classList.add('open');
};
window.closeMedidasModal = () => { $('ovMedidas').classList.remove('open'); S.editMedId = null; };

window.saveMedidas = async () => {
  const date = $('mDate').value; if (!date) { alert('Selecciona una fecha.'); return; }
  const record = { id: S.editMedId||genId(), date };
  MK.forEach(k => { const v = parseFloat($('m'+k)?.value)||null; if (v) record[k]=v; });
  if (Object.keys(record).length <= 2) { alert('Ingresa al menos una medida.'); return; }
  if (S.editMedId) { const i = S.medidasData.findIndex(r=>r.id===S.editMedId); if (i>=0) S.medidasData[i]=record; }
  else S.medidasData.push(record);
  S.medidasData.sort((a,b)=>a.date.localeCompare(b.date));
  await save({ medidasData: S.medidasData });
  window.closeMedidasModal(); renderMedidasData();
};

export function renderMedidasData() {
  const el = $('medidasLatest'), hist = $('medidasHist');
  if (!S.medidasData.length) { el.innerHTML='<div class="empty"><p>Agrega tu primera medición corporal.</p></div>'; hist.innerHTML=''; return; }
  const last = S.medidasData[S.medidasData.length-1], first = S.medidasData[0];
  el.innerHTML = `<div class="med-table"><div class="mtr header"><span>Medida</span><span>Actual</span><span>Cambio</span></div>${MK.filter(k=>last[k]!=null).map(k=>{const diff=first[k]&&last[k]?(last[k]-first[k]).toFixed(1):null;const clr=diff===null?'':parseFloat(diff)>0?'color:var(--ok)':'color:#ef4444';return`<div class="mtr"><span>${ML[k]}</span><span><strong>${last[k]} cm</strong></span><span style="${clr}">${diff!==null?(parseFloat(diff)>0?'+':'')+diff+' cm':'—'}</span></div>`;}).join('')}</div><p class="tmuted mt8">Última actualización: <strong>${formatDate(last.date)}</strong></p>`;
  hist.innerHTML = `<h3 class="ssub mt16">Historial</h3>` + [...S.medidasData].reverse().map((r,i)=>`<div class="hrow"><div class="hdate">${formatDate(r.date)}</div><div class="htags">${MK.filter(k=>r[k]).slice(0,4).map(k=>`<span class="htag">${ML[k]}: ${r[k]}cm</span>`).join('')}</div><div style="display:flex;gap:4px"><button class="bi" onclick="openMedidasModal('${r.id}')">✎</button><button class="bi danger" onclick="deleteMedida(${S.medidasData.length-1-i})">✕</button></div></div>`).join('');
}
window.deleteMedida = async i => { if (!confirm('¿Eliminar?')) return; S.medidasData.splice(i,1); await save({medidasData:S.medidasData}); renderMedidasData(); };

/* ── Gráficas ── */
export function renderGraficas(){ renderBodyChart(S.bodyChartType); renderMedChart(S.medChartKey); renderWCharts(); }

window.switchBodyChart = type => {
  S.bodyChartType = type;
  document.querySelectorAll('#bodyCtabs .ctab').forEach(b=>b.classList.toggle('active',b.textContent.toLowerCase()===type));
  renderBodyChart(type);
};

const CHART_OPTS = { responsive:true, plugins:{legend:{labels:{color:'#f5f5f5',font:{family:'Inter'}}}}, scales:{x:{ticks:{color:'#888'},grid:{color:'#2a2a2a'}},y:{ticks:{color:'#888'},grid:{color:'#2a2a2a'}}} };

function renderBodyChart(type) {
  const cv = $('bodyChart'), em = $('bodyChartEmpty');
  const data = S.bodyData.filter(r => r[type]!=null);
  if (data.length < 2) { cv.style.display='none'; em.style.display='flex'; return; }
  cv.style.display='block'; em.style.display='none';
  if (S.chartInst) S.chartInst.destroy();
  const clrs={peso:'#b91c1c',grasa:'#dc2626',musculo:'#7f1d1d',agua:'#3b82f6'};
  const unts={peso:'kg',grasa:'%',musculo:'%',agua:'%'};
  S.chartInst = new Chart(cv,{type:'line',data:{labels:data.map(r=>formatDate(r.date)),datasets:[{label:`${type}(${unts[type]})`,data:data.map(r=>r[type]),borderColor:clrs[type],backgroundColor:clrs[type]+'20',borderWidth:2,pointBackgroundColor:clrs[type],pointRadius:4,tension:0.3,fill:true}]},options:CHART_OPTS});
}

function renderMedChart(key) {
  $('medCtabs').innerHTML = MK.map(k=>`<button class="ctab${k===key?' active':''}" onclick="switchMedChart('${k}')" style="font-size:.66rem;padding:3px 7px">${ML[k]}</button>`).join('');
  const cv = $('medChart'), em = $('medChartEmpty');
  const data = S.medidasData.filter(r => r[key]!=null);
  if (data.length < 2) { cv.style.display='none'; em.style.display='flex'; return; }
  cv.style.display='block'; em.style.display='none';
  if (S.medChartInst) S.medChartInst.destroy();
  S.medChartInst = new Chart(cv,{type:'line',data:{labels:data.map(r=>formatDate(r.date)),datasets:[{label:`${ML[key]}(cm)`,data:data.map(r=>r[key]),borderColor:'#b91c1c',backgroundColor:'#b91c1c20',borderWidth:2,pointBackgroundColor:'#b91c1c',pointRadius:4,tension:0.3,fill:true}]},options:CHART_OPTS});
}
window.switchMedChart = key => { S.medChartKey = key; renderMedChart(key); };

function renderWCharts() {
  const sec = $('wCharts');
  const wh = S.exercises.filter(e => (e.weightHistory||[]).length >= 2);
  if (!wh.length) { sec.innerHTML='<p class="tmuted">Agrega al menos 2 registros de peso en un ejercicio para ver su evolución.</p>'; return; }
  sec.innerHTML = wh.map(ex=>`<div class="card mb16"><div class="card-title">${esc(ex.name)}</div><canvas id="wc-${ex.id}" height="80"></canvas></div>`).join('');
  wh.forEach(ex => { new Chart($(`wc-${ex.id}`),{type:'line',data:{labels:ex.weightHistory.map(w=>formatDate(w.date)),datasets:[{label:'Peso(kg)',data:ex.weightHistory.map(w=>w.kg),borderColor:'#b91c1c',backgroundColor:'#b91c1c20',borderWidth:2,pointBackgroundColor:'#b91c1c',pointRadius:4,tension:0.3,fill:true}]},options:{...CHART_OPTS,plugins:{legend:{display:false}}}}); });
}
