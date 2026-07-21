/*
  Fuerza Pro — js/routine-parser.js
  Pegar una rutina en texto y convertirla automáticamente a ejercicios
  de lunes a domingo, con vista previa editable antes de guardar.

  Formatos que entiende (uno por línea):
    Lunes                        ← encabezado de día
    Press banca 4x12
    Sentadilla - 4x10 - 90s - 60kg
    Curl bíceps: 3 x 12 (60s) 15kg
    Peso muerto | 5x5 | 120s
*/
import { S, DAYS } from './state.js';
import { $, esc, genId } from './utils.js';
import { db, doc, getDoc, saveUID } from './db.js';
import { renderDaysNav, renderExercises, updateWeekBar, addToLibrary } from './exercises.js';

const DAY_RE = /^(lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo)\b/i;
const normDay = w => {
  const k = w.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  return { lunes:'Lunes',martes:'Martes',miercoles:'Miércoles',jueves:'Jueves',
           viernes:'Viernes',sabado:'Sábado',domingo:'Domingo' }[k];
};

export function parseRoutineText(text) {
  const rows = [];
  let day = null;
  for (let raw of text.split('\n')) {
    let line = raw.trim().replace(/^[-•*\d.)\s]+(?=[A-Za-zÁÉÍÓÚáéíóúÑñ])/,'');
    if (!line) continue;
    const dm = line.match(DAY_RE);
    if (dm && line.replace(DAY_RE,'').trim().replace(/[:.-]/g,'').trim() === '') {
      day = normDay(dm[1]); continue;
    }
    if (dm) { day = normDay(dm[1]); line = line.replace(DAY_RE,'').replace(/^[:\-.\s]+/,''); if(!line) continue; }
    if (!day) day = 'Lunes';

    let sets='', reps='', rest='', weight='';
    const sxr = line.match(/(\d+)\s*[xX×]\s*(\d+)/);
    if (sxr) { sets = sxr[1]; reps = sxr[2]; line = line.replace(sxr[0],' '); }
    const kg = line.match(/(\d+(?:[.,]\d+)?)\s*kg/i);
    if (kg) { weight = kg[1].replace(',','.'); line = line.replace(kg[0],' '); }
    const rs = line.match(/(\d+)\s*(?:s(?:eg(?:undos)?)?|min(?:utos)?)\b\.?/i);
    if (rs) { rest = rs[0].trim().replace(/\s+/g,''); line = line.replace(rs[0],' '); }
    const name = line.replace(/[|()\[\]]/g,' ').replace(/\s*[-:–,]\s*$/,'').replace(/^\s*[-:–,]\s*/,'').replace(/\s{2,}/g,' ').trim();
    if (!name) continue;
    rows.push({ day, name, sets, reps, rest, weight });
  }
  return rows;
}

/* ── Modal ── */
window.openPasteModal = () => {
  document.querySelector('#ovPaste .mt').textContent = 'Pegar rutina en texto';
  $('pasteText').value = '';
  $('parsedWrap').innerHTML = '';
  S.parsedRows = [];
  $('ovPaste').classList.add('open');
};
window.closePasteModal = () => $('ovPaste').classList.remove('open');

window.parsePasteText = () => {
  const text = $('pasteText').value;
  if (!text.trim()) { alert('Pega primero el texto de tu rutina.'); return; }
  S.parsedRows = parseRoutineText(text);
  if (!S.parsedRows.length) { alert('No se detectaron ejercicios. Revisa el formato (ej: "Press banca 4x12").'); return; }
  renderParsedTable();
};

function renderParsedTable() {
  const w = $('parsedWrap');
  if (!S.parsedRows.length) { w.innerHTML = '<p class="tmuted">Sin filas.</p>'; return; }
  w.innerHTML = `
    <p class="mdesc" style="margin-top:12px">Se detectaron <strong>${S.parsedRows.length}</strong> ejercicios. Revisa y corrige antes de aplicar:</p>
    <div class="parse-head"><span>Día</span><span>Ejercicio</span><span>Ser.</span><span>Reps</span><span>Desc.</span><span>Kg</span><span></span></div>
    ${S.parsedRows.map((r,i)=>`
      <div class="parse-row">
        <select onchange="updParsed(${i},'day',this.value)">${DAYS.map(d=>`<option${d===r.day?' selected':''}>${d}</option>`).join('')}</select>
        <input value="${esc(r.name)}" oninput="updParsed(${i},'name',this.value)"/>
        <input value="${esc(r.sets)}" oninput="updParsed(${i},'sets',this.value)"/>
        <input value="${esc(r.reps)}" oninput="updParsed(${i},'reps',this.value)"/>
        <input value="${esc(r.rest)}" oninput="updParsed(${i},'rest',this.value)"/>
        <input value="${esc(r.weight)}" oninput="updParsed(${i},'weight',this.value)"/>
        <button class="bi danger" onclick="removeParsedRow(${i})">✕</button>
      </div>`).join('')}
    <button class="btn-sm" style="margin-top:8px" onclick="addParsedRow()">+ Agregar fila</button>`;
}

window.renderParsedTable = renderParsedTable; /* reutilizada por ai.js */
window.updParsed = (i, field, val) => { if (S.parsedRows[i]) S.parsedRows[i][field] = val; };
window.removeParsedRow = i => { S.parsedRows.splice(i,1); renderParsedTable(); };
window.addParsedRow = () => { S.parsedRows.push({ day:S.currentDay, name:'', sets:'', reps:'', rest:'', weight:'' }); renderParsedTable(); };

window.applyParsedRoutine = async () => {
  const rows = S.parsedRows.filter(r => r.name.trim());
  if (!rows.length) { alert('No hay ejercicios para aplicar.'); return; }
  const replace = document.querySelector('input[name="pasteMode"]:checked')?.value === 'replace';
  const uid = S.UID;
  const snap = await getDoc(doc(db,'usuarios',uid));
  const d = snap.data()||{};
  let exs = replace ? [] : (d.exercises||[]);
  const today_ = new Date().toISOString().split('T')[0];
  for (const r of rows) {
    /* GIF automático desde la biblioteca si el nombre coincide */
    const lib = S.exLibrary.find(x => x.name.toLowerCase() === r.name.trim().toLowerCase());
    const w = parseFloat(r.weight);
    const ex = {
      id: genId(), day: r.day, name: r.name.trim(),
      sets: r.sets, reps: r.reps, rest: r.rest,
      muscle: lib?.muscle||'', gif: lib?.gif||'', notes:'',
      weightHistory: w>0 ? [{kg:w,date:today_}] : []
    };
    exs.push(ex);
    await addToLibrary(ex);
  }
  await saveUID(uid, { exercises: exs });
  S.exercises = exs;
  window.closePasteModal();
  renderDaysNav(); renderExercises(); updateWeekBar();
  alert(`${rows.length} ejercicios agregados a tu rutina.`);
};
