/* =============================================
   FUERZA PRO — app.js
   - Ciclo de entrenamiento con countdown
   - Peso por ejercicio con historial
   - Fix de GIFs
   - Progreso físico con gráfica
============================================= */

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js";
import { getFirestore, doc, setDoc, onSnapshot }
  from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";

// ── Firebase ──────────────────────────────────
const firebaseConfig = {
  apiKey:            "AIzaSyALUv_MuDpzol8ArgD9gOw8gIYruy1bRog",
  authDomain:        "fuerzapro-e9d6f.firebaseapp.com",
  projectId:         "fuerzapro-e9d6f",
  storageBucket:     "fuerzapro-e9d6f.firebasestorage.app",
  messagingSenderId: "589184423001",
  appId:             "1:589184423001:web:e3088e42caebea8d9bcd48"
};
const fbApp = initializeApp(firebaseConfig);
const db    = getFirestore(fbApp);

// ── Usuarios ──────────────────────────────────
// Para cambiar contraseñas edita solo aquí
const USERS = [
  { username: 'jhoao', password: 'jhoao' },
  { username: 'karen', password: 'karen' },
];
const DAYS = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'];

// ── Estado global ─────────────────────────────
let currentUser   = null;
let currentDay    = DAYS[0];
let exercises     = [];
let doneSet       = [];
let stats         = [];
let cycle         = null;   // { name, start, end } — compartido entre usuarios
let currentChart  = 'peso';
let chartInstance = null;
let unsubscribe   = null;
let unsubCycle    = null;   // listener del ciclo compartido

// ── ID del ejercicio que se está editando el peso
let editingWeightId = null;


/* ============================================================
   LOGIN / LOGOUT
============================================================ */
window.handleLogin = function () {
  const user = document.getElementById('loginUser').value.trim().toLowerCase();
  const pass = document.getElementById('loginPass').value.trim();
  const err  = document.getElementById('loginError');

  const found = USERS.find(u => u.username.toLowerCase() === user && u.password === pass);
  if (!found) { err.style.display = 'block'; document.getElementById('loginPass').value = ''; return; }

  err.style.display = 'none';
  currentUser = found.username;
  sessionStorage.setItem('fuerzapro_session', currentUser);

  document.getElementById('loginScreen').classList.add('hidden');
  document.getElementById('appScreen').classList.remove('hidden');
  document.getElementById('userBadge').textContent = `👤 ${currentUser}`;
  document.getElementById('loginUser').value = '';
  document.getElementById('loginPass').value = '';

  startListening();
  startCycleListener();
};

window.handleLogout = function () {
  if (unsubscribe) unsubscribe();
  if (unsubCycle)  unsubCycle();
  if (chartInstance) { chartInstance.destroy(); chartInstance = null; }
  currentUser = null; exercises = []; doneSet = []; stats = []; cycle = null;
  currentDay  = DAYS[0];
  sessionStorage.removeItem('fuerzapro_session');
  document.getElementById('appScreen').classList.add('hidden');
  document.getElementById('loginScreen').classList.remove('hidden');
};


/* ============================================================
   FIRESTORE — datos del usuario
============================================================ */
function startListening() {
  unsubscribe = onSnapshot(doc(db, 'usuarios', currentUser), snap => {
    if (snap.exists()) {
      const d  = snap.data();
      exercises = d.exercises || [];
      doneSet   = d.doneSet   || [];
      stats     = d.stats     || [];
    } else {
      exercises = []; doneSet = []; stats = [];
    }
    initApp();
  });
}

async function saveUser() {
  try {
    await setDoc(doc(db, 'usuarios', currentUser), { exercises, doneSet, stats });
  } catch (e) { console.error(e); alert('Error al guardar. Revisa tu conexión.'); }
}

// ── Ciclo compartido — guardado en doc separado ──
function startCycleListener() {
  unsubCycle = onSnapshot(doc(db, 'config', 'ciclo'), snap => {
    cycle = snap.exists() ? snap.data() : null;
    // Si el tab de ciclo está visible, re-renderiza
    if (!document.getElementById('panelCiclo').classList.contains('hidden')) renderCycle();
  });
}

async function saveCycleToFirebase(data) {
  try {
    await setDoc(doc(db, 'config', 'ciclo'), data);
  } catch (e) { console.error(e); alert('Error al guardar el ciclo.'); }
}


/* ============================================================
   TABS
============================================================ */
window.switchTab = function (tab) {
  ['rutina','progreso','ciclo'].forEach(t => {
    document.getElementById(`panel${t.charAt(0).toUpperCase()+t.slice(1)}`).classList.toggle('hidden', t !== tab);
    document.getElementById(`tab${t.charAt(0).toUpperCase()+t.slice(1)}`).classList.toggle('active', t === tab);
  });
  // Oculta el botón "+ Ejercicio" fuera de rutina
  document.getElementById('btnAgregar').style.display = tab === 'rutina' ? '' : 'none';
  if (tab === 'progreso') renderStats();
  if (tab === 'ciclo')    renderCycle();
};


/* ============================================================
   RUTINA — días
============================================================ */
function renderDaysNav() {
  document.getElementById('daysNav').innerHTML = DAYS.map(day => {
    const count = exercises.filter(e => e.day === day).length;
    const badge = count > 0 ? `<span class="count">${count}</span>` : '';
    return `<button class="day-pill${day === currentDay ? ' active' : ''}" onclick="selectDay('${day}')">${day}${badge}</button>`;
  }).join('');
}

window.selectDay = function (day) {
  currentDay = day;
  document.getElementById('sectionTitle').innerHTML = day.toUpperCase();
  renderDaysNav();
  renderExercises();
};


/* ============================================================
   EJERCICIOS
============================================================ */
function renderExercises() {
  const list = document.getElementById('exercisesList');
  const dayEx = exercises.filter(e => e.day === currentDay);

  if (!dayEx.length) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="icon">🏋️</div>
        <p>No hay ejercicios para <strong>${currentDay}</strong>.</p>
        <button onclick="openModal('${currentDay}')">+ Agregar ejercicio</button>
      </div>`;
    return;
  }
  list.innerHTML = `<div class="exercises-grid">${dayEx.map(buildCard).join('')}</div>`;
}

function buildCard(ex) {
  const isDone = doneSet.includes(ex.id);

  // GIF section
  const gifSection = ex.gif
    ? `<div class="card-gif">
         <img src="${ex.gif}" alt="${ex.name}" loading="lazy"
           onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"  />
         <span class="placeholder" style="display:none">🏋️</span>
       </div>`
    : `<div class="card-gif"><span class="placeholder">🏋️</span></div>`;

  const muscle = ex.muscle ? `<span class="muscle-group">${ex.muscle}</span><br>` : '';
  const sets   = ex.sets   ? `<span class="badge badge-sets">${ex.sets} series</span>` : '';
  const reps   = ex.reps   ? `<span class="badge badge-reps">${ex.reps} reps</span>`   : '';
  const rest   = ex.rest   ? `<span class="badge badge-rest">⏱ ${ex.rest}</span>`      : '';
  const notes  = ex.notes  ? `<div class="card-notes">${ex.notes}</div>`               : '';

  // Peso actual
  const weightHistory = ex.weightHistory || [];
  const lastWeight    = weightHistory.length ? weightHistory[weightHistory.length - 1] : null;
  const weightBadge   = lastWeight
    ? `<span class="badge badge-weight">⚖️ ${lastWeight.kg} kg</span>`
    : `<span class="badge badge-weight-empty">⚖️ Sin peso</span>`;

  return `
    <div class="exercise-card" id="card-${ex.id}">
      ${gifSection}
      <div class="card-body">
        ${muscle}
        <div class="card-name">${ex.name}</div>
        <div class="card-meta">${sets}${reps}${rest}${weightBadge}</div>
        ${notes}
      </div>
      <div class="card-actions">
        <button class="btn-done${isDone ? ' done' : ''}" onclick="toggleDone('${ex.id}')">
          ${isDone ? '✓ Hecho' : 'Marcar hecho'}
        </button>
        <button class="btn-weight" onclick="openWeightModal('${ex.id}')" title="Actualizar peso">⚖️</button>
        <button class="btn-delete" onclick="deleteExercise('${ex.id}')" title="Eliminar">🗑</button>
      </div>
    </div>`;
}

window.toggleDone = async function (id) {
  doneSet.includes(id) ? doneSet = doneSet.filter(d => d !== id) : doneSet.push(id);
  await saveUser();
};

window.deleteExercise = async function (id) {
  if (!confirm('¿Eliminar este ejercicio?')) return;
  exercises = exercises.filter(e => e.id !== id);
  doneSet   = doneSet.filter(d => d !== id);
  await saveUser();
};

function updateProgress() {
  const total = exercises.length;
  const done  = exercises.filter(e => doneSet.includes(e.id)).length;
  const pct   = total === 0 ? 0 : Math.round((done / total) * 100);
  document.getElementById('progressFill').style.width = pct + '%';
  document.getElementById('progressPct').textContent  = pct + '%';
}


/* ============================================================
   PESO POR EJERCICIO
============================================================ */
window.openWeightModal = function (id) {
  editingWeightId = id;
  const ex = exercises.find(e => e.id === id);
  if (!ex) return;

  document.getElementById('weightModalTitle').textContent = `⚖️ ${ex.name}`;
  document.getElementById('wNewWeight').value = '';

  // Muestra historial de pesos
  const history = ex.weightHistory || [];
  const wrap    = document.getElementById('weightHistoryWrap');
  if (history.length) {
    wrap.innerHTML = `
      <div class="weight-history-title">Historial de pesos</div>
      <div class="weight-history-list">
        ${[...history].reverse().map(w => `
          <div class="weight-history-row">
            <span class="wh-date">${formatDate(w.date)}</span>
            <span class="wh-kg">${w.kg} kg</span>
          </div>`).join('')}
      </div>`;
  } else {
    wrap.innerHTML = `<p style="color:var(--muted);font-size:0.82rem;margin-bottom:12px;">Aún no has registrado ningún peso para este ejercicio.</p>`;
  }

  document.getElementById('weightOverlay').classList.add('open');
};

window.closeWeightModal = function () {
  document.getElementById('weightOverlay').classList.remove('open');
  editingWeightId = null;
};

window.handleWeightOverlayClick = function (e) {
  if (e.target === document.getElementById('weightOverlay')) closeWeightModal();
};

window.saveWeight = async function () {
  const kg = parseFloat(document.getElementById('wNewWeight').value);
  if (!kg || kg <= 0) { alert('Ingresa un peso válido'); return; }

  const ex = exercises.find(e => e.id === editingWeightId);
  if (!ex) return;

  if (!ex.weightHistory) ex.weightHistory = [];
  ex.weightHistory.push({ kg, date: new Date().toISOString().split('T')[0] });

  await saveUser();
  closeWeightModal();
};


/* ============================================================
   CICLO DE ENTRENAMIENTO
============================================================ */
function renderCycle() {
  const hero   = document.getElementById('cycleHero');
  const config = document.getElementById('cycleConfig');

  // Pre-rellena campos si ya hay ciclo
  if (cycle && cycle.start) {
    document.getElementById('cycleStart').value = cycle.start;
    document.getElementById('cycleEnd').value   = cycle.end;
    document.getElementById('cycleName').value  = cycle.name || '';
  }

  if (!cycle || !cycle.start || !cycle.end) {
    hero.innerHTML = `
      <div class="cycle-empty">
        <span>📅</span>
        <p>No hay ningún ciclo configurado aún.<br>Configúralo abajo 👇</p>
      </div>`;
    return;
  }

  const today    = new Date(); today.setHours(0,0,0,0);
  const start    = new Date(cycle.start + 'T00:00:00');
  const end      = new Date(cycle.end   + 'T00:00:00');
  const total    = Math.round((end - start)   / 86400000);
  const elapsed  = Math.round((today - start) / 86400000);
  const remaining = Math.round((end - today)   / 86400000);

  // Estado
  let statusHtml = '';
  let pct = 0;

  if (today < start) {
    // Ciclo no ha empezado
    const daysToStart = Math.round((start - today) / 86400000);
    statusHtml = `<div class="cycle-status pending">⏳ Empieza en ${daysToStart} día${daysToStart !== 1 ? 's' : ''}</div>`;
    pct = 0;
  } else if (today > end) {
    // Ciclo terminado
    statusHtml = `<div class="cycle-status done">✅ ¡Ciclo completado! Hora de cambiar la rutina.</div>`;
    pct = 100;
  } else {
    // En progreso
    pct = Math.min(100, Math.round((elapsed / total) * 100));
    const weeks     = Math.floor(remaining / 7);
    const days      = remaining % 7;
    const weeksText = weeks > 0 ? `${weeks} semana${weeks !== 1 ? 's' : ''}` : '';
    const daysText  = days  > 0 ? `${days} día${days !== 1 ? 's' : ''}`       : '';
    const timeLeft  = [weeksText, daysText].filter(Boolean).join(' y ');

    // Alerta si queda poco
    const alertClass = remaining <= 7 ? 'cycle-status warning' : 'cycle-status active';
    const alertIcon  = remaining <= 7 ? '🚨' : '🏃';
    statusHtml = `<div class="${alertClass}">${alertIcon} Quedan <strong>${timeLeft}</strong> para terminar el ciclo</div>`;
  }

  const name = cycle.name ? `<div class="cycle-name">${cycle.name}</div>` : '';

  hero.innerHTML = `
    ${name}
    <div class="cycle-dates">
      <span>📅 ${formatDate(cycle.start)}</span>
      <span class="cycle-arrow">→</span>
      <span>📅 ${formatDate(cycle.end)}</span>
    </div>
    ${statusHtml}
    <div class="cycle-bar-wrap">
      <div class="cycle-bar-fill" style="width:${pct}%"></div>
    </div>
    <div class="cycle-bar-labels">
      <span>Inicio</span>
      <span style="color:var(--accent);font-weight:700">${pct}% completado</span>
      <span>Fin</span>
    </div>
    <div class="cycle-mini-stats">
      <div class="cms-item"><span class="cms-val">${total}</span><span class="cms-label">días totales</span></div>
      <div class="cms-item"><span class="cms-val">${Math.max(0,elapsed)}</span><span class="cms-label">días cursados</span></div>
      <div class="cms-item"><span class="cms-val">${Math.max(0,remaining)}</span><span class="cms-label">días restantes</span></div>
    </div>`;
}

window.saveCycle = async function () {
  const start = document.getElementById('cycleStart').value;
  const end   = document.getElementById('cycleEnd').value;
  const name  = document.getElementById('cycleName').value.trim();

  if (!start || !end) { alert('Selecciona fecha de inicio y fin'); return; }
  if (end <= start)   { alert('La fecha de fin debe ser después del inicio'); return; }

  await saveCycleToFirebase({ start, end, name });
  // El listener actualizará `cycle` y re-renderizará automáticamente
};


/* ============================================================
   PROGRESO FÍSICO
============================================================ */
function renderStats() {
  renderStatsSummary();
  renderStatsHistory();
  renderChart(currentChart);
}

function renderStatsSummary() {
  const el = document.getElementById('statsSummary');
  if (!stats.length) {
    el.innerHTML = `<div class="empty-state" style="padding:40px 20px"><div class="icon">📏</div><p>Agrega tu primera medición.</p></div>`;
    return;
  }
  const last  = stats[stats.length - 1];
  const first = stats[0];
  const diff  = (key, inv = false) => {
    if (!last[key] || !first[key]) return '';
    const v = (last[key] - first[key]).toFixed(1);
    const n = parseFloat(v);
    const ok = inv ? n < 0 : n > 0;
    const color = n === 0 ? 'var(--muted)' : ok ? 'var(--success)' : '#ff6b6b';
    return `<span style="color:${color};font-size:0.72rem;font-weight:700">${n>0?'+':''}${v} desde inicio</span>`;
  };

  el.innerHTML = `
    <div class="stats-cards">
      ${last.peso     ? `<div class="stat-card"><div class="stat-icon">⚖️</div><div class="stat-value">${last.peso}<span>kg</span></div><div class="stat-label">Peso</div>${diff('peso')}</div>` : ''}
      ${last.estatura ? `<div class="stat-card"><div class="stat-icon">📏</div><div class="stat-value">${last.estatura}<span>cm</span></div><div class="stat-label">Estatura</div></div>` : ''}
      ${last.grasa    ? `<div class="stat-card"><div class="stat-icon">🔥</div><div class="stat-value">${last.grasa}<span>%</span></div><div class="stat-label">Grasa</div>${diff('grasa',true)}</div>` : ''}
      ${last.musculo  ? `<div class="stat-card"><div class="stat-icon">💪</div><div class="stat-value">${last.musculo}<span>%</span></div><div class="stat-label">Músculo</div>${diff('musculo')}</div>` : ''}
    </div>
    <p class="stats-last-date">Última medición: <strong>${formatDate(last.date)}</strong> · ${stats.length} registro${stats.length>1?'s':''}</p>`;
}

function renderStatsHistory() {
  const el = document.getElementById('statsHistory');
  if (!stats.length) { el.innerHTML = ''; return; }
  el.innerHTML = [...stats].reverse().map((s, i) => `
    <div class="history-row">
      <div class="history-date">${formatDate(s.date)}</div>
      <div class="history-values">
        ${s.peso     ? `<span class="hv-badge">⚖️ ${s.peso} kg</span>`         : ''}
        ${s.estatura ? `<span class="hv-badge">📏 ${s.estatura} cm</span>`      : ''}
        ${s.grasa    ? `<span class="hv-badge">🔥 ${s.grasa}% grasa</span>`     : ''}
        ${s.musculo  ? `<span class="hv-badge">💪 ${s.musculo}% músculo</span>` : ''}
      </div>
      ${s.notes ? `<div class="history-notes">${s.notes}</div>` : ''}
      <button class="btn-delete-stat" onclick="deleteStat(${stats.length-1-i})">🗑</button>
    </div>`).join('');
}

function renderChart(type) {
  currentChart = type;
  document.querySelectorAll('.chart-tab').forEach(b => {
    const map = { peso:'peso', grasa:'grasa', musculo:'músculo' };
    b.classList.toggle('active', b.textContent.toLowerCase() === map[type]);
  });
  const canvas = document.getElementById('progressChart');
  const empty  = document.getElementById('chartEmpty');
  const data   = stats.filter(s => s[type]);
  if (data.length < 2) { canvas.style.display='none'; empty.style.display='flex'; return; }
  canvas.style.display='block'; empty.style.display='none';
  const colors = { peso:'#e8ff47', grasa:'#ff6b35', musculo:'#4ade80' };
  const units  = { peso:'kg', grasa:'%', musculo:'%' };
  const names  = { peso:'Peso', grasa:'Grasa corporal', musculo:'Masa muscular' };
  if (chartInstance) chartInstance.destroy();
  chartInstance = new Chart(canvas, {
    type: 'line',
    data: { labels: data.map(s=>formatDate(s.date)), datasets:[{
      label:`${names[type]} (${units[type]})`, data:data.map(s=>s[type]),
      borderColor:colors[type], backgroundColor:colors[type]+'1a',
      borderWidth:2.5, pointBackgroundColor:colors[type], pointRadius:5, tension:0.3, fill:true
    }]},
    options:{
      responsive:true,
      plugins:{ legend:{labels:{color:'#f0f0f0',font:{family:'DM Sans'}}}, tooltip:{callbacks:{label:c=>` ${c.parsed.y} ${units[type]}`}} },
      scales:{ x:{ticks:{color:'#6b6b7a'},grid:{color:'#2a2a30'}}, y:{ticks:{color:'#6b6b7a'},grid:{color:'#2a2a30'}} }
    }
  });
}

window.switchChart = t => renderChart(t);

window.deleteStat = async function (i) {
  if (!confirm('¿Eliminar esta medición?')) return;
  stats.splice(i, 1);
  await saveUser();
  renderStats();
};


/* ============================================================
   MODAL EJERCICIO
============================================================ */
window.openModal = function (day) {
  document.getElementById('fDay').value = day || currentDay;
  document.getElementById('overlay').classList.add('open');
};
window.closeModal = function () {
  document.getElementById('overlay').classList.remove('open');
  resetForm();
};
window.handleOverlayClick = function (e) {
  if (e.target === document.getElementById('overlay')) closeModal();
};
function resetForm() {
  ['fName','fSets','fReps','fRest','fGif','fNotes','fWeight'].forEach(id => document.getElementById(id).value='');
  document.getElementById('fMuscle').value = '';
  const p = document.getElementById('gifPreview');
  p.innerHTML = '<span style="color:var(--muted);font-size:0.85rem;">Preview del GIF aparecerá aquí</span>';
  p.classList.remove('has-img');
  document.getElementById('gifError').style.display = 'none';
}

// GIF preview — manual con botón para evitar errores al escribir
window.previewGif = function () {
  let url = document.getElementById('fGif').value.trim();
  const preview = document.getElementById('gifPreview');
  const errMsg  = document.getElementById('gifError');
  errMsg.style.display = 'none';

  if (!url) { preview.classList.remove('has-img'); preview.innerHTML = '<span style="color:var(--muted);font-size:0.85rem;">Preview del GIF aparecerá aquí</span>'; return; }

  // Intenta convertir links de giphy al formato directo
  // Ej: https://giphy.com/gifs/NAME-HASH → https://media.giphy.com/media/HASH/giphy.gif
  if (url.includes('giphy.com/gifs/') && !url.endsWith('.gif')) {
    const parts = url.split('-');
    const hash  = parts[parts.length - 1].split('/')[0];
    if (hash) url = `https://media.giphy.com/media/${hash}/giphy.gif`;
  }

  // Actualiza el input con el link convertido
  document.getElementById('fGif').value = url;

  preview.innerHTML = '<span style="color:var(--muted);font-size:0.85rem;">Cargando...</span>';
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.src = url;
  img.onload = () => {
    preview.innerHTML = '';
    img.style.cssText = 'width:100%;height:100%;object-fit:cover;border-radius:8px';
    preview.appendChild(img);
    preview.classList.add('has-img');
  };
  img.onerror = () => {
    errMsg.style.display = 'block';
    preview.classList.remove('has-img');
    preview.innerHTML = '<span style="color:var(--muted);font-size:0.85rem;">No se pudo cargar</span>';
  };
};

window.saveExercise = async function () {
  const name = document.getElementById('fName').value.trim();
  const day  = document.getElementById('fDay').value;
  if (!name) { alert('Por favor ingresa el nombre del ejercicio'); return; }

  const weight = parseFloat(document.getElementById('fWeight').value);
  const weightHistory = weight > 0
    ? [{ kg: weight, date: new Date().toISOString().split('T')[0] }]
    : [];

  exercises.push({
    id: Date.now().toString(), name, day,
    sets:   document.getElementById('fSets').value,
    reps:   document.getElementById('fReps').value,
    rest:   document.getElementById('fRest').value,
    muscle: document.getElementById('fMuscle').value,
    gif:    document.getElementById('fGif').value.trim(),
    notes:  document.getElementById('fNotes').value.trim(),
    weightHistory,
  });

  await saveUser();
  closeModal();
  currentDay = day;
  document.getElementById('sectionTitle').innerHTML = day.toUpperCase();
  renderDaysNav();
  renderExercises();
  updateProgress();
};


/* ============================================================
   MODAL MEDICIÓN CORPORAL
============================================================ */
window.openStatsModal = function () {
  document.getElementById('sDate').value = new Date().toISOString().split('T')[0];
  document.getElementById('statsOverlay').classList.add('open');
};
window.closeStatsModal = function () {
  document.getElementById('statsOverlay').classList.remove('open');
  ['sPeso','sEstatura','sGrasa','sMusculo','sNotes'].forEach(id => document.getElementById(id).value='');
};
window.handleStatsOverlayClick = function (e) {
  if (e.target === document.getElementById('statsOverlay')) closeStatsModal();
};
window.saveStat = async function () {
  const date     = document.getElementById('sDate').value;
  const peso     = document.getElementById('sPeso').value;
  const estatura = document.getElementById('sEstatura').value;
  const grasa    = document.getElementById('sGrasa').value;
  const musculo  = document.getElementById('sMusculo').value;
  const notes    = document.getElementById('sNotes').value.trim();
  if (!date) { alert('Selecciona una fecha'); return; }
  if (!peso && !estatura && !grasa && !musculo) { alert('Ingresa al menos un dato'); return; }
  stats.push({ id:Date.now().toString(), date, notes,
    peso:     peso     ? parseFloat(peso)     : null,
    estatura: estatura ? parseFloat(estatura) : null,
    grasa:    grasa    ? parseFloat(grasa)    : null,
    musculo:  musculo  ? parseFloat(musculo)  : null,
  });
  stats.sort((a,b) => a.date.localeCompare(b.date));
  await saveUser();
  closeStatsModal();
  renderStats();
};


/* ============================================================
   UTILS
============================================================ */
function formatDate(d) {
  if (!d) return '—';
  const [y,m,day] = d.split('-');
  const meses = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  return `${parseInt(day)} ${meses[parseInt(m)-1]} ${y}`;
}

function initApp() {
  document.getElementById('sectionTitle').innerHTML = currentDay.toUpperCase();
  renderDaysNav();
  renderExercises();
  updateProgress();
}


/* ============================================================
   INICIO
============================================================ */
document.getElementById('loginPass').addEventListener('keydown', e => { if (e.key==='Enter') handleLogin(); });
document.getElementById('loginUser').addEventListener('keydown', e => { if (e.key==='Enter') handleLogin(); });

const saved = sessionStorage.getItem('fuerzapro_session');
if (saved && USERS.find(u => u.username === saved)) {
  currentUser = saved;
  document.getElementById('loginScreen').classList.add('hidden');
  document.getElementById('appScreen').classList.remove('hidden');
  document.getElementById('userBadge').textContent = `👤 ${currentUser}`;
  startListening();
  startCycleListener();
}
