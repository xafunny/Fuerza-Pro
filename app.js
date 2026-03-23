/* ═══════════════════════════════════════════
   FUERZA PRO — app.js  (versión completa)
   ═══════════════════════════════════════════ */
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js";
import { getFirestore, doc, setDoc, getDoc, onSnapshot, collection, getDocs, deleteDoc }
  from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";

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

/* ── Constantes ── */
const ADMIN        = 'jhoao';
const DAYS         = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'];
const MEAL_TIMES   = ['Desayuno','Almuerzo','Merienda','Cena'];
const MEAL_ICONS   = { Desayuno:'🌅', Almuerzo:'☀️', Merienda:'🍎', Cena:'🌙' };
const MEDIDAS_KEYS = ['Cuello','Hombros','Pecho','Cintura','Abdomen','Cadera',
  'BrazoIzqR','BrazoIzqC','BrazoDerR','BrazoDerC',
  'AntebrazoIzq','AntebrazoDer','MusloIzq','MusloDer','PantIzq','PantDer'];
const MEDIDAS_LABELS = {
  Cuello:'Cuello', Hombros:'Hombros', Pecho:'Pecho', Cintura:'Cintura',
  Abdomen:'Abdomen', Cadera:'Cadera/Glúteos',
  BrazoIzqR:'Brazo Izq. Relajado', BrazoIzqC:'Brazo Izq. Contraído',
  BrazoDerR:'Brazo Der. Relajado',  BrazoDerC:'Brazo Der. Contraído',
  AntebrazoIzq:'Antebrazo Izq.', AntebrazoDer:'Antebrazo Der.',
  MusloIzq:'Muslo Izq.', MusloDer:'Muslo Der.',
  PantIzq:'Pantorrilla Izq.', PantDer:'Pantorrilla Der.'
};

/* ── Estado ── */
let currentUser   = null;
let currentDay    = DAYS[0];
let currentDietDay= DAYS[0];
let exercises     = [];
let doneSet       = [];
let meals         = [];       // dieta del usuario actual
let bodyData      = [];       // composición corporal
let medidasData   = [];       // medidas corporales
let cycle         = null;
let chartInstance = null;
let medidasChartInst = null;
let weightChartInst  = null;
let unsubUser     = null;
let unsubCycle    = null;
let editingWeightId  = null;
let currentBodyChart = 'peso';
let currentMedidasChart = 'Cuello';
let adminTargetUser = null;   // usuario que jhoao está editando en Admin

/* ═══════════════════════════════════════════
   AUTH — Login / Registro / Logout
═══════════════════════════════════════════ */
window.switchAuth = function(tab) {
  document.getElementById('loginForm').classList.toggle('hidden', tab !== 'login');
  document.getElementById('registerForm').classList.toggle('hidden', tab !== 'register');
  document.getElementById('authTabLogin').classList.toggle('active', tab === 'login');
  document.getElementById('authTabRegister').classList.toggle('active', tab === 'register');
};

window.handleLogin = async function() {
  const user = document.getElementById('loginUser').value.trim().toLowerCase();
  const pass = document.getElementById('loginPass').value.trim();
  const err  = document.getElementById('loginError');
  if (!user || !pass) { err.style.display='block'; err.textContent='⚠ Completa todos los campos'; return; }
  try {
    const snap = await getDoc(doc(db,'usuarios', user));
    if (!snap.exists() || snap.data().password !== pass) {
      err.style.display='block'; err.textContent='⚠ Usuario o contraseña incorrectos'; return;
    }
    err.style.display = 'none';
    loginSuccess(user);
  } catch(e) { err.style.display='block'; err.textContent='⚠ Error de conexión'; }
};

window.handleRegister = async function() {
  const user  = document.getElementById('regUser').value.trim().toLowerCase();
  const pass  = document.getElementById('regPass').value.trim();
  const pass2 = document.getElementById('regPass2').value.trim();
  const err   = document.getElementById('registerError');
  if (!user || !pass) { err.style.display='block'; err.textContent='⚠ Completa todos los campos'; return; }
  if (pass.length < 4) { err.style.display='block'; err.textContent='⚠ La contraseña debe tener al menos 4 caracteres'; return; }
  if (pass !== pass2)  { err.style.display='block'; err.textContent='⚠ Las contraseñas no coinciden'; return; }
  if (!/^[a-z0-9_]+$/.test(user)) { err.style.display='block'; err.textContent='⚠ Solo letras, números y guión bajo'; return; }
  try {
    const snap = await getDoc(doc(db,'usuarios', user));
    if (snap.exists()) { err.style.display='block'; err.textContent='⚠ Ese usuario ya existe'; return; }
    await setDoc(doc(db,'usuarios', user), { password: pass, exercises:[], doneSet:[], meals:[], bodyData:[], medidasData:[] });
    err.style.display='none';
    loginSuccess(user);
  } catch(e) { err.style.display='block'; err.textContent='⚠ Error al registrar'; }
};

function loginSuccess(user) {
  currentUser = user;
  sessionStorage.setItem('fuerzapro_session', user);
  document.getElementById('loginScreen').classList.add('hidden');
  document.getElementById('appScreen').classList.remove('hidden');
  document.getElementById('userBadge').textContent = `👤 ${user}`;
  document.getElementById('loginUser').value = '';
  document.getElementById('loginPass').value = '';
  // Mostrar elementos admin
  const isAdmin = user === ADMIN;
  document.querySelectorAll('.admin-only').forEach(el => el.classList.toggle('hidden', !isAdmin));
  // Día actual por defecto
  currentDay = DAYS[new Date().getDay() === 0 ? 6 : new Date().getDay() - 1];
  currentDietDay = currentDay;
  startListening();
  startCycleListener();
}

window.handleLogout = function() {
  if (unsubUser)  unsubUser();
  if (unsubCycle) unsubCycle();
  if (chartInstance)       { chartInstance.destroy();      chartInstance = null; }
  if (medidasChartInst)    { medidasChartInst.destroy();   medidasChartInst = null; }
  if (weightChartInst)     { weightChartInst.destroy();    weightChartInst = null; }
  currentUser = null; exercises=[]; doneSet=[]; meals=[]; bodyData=[]; medidasData=[]; cycle=null;
  sessionStorage.removeItem('fuerzapro_session');
  document.getElementById('appScreen').classList.add('hidden');
  document.getElementById('loginScreen').classList.remove('hidden');
};

/* ═══════════════════════════════════════════
   FIRESTORE
═══════════════════════════════════════════ */
function startListening() {
  unsubUser = onSnapshot(doc(db,'usuarios', currentUser), snap => {
    if (snap.exists()) {
      const d   = snap.data();
      exercises  = d.exercises  || [];
      doneSet    = d.doneSet    || [];
      meals      = d.meals      || [];
      bodyData   = d.bodyData   || [];
      medidasData= d.medidasData|| [];
    } else { exercises=[]; doneSet=[]; meals=[]; bodyData=[]; medidasData=[]; }
    initApp();
  });
}

async function saveUser(data) {
  const base = { exercises, doneSet, meals, bodyData, medidasData };
  try { await setDoc(doc(db,'usuarios',currentUser), {...base, ...data}, {merge:true}); }
  catch(e) { alert('Error al guardar. Revisa tu conexión.'); }
}

async function saveUserData(user, data) {
  try { await setDoc(doc(db,'usuarios',user), data, {merge:true}); }
  catch(e) { alert('Error al guardar.'); }
}

function startCycleListener() {
  unsubCycle = onSnapshot(doc(db,'config','ciclo'), snap => {
    cycle = snap.exists() ? snap.data() : null;
    if (!document.getElementById('panelCiclo').classList.contains('hidden')) renderCycle();
  });
}

/* ═══════════════════════════════════════════
   TABS
═══════════════════════════════════════════ */
window.switchTab = function(tab) {
  ['rutina','dieta','progreso','ciclo','admin'].forEach(t => {
    const panel = document.getElementById(`panel${cap(t)}`);
    const btn   = document.getElementById(`tab${cap(t)}`);
    if (panel) panel.classList.toggle('hidden', t !== tab);
    if (btn)   btn.classList.toggle('active', t === tab);
  });
  document.getElementById('btnAgregar').style.display   = (tab==='rutina' && currentUser===ADMIN) ? '' : 'none';
  document.getElementById('btnResetWeek').style.display = (tab==='rutina' && currentUser===ADMIN) ? '' : 'none';
  const btnMeal = document.getElementById('btnAddMeal');
  if (btnMeal) btnMeal.style.display = (tab==='dieta' && currentUser===ADMIN) ? '' : 'none';
  if (tab==='progreso') { switchProgressTab('comp'); }
  if (tab==='ciclo')    renderCycle();
  if (tab==='admin')    renderAdmin();
  if (tab==='dieta')    renderDietDaysNav();
};

window.switchProgressTab = function(sub) {
  ['comp','medidas','graficas'].forEach(s => {
    document.getElementById(`pp${cap(s)}`).classList.toggle('hidden', s !== sub);
    document.getElementById(`pstab${cap(s)}`).classList.toggle('active', s === sub);
  });
  if (sub==='comp')     renderBodyData();
  if (sub==='medidas')  renderMedidasData();
  if (sub==='graficas') renderGraficas();
};

function cap(s) { return s.charAt(0).toUpperCase()+s.slice(1); }

/* ═══════════════════════════════════════════
   RUTINA
═══════════════════════════════════════════ */
function renderDaysNav() {
  document.getElementById('daysNav').innerHTML = DAYS.map(day => {
    const count = exercises.filter(e => e.day===day).length;
    const badge = count ? `<span class="count">${count}</span>` : '';
    return `<button class="day-pill${day===currentDay?' active':''}" onclick="selectDay('${day}')">${day}${badge}</button>`;
  }).join('');
}

window.selectDay = function(day) {
  currentDay = day;
  document.getElementById('sectionTitle').innerHTML = day.toUpperCase();
  renderDaysNav();
  renderExercises();
};

function renderExercises(exList, targetUser) {
  const list   = document.getElementById('exercisesList');
  const isAdmin= currentUser === ADMIN;
  const src    = exList || exercises.filter(e=>e.day===currentDay);
  if (!src.length) {
    list.innerHTML = `<div class="empty-state"><div class="icon">🏋️</div><p>No hay ejercicios para <strong>${currentDay}</strong>.</p>${isAdmin?`<button onclick="openModal('${currentDay}')">+ Agregar ejercicio</button>`:''}</div>`;
    return;
  }
  list.innerHTML = `<div class="exercises-grid">${src.map((ex,i)=>buildCard(ex,i,src.length,targetUser)).join('')}</div>`;
}

function buildCard(ex, idx, total, targetUser) {
  const isDone  = doneSet.includes(ex.id);
  const isAdmin = currentUser === ADMIN;
  const wh      = ex.weightHistory || [];
  const lastW   = wh.length ? wh[wh.length-1] : null;
  const wBadge  = lastW
    ? `<span class="badge badge-weight">⚖️ ${lastW.kg} kg</span>`
    : `<span class="badge badge-weight-empty">⚖️ Sin peso</span>`;

  const gifSection = ex.gif
    ? `<div class="card-gif"><img src="${ex.gif}" loading="lazy" alt="${ex.name}"
         onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"/>
         <span class="placeholder" style="display:none">🏋️</span></div>`
    : `<div class="card-gif"><span class="placeholder">🏋️</span></div>`;

  const muscle = ex.muscle ? `<span class="muscle-group">${ex.muscle}</span><br>` : '';
  const sets   = ex.sets   ? `<span class="badge badge-sets">${ex.sets} series</span>` : '';
  const reps   = ex.reps   ? `<span class="badge badge-reps">${ex.reps} reps</span>` : '';
  const rest   = ex.rest   ? `<span class="badge badge-rest">⏱ ${ex.rest}</span>` : '';
  const notes  = ex.notes  ? `<div class="card-notes">${ex.notes}</div>` : '';
  const tu     = targetUser ? `,'${targetUser}'` : '';

  const adminBtns = isAdmin ? `
    <button class="btn-icon" onclick="editExercise('${ex.id}'${tu})" title="Editar">✏️</button>
    ${idx>0 ? `<button class="btn-icon" onclick="moveExercise('${ex.id}','up'${tu})" title="Subir">⬆️</button>` : ''}
    ${idx<total-1 ? `<button class="btn-icon" onclick="moveExercise('${ex.id}','down'${tu})" title="Bajar">⬇️</button>` : ''}
    <button class="btn-delete" onclick="deleteExercise('${ex.id}'${tu})" title="Eliminar">🗑</button>` : '';

  return `
    <div class="exercise-card" id="card-${ex.id}">
      ${gifSection}
      <div class="card-body">
        ${muscle}
        <div class="card-name">${ex.name}</div>
        <div class="card-meta">${sets}${reps}${rest}${wBadge}</div>
        ${notes}
      </div>
      <div class="card-actions">
        <button class="btn-done${isDone?' done':''}" onclick="toggleDone('${ex.id}')">
          ${isDone?'✓ Hecho':'Marcar hecho'}
        </button>
        <button class="btn-weight" onclick="openWeightModal('${ex.id}',${targetUser?`'${targetUser}'`:'null'})" title="Peso">⚖️</button>
        ${adminBtns}
      </div>
    </div>`;
}

window.toggleDone = async function(id) {
  doneSet.includes(id) ? doneSet=doneSet.filter(d=>d!==id) : doneSet.push(id);
  await saveUser({doneSet});
};

window.deleteExercise = async function(id, targetUser) {
  if (!confirm('¿Eliminar este ejercicio?')) return;
  const user = targetUser || currentUser;
  if (user === currentUser) {
    exercises = exercises.filter(e=>e.id!==id);
    await saveUser({exercises});
  } else {
    const snap = await getDoc(doc(db,'usuarios',user));
    const d    = snap.data();
    d.exercises = d.exercises.filter(e=>e.id!==id);
    await saveUserData(user, d);
    adminLoadUser();
  }
};

window.editExercise = async function(id, targetUser) {
  const user = targetUser || currentUser;
  let exList = exercises;
  if (user !== currentUser) {
    const snap = await getDoc(doc(db,'usuarios',user));
    exList = snap.data().exercises || [];
  }
  const ex = exList.find(e=>e.id===id);
  if (!ex) return;
  document.getElementById('exerciseModalTitle').textContent = 'Editar Ejercicio';
  document.getElementById('fName').value   = ex.name   || '';
  document.getElementById('fDay').value    = ex.day    || 'Lunes';
  document.getElementById('fSets').value   = ex.sets   || '';
  document.getElementById('fReps').value   = ex.reps   || '';
  document.getElementById('fRest').value   = ex.rest   || '';
  document.getElementById('fMuscle').value = ex.muscle || '';
  document.getElementById('fGif').value    = ex.gif    || '';
  document.getElementById('fNotes').value  = ex.notes  || '';
  document.getElementById('fWeight').value = '';
  document.getElementById('fEditId').value = id;
  document.getElementById('fTargetUser').value = targetUser || '';
  document.getElementById('overlay').classList.add('open');
};

window.moveExercise = async function(id, dir, targetUser) {
  const user = targetUser || currentUser;
  let exList, setFn;
  if (user === currentUser) {
    exList = exercises; setFn = async (list) => { exercises=list; await saveUser({exercises}); };
  } else {
    const snap = await getDoc(doc(db,'usuarios',user));
    exList = snap.data().exercises||[];
    setFn  = async (list) => { await saveUserData(user,{...snap.data(),exercises:list}); adminLoadUser(); };
  }
  const idx = exList.findIndex(e=>e.id===id);
  if (idx<0) return;
  const newIdx = dir==='up' ? idx-1 : idx+1;
  if (newIdx<0 || newIdx>=exList.length) return;
  [exList[idx], exList[newIdx]] = [exList[newIdx], exList[idx]];
  await setFn(exList);
};

window.confirmResetWeek = function() {
  if (!confirm('¿Resetear la semana? Todos los ejercicios se desmarcarán como "hechos".')) return;
  doneSet = [];
  saveUser({doneSet});
};

/* ═══════════════════════════════════════════
   MODAL EJERCICIO
═══════════════════════════════════════════ */
window.openModal = function(day) {
  document.getElementById('exerciseModalTitle').textContent = 'Nuevo Ejercicio';
  document.getElementById('fDay').value   = day || currentDay;
  document.getElementById('fEditId').value = '';
  document.getElementById('fTargetUser').value = '';
  document.getElementById('overlay').classList.add('open');
};
window.closeModal = function() {
  document.getElementById('overlay').classList.remove('open');
  ['fName','fSets','fReps','fRest','fGif','fNotes','fWeight','fEditId','fTargetUser']
    .forEach(id=>document.getElementById(id).value='');
  document.getElementById('fMuscle').value='';
  const p=document.getElementById('gifPreview');
  p.innerHTML='<span style="color:var(--muted);font-size:0.85rem">Preview aquí</span>';
  p.classList.remove('has-img');
  document.getElementById('gifError').style.display='none';
};
window.handleOverlayClick = function(e) {
  if (e.target===document.getElementById('overlay')) closeModal();
};

window.previewGif = function() {
  let url = document.getElementById('fGif').value.trim();
  const preview = document.getElementById('gifPreview');
  const errMsg  = document.getElementById('gifError');
  errMsg.style.display = 'none';
  if (!url) return;
  if (url.includes('giphy.com/gifs/') && !url.endsWith('.gif')) {
    const parts = url.split('-'); const hash = parts[parts.length-1].split('/')[0];
    if (hash) { url=`https://media.giphy.com/media/${hash}/giphy.gif`; document.getElementById('fGif').value=url; }
  }
  preview.innerHTML='<span style="color:var(--muted);font-size:0.85rem">Cargando...</span>';
  const img = new Image();
  img.crossOrigin='anonymous'; img.src=url;
  img.onload=()=>{ preview.innerHTML=''; img.style.cssText='width:100%;height:100%;object-fit:cover;border-radius:8px'; preview.appendChild(img); preview.classList.add('has-img'); };
  img.onerror=()=>{ errMsg.style.display='block'; preview.classList.remove('has-img'); preview.innerHTML='<span style="color:var(--muted);font-size:0.85rem">No se pudo cargar</span>'; };
};

window.saveExercise = async function() {
  const name = document.getElementById('fName').value.trim();
  const day  = document.getElementById('fDay').value;
  const editId = document.getElementById('fEditId').value;
  const targetUser = document.getElementById('fTargetUser').value || currentUser;
  if (!name) { alert('Ingresa el nombre del ejercicio'); return; }

  const weight = parseFloat(document.getElementById('fWeight').value);
  let snap, userData;
  if (targetUser !== currentUser) {
    snap = await getDoc(doc(db,'usuarios',targetUser));
    userData = snap.data();
  }
  const exList = targetUser===currentUser ? exercises : (userData.exercises||[]);

  if (editId) {
    const idx = exList.findIndex(e=>e.id===editId);
    if (idx>=0) {
      exList[idx] = { ...exList[idx],
        name, day,
        sets:   document.getElementById('fSets').value,
        reps:   document.getElementById('fReps').value,
        rest:   document.getElementById('fRest').value,
        muscle: document.getElementById('fMuscle').value,
        gif:    document.getElementById('fGif').value.trim(),
        notes:  document.getElementById('fNotes').value.trim(),
      };
      if (weight>0) {
        if (!exList[idx].weightHistory) exList[idx].weightHistory=[];
        exList[idx].weightHistory.push({kg:weight, date:today()});
      }
    }
  } else {
    const newEx = {
      id: Date.now().toString(), name, day,
      sets:   document.getElementById('fSets').value,
      reps:   document.getElementById('fReps').value,
      rest:   document.getElementById('fRest').value,
      muscle: document.getElementById('fMuscle').value,
      gif:    document.getElementById('fGif').value.trim(),
      notes:  document.getElementById('fNotes').value.trim(),
      weightHistory: weight>0 ? [{kg:weight, date:today()}] : [],
    };
    exList.push(newEx);
  }

  if (targetUser===currentUser) {
    exercises = exList;
    await saveUser({exercises});
  } else {
    await saveUserData(targetUser, {...userData, exercises:exList});
    adminLoadUser();
  }
  closeModal();
  if (targetUser===currentUser) {
    currentDay=day;
    document.getElementById('sectionTitle').innerHTML=day.toUpperCase();
    renderDaysNav(); renderExercises(); updateProgress();
  }
};

/* ═══════════════════════════════════════════
   PESO POR EJERCICIO
═══════════════════════════════════════════ */
window.openWeightModal = async function(id, targetUser) {
  editingWeightId = id;
  const user = targetUser || currentUser;
  let exList = exercises;
  if (user !== currentUser) {
    const snap = await getDoc(doc(db,'usuarios',user));
    exList = snap.data().exercises||[];
  }
  const ex = exList.find(e=>e.id===id);
  if (!ex) return;
  document.getElementById('weightModalTitle').textContent = `⚖️ ${ex.name}`;
  document.getElementById('wNewWeight').value = '';
  document.getElementById('weightOverlay').dataset.targetUser = targetUser || '';
  const wh = ex.weightHistory||[];
  const wrap = document.getElementById('weightHistoryWrap');
  if (wh.length) {
    wrap.innerHTML=`<div class="weight-history-title">Historial</div><div class="weight-history-list">${
      [...wh].reverse().map((w,i)=>`
        <div class="weight-history-row">
          <span class="wh-date">${formatDate(w.date)}</span>
          <span class="wh-kg">${w.kg} kg</span>
          <button class="wh-del" onclick="deleteWeightEntry('${id}',${wh.length-1-i},'${targetUser||''}')">✕</button>
        </div>`).join('')
    }</div>`;
  } else {
    wrap.innerHTML='<p style="color:var(--muted);font-size:0.82rem;margin-bottom:12px">Sin registros de peso aún.</p>';
  }
  document.getElementById('weightOverlay').classList.add('open');
};
window.closeWeightModal = function() { document.getElementById('weightOverlay').classList.remove('open'); editingWeightId=null; };

window.saveWeight = async function() {
  const kg  = parseFloat(document.getElementById('wNewWeight').value);
  if (!kg||kg<=0) { alert('Ingresa un peso válido'); return; }
  const targetUser = document.getElementById('weightOverlay').dataset.targetUser || currentUser;
  if (targetUser === currentUser) {
    const ex = exercises.find(e=>e.id===editingWeightId);
    if (!ex) return;
    if (!ex.weightHistory) ex.weightHistory=[];
    ex.weightHistory.push({kg, date:today()});
    await saveUser({exercises});
  } else {
    const snap = await getDoc(doc(db,'usuarios',targetUser));
    const d    = snap.data();
    const ex   = (d.exercises||[]).find(e=>e.id===editingWeightId);
    if (!ex) return;
    if (!ex.weightHistory) ex.weightHistory=[];
    ex.weightHistory.push({kg, date:today()});
    await saveUserData(targetUser, d);
  }
  closeWeightModal();
};

window.deleteWeightEntry = async function(exId, idx, targetUser) {
  if (!confirm('¿Eliminar este registro de peso?')) return;
  const user = targetUser || currentUser;
  if (user===currentUser) {
    const ex = exercises.find(e=>e.id===exId);
    if (ex) { ex.weightHistory.splice(idx,1); await saveUser({exercises}); }
  } else {
    const snap = await getDoc(doc(db,'usuarios',user));
    const d = snap.data();
    const ex = (d.exercises||[]).find(e=>e.id===exId);
    if (ex) { ex.weightHistory.splice(idx,1); await saveUserData(user,d); }
  }
  openWeightModal(exId, targetUser||null);
};

/* ═══════════════════════════════════════════
   DIETA
═══════════════════════════════════════════ */
function renderDietDaysNav() {
  document.getElementById('dietDaysNav').innerHTML = DAYS.map(day => {
    const count = meals.filter(m=>m.day===day).length;
    const badge = count ? `<span class="count">${count}</span>` : '';
    return `<button class="day-pill${day===currentDietDay?' active':''}" onclick="selectDietDay('${day}')">${day}${badge}</button>`;
  }).join('');
  renderDietContent();
}

window.selectDietDay = function(day) {
  currentDietDay = day;
  document.getElementById('dietSectionTitle').innerHTML = day.toUpperCase();
  renderDietDaysNav();
  renderDietContent();
};

function renderDietContent() {
  const cont  = document.getElementById('dietContent');
  const isAdmin = currentUser===ADMIN;
  const dayMeals = meals.filter(m=>m.day===currentDietDay);

  if (!dayMeals.length) {
    cont.innerHTML=`<div class="empty-state"><div class="icon">🥗</div><p>No hay comidas para <strong>${currentDietDay}</strong>.</p>${isAdmin?`<button onclick="openMealModal('${currentDietDay}')">+ Agregar comida</button>`:''}</div>`;
    return;
  }

  let html='';
  MEAL_TIMES.forEach(time => {
    const timeMeals = dayMeals.filter(m=>m.time===time);
    if (!timeMeals.length) return;
    const totCal  = timeMeals.reduce((s,m)=>s+(parseFloat(m.cal)||0),0);
    const totProt = timeMeals.reduce((s,m)=>s+(parseFloat(m.prot)||0),0);
    const totCarbs= timeMeals.reduce((s,m)=>s+(parseFloat(m.carbs)||0),0);
    const totFat  = timeMeals.reduce((s,m)=>s+(parseFloat(m.fat)||0),0);
    html+=`
      <div class="meal-block">
        <div class="meal-block-header">
          <span class="meal-time-title">${MEAL_ICONS[time]} ${time}</span>
          <div class="meal-macros-summary">
            ${totCal?`<span class="mmac cal">${Math.round(totCal)} kcal</span>`:''}
            ${totProt?`<span class="mmac prot">P:${Math.round(totProt)}g</span>`:''}
            ${totCarbs?`<span class="mmac carbs">C:${Math.round(totCarbs)}g</span>`:''}
            ${totFat?`<span class="mmac fat">G:${Math.round(totFat)}g</span>`:''}
          </div>
        </div>
        ${timeMeals.map(m=>buildMealCard(m,isAdmin)).join('')}
      </div>`;
  });
  cont.innerHTML = html;
}

function buildMealCard(m, isAdmin) {
  const macros = [
    m.cal   ? `<span class="badge badge-cal">${m.cal} kcal</span>` : '',
    m.prot  ? `<span class="badge badge-prot">P: ${m.prot}g</span>` : '',
    m.carbs ? `<span class="badge badge-carbs">C: ${m.carbs}g</span>` : '',
    m.fat   ? `<span class="badge badge-fat">G: ${m.fat}g</span>` : '',
  ].join('');
  const notes = m.notes ? `<div class="card-notes">${m.notes}</div>` : '';
  const adminBtns = isAdmin ? `
    <button class="btn-icon" onclick="editMeal('${m.id}')" title="Editar">✏️</button>
    <button class="btn-delete" onclick="deleteMeal('${m.id}')" title="Eliminar">🗑</button>` : '';
  return `
    <div class="meal-card">
      <div class="meal-card-body">
        <div class="meal-name">${m.name}${m.qty?` <span class="meal-qty">(${m.qty})</span>`:''}</div>
        <div class="card-meta">${macros}</div>
        ${notes}
      </div>
      <div class="meal-card-actions">${adminBtns}</div>
    </div>`;
}

window.openMealModal = function(day) {
  document.getElementById('mealModalTitle').textContent='Nueva Comida';
  document.getElementById('mealDay').value = day||currentDietDay;
  document.getElementById('mealEditId').value='';
  document.getElementById('mealTargetUser').value='';
  document.getElementById('mealOverlay').classList.add('open');
};
window.closeMealModal = function() {
  document.getElementById('mealOverlay').classList.remove('open');
  ['mealName','mealQty','mealCal','mealProt','mealCarbs','mealFat','mealNotes','mealEditId','mealTargetUser']
    .forEach(id=>document.getElementById(id).value='');
};

window.editMeal = function(id) {
  const m = meals.find(m=>m.id===id); if (!m) return;
  document.getElementById('mealModalTitle').textContent='Editar Comida';
  document.getElementById('mealTime').value  = m.time  || 'Desayuno';
  document.getElementById('mealDay').value   = m.day   || currentDietDay;
  document.getElementById('mealName').value  = m.name  || '';
  document.getElementById('mealQty').value   = m.qty   || '';
  document.getElementById('mealCal').value   = m.cal   || '';
  document.getElementById('mealProt').value  = m.prot  || '';
  document.getElementById('mealCarbs').value = m.carbs || '';
  document.getElementById('mealFat').value   = m.fat   || '';
  document.getElementById('mealNotes').value = m.notes || '';
  document.getElementById('mealEditId').value= id;
  document.getElementById('mealOverlay').classList.add('open');
};

window.deleteMeal = async function(id) {
  if (!confirm('¿Eliminar esta comida?')) return;
  meals = meals.filter(m=>m.id!==id);
  await saveUser({meals});
};

window.saveMeal = async function() {
  const name = document.getElementById('mealName').value.trim();
  if (!name) { alert('Ingresa el nombre del alimento'); return; }
  const editId = document.getElementById('mealEditId').value;
  const meal = {
    id:    editId || Date.now().toString(),
    time:  document.getElementById('mealTime').value,
    day:   document.getElementById('mealDay').value,
    name,
    qty:   document.getElementById('mealQty').value.trim(),
    cal:   document.getElementById('mealCal').value,
    prot:  document.getElementById('mealProt').value,
    carbs: document.getElementById('mealCarbs').value,
    fat:   document.getElementById('mealFat').value,
    notes: document.getElementById('mealNotes').value.trim(),
  };
  if (editId) { const i=meals.findIndex(m=>m.id===editId); if(i>=0) meals[i]=meal; }
  else meals.push(meal);
  await saveUser({meals});
  closeMealModal();
};

/* ═══════════════════════════════════════════
   COMPOSICIÓN CORPORAL
═══════════════════════════════════════════ */
// Semáforo de indicadores
const RANGES = {
  grasa:    { M:[[0,6,'Muy bajo','blue'],[6,14,'Atlético','green'],[14,18,'Bueno','green'],[18,25,'Normal','yellow'],[25,32,'Alto','orange'],[32,100,'Obeso','red']] },
  visceral: { all:[[0,9,'Normal ✅','green'],[9,15,'Alto ⚠️','orange'],[15,100,'Peligroso 🚨','red']] },
  bmi:      { all:[[0,18.5,'Bajo peso','blue'],[18.5,25,'Normal ✅','green'],[25,30,'Sobrepeso','orange'],[30,100,'Obesidad 🚨','red']] },
  agua:     { all:[[0,45,'Bajo','orange'],[45,65,'Normal ✅','green'],[65,100,'Alto','blue']] },
};
function getSemaforo(key, val) {
  if (!val) return '';
  const ranges = RANGES[key]?.all || RANGES[key]?.M || [];
  for (const [min,max,label,color] of ranges) {
    if (val>=min && val<max) return `<span class="semaforo ${color}">${label}</span>`;
  }
  return '';
}

window.openBodyModal = function() {
  document.getElementById('bDate').value = today();
  document.getElementById('bodyOverlay').classList.add('open');
};
window.closeBodyModal = function() {
  document.getElementById('bodyOverlay').classList.remove('open');
  ['bEdad','bEstatura','bPeso','bAgua','bGrasa','bHueso','bVisceral','bMusculo','bBMI','bBMR','bEdadFisio']
    .forEach(id=>document.getElementById(id).value='');
};

window.saveBody = async function() {
  const date = document.getElementById('bDate').value;
  if (!date) { alert('Selecciona una fecha'); return; }
  const peso = parseFloat(document.getElementById('bPeso').value)||null;
  const est  = parseFloat(document.getElementById('bEstatura').value)||null;
  let bmi = parseFloat(document.getElementById('bBMI').value)||null;
  let bmr = parseFloat(document.getElementById('bBMR').value)||null;
  const edad= parseFloat(document.getElementById('bEdad').value)||null;
  // Auto-calcular BMI y BMR
  if (!bmi && peso && est) bmi = +(peso/((est/100)**2)).toFixed(1);
  if (!bmr && peso && est && edad) bmr = Math.round(10*peso + 6.25*est - 5*edad + 5);
  const record = { id:Date.now().toString(), date,
    edad, estatura:est, peso, agua:parseFloat(document.getElementById('bAgua').value)||null,
    grasa:parseFloat(document.getElementById('bGrasa').value)||null,
    hueso:parseFloat(document.getElementById('bHueso').value)||null,
    visceral:parseFloat(document.getElementById('bVisceral').value)||null,
    musculo:parseFloat(document.getElementById('bMusculo').value)||null,
    bmi, bmr, edadFisio:parseFloat(document.getElementById('bEdadFisio').value)||null,
  };
  bodyData.push(record);
  bodyData.sort((a,b)=>a.date.localeCompare(b.date));
  await saveUser({bodyData});
  closeBodyModal();
  renderBodyData();
};

function renderBodyData() {
  const latest  = document.getElementById('bodyLatest');
  const history = document.getElementById('bodyHistory');
  if (!bodyData.length) {
    latest.innerHTML='<div class="empty-state" style="padding:40px 20px"><div class="icon">🧬</div><p>Agrega tu primera medición de composición corporal.</p></div>';
    history.innerHTML=''; return;
  }
  const last = bodyData[bodyData.length-1];
  const fields = [
    {k:'peso',label:'Peso',unit:'kg',icon:'⚖️'},
    {k:'estatura',label:'Estatura',unit:'cm',icon:'📏'},
    {k:'grasa',label:'Grasa corporal',unit:'%',icon:'🔥'},
    {k:'musculo',label:'Masa muscular',unit:'%',icon:'💪'},
    {k:'agua',label:'Agua corporal',unit:'%',icon:'💧'},
    {k:'bmi',label:'BMI',unit:'',icon:'📊'},
    {k:'bmr',label:'BMR',unit:'kcal',icon:'🔋'},
    {k:'visceral',label:'Grasa visceral',unit:'',icon:'⚠️'},
    {k:'hueso',label:'Masa ósea',unit:'kg',icon:'🦴'},
    {k:'edadFisio',label:'Edad fisiológica',unit:'años',icon:'🕐'},
  ];
  latest.innerHTML=`
    <div class="stats-cards">
      ${fields.filter(f=>last[f.k]!=null).map(f=>`
        <div class="stat-card">
          <div class="stat-icon">${f.icon}</div>
          <div class="stat-value">${last[f.k]}<span>${f.unit}</span></div>
          <div class="stat-label">${f.label}</div>
          ${getSemaforo(f.k, last[f.k])}
        </div>`).join('')}
    </div>
    <p class="stats-last-date">Último registro: <strong>${formatDate(last.date)}</strong> · ${bodyData.length} registro${bodyData.length>1?'s':''}</p>`;

  history.innerHTML=`<div class="stats-history-title">Historial</div>`+
    [...bodyData].reverse().map((r,i)=>`
      <div class="history-row">
        <div class="history-date">${formatDate(r.date)}</div>
        <div class="history-values">
          ${r.peso?`<span class="hv-badge">⚖️ ${r.peso}kg</span>`:''}
          ${r.grasa?`<span class="hv-badge">🔥 ${r.grasa}%</span>`:''}
          ${r.musculo?`<span class="hv-badge">💪 ${r.musculo}%</span>`:''}
          ${r.bmi?`<span class="hv-badge">BMI ${r.bmi}</span>`:''}
          ${r.visceral?`<span class="hv-badge">Visceral ${r.visceral} ${getSemaforo('visceral',r.visceral)}</span>`:''}
        </div>
        <button class="btn-delete-stat" onclick="deleteBody(${bodyData.length-1-i})">🗑</button>
      </div>`).join('');
}

window.deleteBody = async function(i) {
  if (!confirm('¿Eliminar?')) return;
  bodyData.splice(i,1);
  await saveUser({bodyData}); renderBodyData();
};

/* ═══════════════════════════════════════════
   MEDIDAS CORPORALES
═══════════════════════════════════════════ */
window.openMedidasModal = function() {
  document.getElementById('mDate').value = today();
  document.getElementById('medidasOverlay').classList.add('open');
};
window.closeMedidasModal = function() {
  document.getElementById('medidasOverlay').classList.remove('open');
  MEDIDAS_KEYS.forEach(k=>{ const el=document.getElementById('m'+k); if(el) el.value=''; });
  document.getElementById('mDate').value='';
};

window.saveMedidas = async function() {
  const date = document.getElementById('mDate').value;
  if (!date) { alert('Selecciona una fecha'); return; }
  const record = { id:Date.now().toString(), date };
  MEDIDAS_KEYS.forEach(k=>{ const v=parseFloat(document.getElementById('m'+k)?.value)||null; if(v) record[k]=v; });
  if (Object.keys(record).length<=2) { alert('Ingresa al menos una medida'); return; }
  medidasData.push(record);
  medidasData.sort((a,b)=>a.date.localeCompare(b.date));
  await saveUser({medidasData});
  closeMedidasModal();
  renderMedidasData();
};

function renderMedidasData() {
  const latest  = document.getElementById('medidasLatest');
  const history = document.getElementById('medidasHistory');
  if (!medidasData.length) {
    latest.innerHTML='<div class="empty-state" style="padding:40px 20px"><div class="icon">📐</div><p>Agrega tu primera medición corporal.</p></div>';
    history.innerHTML=''; return;
  }
  const last = medidasData[medidasData.length-1];
  const first= medidasData[0];
  latest.innerHTML=`
    <div class="medidas-table">
      <div class="mt-header"><span>Medida</span><span>Actual</span><span>Cambio</span></div>
      ${MEDIDAS_KEYS.filter(k=>last[k]!=null).map(k=>{
        const diff = first[k] && last[k] ? (last[k]-first[k]).toFixed(1) : null;
        const color= diff===null?'':parseFloat(diff)>0?'var(--success)':'#ff6b6b';
        return `<div class="mt-row">
          <span>${MEDIDAS_LABELS[k]}</span>
          <span><strong>${last[k]} cm</strong></span>
          <span style="color:${color}">${diff!==null?(parseFloat(diff)>0?'+':'')+diff+' cm':'—'}</span>
        </div>`;
      }).join('')}
    </div>
    <p class="stats-last-date" style="margin-top:12px">Último registro: <strong>${formatDate(last.date)}</strong> · ${medidasData.length} registro${medidasData.length>1?'s':''}</p>`;

  history.innerHTML=`<div class="stats-history-title">Historial</div>`+
    [...medidasData].reverse().map((r,i)=>`
      <div class="history-row">
        <div class="history-date">${formatDate(r.date)}</div>
        <div class="history-values">${MEDIDAS_KEYS.filter(k=>r[k]).map(k=>`<span class="hv-badge">${MEDIDAS_LABELS[k]}: ${r[k]}cm</span>`).join('')}</div>
        <button class="btn-delete-stat" onclick="deleteMedida(${medidasData.length-1-i})">🗑</button>
      </div>`).join('');
}

window.deleteMedida = async function(i) {
  if (!confirm('¿Eliminar?')) return;
  medidasData.splice(i,1);
  await saveUser({medidasData}); renderMedidasData();
};

/* ═══════════════════════════════════════════
   GRÁFICAS
═══════════════════════════════════════════ */
function renderGraficas() {
  renderBodyChart(currentBodyChart);
  renderMedidasChart(currentMedidasChart);
  renderWeightCharts();
}

window.switchBodyChart = function(type) {
  currentBodyChart=type;
  document.querySelectorAll('.csub').forEach(b=>{
    const map={peso:'peso',grasa:'grasa',musculo:'músculo',agua:'agua'};
    b.classList.toggle('active', b.textContent.toLowerCase()===map[type]||b.textContent.toLowerCase()===type);
  });
  renderBodyChart(type);
};

function renderBodyChart(type) {
  const canvas=document.getElementById('bodyChart');
  const empty =document.getElementById('bodyChartEmpty');
  const data  =bodyData.filter(r=>r[type]!=null);
  if (data.length<2) { canvas.style.display='none'; empty.style.display='flex'; return; }
  canvas.style.display='block'; empty.style.display='none';
  const colors={peso:'#c0392b',grasa:'#e74c3c',musculo:'#922b21',agua:'#5dade2'};
  const units ={peso:'kg',grasa:'%',musculo:'%',agua:'%'};
  if (chartInstance) chartInstance.destroy();
  chartInstance=new Chart(canvas,{type:'line',data:{
    labels:data.map(r=>formatDate(r.date)),
    datasets:[{label:`${type} (${units[type]})`,data:data.map(r=>r[type]),
      borderColor:colors[type],backgroundColor:colors[type]+'22',
      borderWidth:2.5,pointBackgroundColor:colors[type],pointRadius:5,tension:0.3,fill:true}]
  },options:{responsive:true,plugins:{legend:{labels:{color:'#f0f0f0',font:{family:'DM Sans'}}},
    tooltip:{callbacks:{label:c=>` ${c.parsed.y} ${units[type]}`}}},
    scales:{x:{ticks:{color:'#888'},grid:{color:'#2a2a30'}},y:{ticks:{color:'#888'},grid:{color:'#2a2a30'}}}}});
}

function renderMedidasChart(key) {
  // Build subtabs
  const tabs = document.getElementById('medidasChartTabs');
  tabs.innerHTML = MEDIDAS_KEYS.map(k=>`
    <button class="csub${k===key?' active':''}" onclick="switchMedidasChart('${k}')">${MEDIDAS_LABELS[k]}</button>`).join('');
  const canvas=document.getElementById('medidasChart');
  const empty =document.getElementById('medidasChartEmpty');
  const data  =medidasData.filter(r=>r[key]!=null);
  if (data.length<2) { canvas.style.display='none'; empty.style.display='flex'; return; }
  canvas.style.display='block'; empty.style.display='none';
  if (medidasChartInst) medidasChartInst.destroy();
  medidasChartInst=new Chart(canvas,{type:'line',data:{
    labels:data.map(r=>formatDate(r.date)),
    datasets:[{label:`${MEDIDAS_LABELS[key]} (cm)`,data:data.map(r=>r[key]),
      borderColor:'#c0392b',backgroundColor:'#c0392b22',
      borderWidth:2.5,pointBackgroundColor:'#c0392b',pointRadius:5,tension:0.3,fill:true}]
  },options:{responsive:true,plugins:{legend:{labels:{color:'#f0f0f0',font:{family:'DM Sans'}}}},
    scales:{x:{ticks:{color:'#888'},grid:{color:'#2a2a30'}},y:{ticks:{color:'#888'},grid:{color:'#2a2a30'}}}}});
}

window.switchMedidasChart = function(key) { currentMedidasChart=key; renderMedidasChart(key); };

function renderWeightCharts() {
  const sec = document.getElementById('weightChartSection');
  const withHistory = exercises.filter(e=>(e.weightHistory||[]).length>=2);
  if (!withHistory.length) {
    sec.innerHTML='<p style="color:var(--muted);font-size:0.88rem">Agrega al menos 2 registros de peso en un ejercicio para ver su gráfica.</p>';
    return;
  }
  sec.innerHTML = withHistory.map(ex=>`
    <div class="chart-section" style="margin-bottom:20px">
      <div style="font-size:0.9rem;font-weight:600;color:var(--text);margin-bottom:12px">${ex.name}</div>
      <canvas id="wc-${ex.id}" height="80"></canvas>
    </div>`).join('');
  withHistory.forEach(ex=>{
    const canvas=document.getElementById(`wc-${ex.id}`);
    new Chart(canvas,{type:'line',data:{
      labels:ex.weightHistory.map(w=>formatDate(w.date)),
      datasets:[{label:'Peso (kg)',data:ex.weightHistory.map(w=>w.kg),
        borderColor:'#c0392b',backgroundColor:'#c0392b22',
        borderWidth:2,pointBackgroundColor:'#c0392b',pointRadius:4,tension:0.3,fill:true}]
    },options:{responsive:true,plugins:{legend:{labels:{color:'#f0f0f0',font:{family:'DM Sans'}}}},
      scales:{x:{ticks:{color:'#888'},grid:{color:'#2a2a30'}},y:{ticks:{color:'#888'},grid:{color:'#2a2a30'}}}}});
  });
}

/* ═══════════════════════════════════════════
   CICLO
═══════════════════════════════════════════ */
function renderCycle() {
  const hero=document.getElementById('cycleHero');
  const cfg =document.getElementById('cycleConfig');
  if (cfg) cfg.classList.toggle('hidden', currentUser!==ADMIN);
  if (cycle?.start) {
    document.getElementById('cycleStart').value = cycle.start;
    document.getElementById('cycleEnd').value   = cycle.end;
    document.getElementById('cycleName').value  = cycle.name||'';
  }
  if (!cycle?.start||!cycle?.end) {
    hero.innerHTML=`<div class="cycle-empty"><span>📅</span><p>No hay ciclo configurado.</p></div>`; return;
  }
  const t0=new Date(); t0.setHours(0,0,0,0);
  const start=new Date(cycle.start+'T00:00:00');
  const end  =new Date(cycle.end+'T00:00:00');
  const total=Math.round((end-start)/86400000);
  const elapsed=Math.round((t0-start)/86400000);
  const rem=Math.round((end-t0)/86400000);
  const pct=Math.min(100,Math.max(0,Math.round(elapsed/total*100)));
  let status='';
  if (t0<start) status=`<div class="cycle-status pending">⏳ Empieza en ${Math.round((start-t0)/86400000)} días</div>`;
  else if (t0>end) status=`<div class="cycle-status done">✅ ¡Ciclo completado!</div>`;
  else {
    const w=Math.floor(rem/7), d=rem%7;
    const txt=[(w>0?`${w} sem`:''),(d>0?`${d} días`:'')].filter(Boolean).join(' y ');
    status=`<div class="cycle-status ${rem<=7?'warning':'active'}">${rem<=7?'🚨':'🏃'} Quedan <strong>${txt}</strong></div>`;
  }
  hero.innerHTML=`
    ${cycle.name?`<div class="cycle-name">${cycle.name}</div>`:''}
    <div class="cycle-dates"><span>📅 ${formatDate(cycle.start)}</span><span class="cycle-arrow">→</span><span>📅 ${formatDate(cycle.end)}</span></div>
    ${status}
    <div class="cycle-bar-wrap"><div class="cycle-bar-fill" style="width:${pct}%"></div></div>
    <div class="cycle-bar-labels"><span>Inicio</span><span style="color:var(--accent);font-weight:700">${pct}%</span><span>Fin</span></div>
    <div class="cycle-mini-stats">
      <div class="cms-item"><span class="cms-val">${total}</span><span class="cms-label">días totales</span></div>
      <div class="cms-item"><span class="cms-val">${Math.max(0,elapsed)}</span><span class="cms-label">cursados</span></div>
      <div class="cms-item"><span class="cms-val">${Math.max(0,rem)}</span><span class="cms-label">restantes</span></div>
    </div>`;
}

window.saveCycle = async function() {
  const start=document.getElementById('cycleStart').value;
  const end  =document.getElementById('cycleEnd').value;
  const name =document.getElementById('cycleName').value.trim();
  if (!start||!end) { alert('Selecciona inicio y fin'); return; }
  if (end<=start)   { alert('El fin debe ser después del inicio'); return; }
  await setDoc(doc(db,'config','ciclo'),{start,end,name});
};

/* ═══════════════════════════════════════════
   ADMIN
═══════════════════════════════════════════ */
async function renderAdmin() {
  const snap = await getDocs(collection(db,'usuarios'));
  const users= snap.docs.map(d=>d.id).filter(u=>u!==ADMIN);
  // Lista de usuarios
  document.getElementById('usersList').innerHTML=users.length
    ? users.map(u=>`<div class="user-row"><span class="user-row-name">👤 ${u}</span></div>`).join('')
    : '<p style="color:var(--muted)">No hay otros usuarios registrados.</p>';
  // Select de gestión
  const sel=document.getElementById('adminViewUser');
  sel.innerHTML='<option value="">— Seleccionar —</option>'+users.map(u=>`<option value="${u}">${u}</option>`).join('');
  // Select copiar rutina
  const from=document.getElementById('copyFrom');
  const to  =document.getElementById('copyTo');
  const allU=[ADMIN,...users];
  from.innerHTML=allU.map(u=>`<option value="${u}">${u}</option>`).join('');
  to.innerHTML  =allU.map(u=>`<option value="${u}">${u}</option>`).join('');
}

window.adminLoadUser = async function() {
  const user=document.getElementById('adminViewUser').value;
  const panel=document.getElementById('adminUserPanel');
  if (!user) { panel.innerHTML=''; return; }
  adminTargetUser=user;
  const snap=await getDoc(doc(db,'usuarios',user));
  if (!snap.exists()) { panel.innerHTML='<p style="color:var(--muted)">Usuario sin datos.</p>'; return; }
  const d=snap.data();
  const exs=d.exercises||[];
  const dayTabs=DAYS.map(day=>{
    const count=exs.filter(e=>e.day===day).length;
    return `<button class="day-pill" onclick="adminShowDay('${day}','${user}')" style="font-size:0.75rem;padding:6px 12px">${day}${count?` (${count})`:''}</button>`;
  }).join('');
  panel.innerHTML=`
    <div class="admin-user-header">
      <strong style="color:var(--accent)">👤 ${user}</strong>
      <button class="header-btn" style="font-size:0.78rem;padding:7px 14px" onclick="adminOpenExercise('${user}')">+ Ejercicio</button>
    </div>
    <div class="days-nav" style="padding:12px 0;border:none">${dayTabs}</div>
    <div id="adminExList"></div>`;
};

window.adminShowDay = function(day, user) {
  currentDay=day;
  getDoc(doc(db,'usuarios',user)).then(snap=>{
    const exs=(snap.data()?.exercises||[]).filter(e=>e.day===day);
    const list=document.getElementById('adminExList');
    if (!exs.length) { list.innerHTML=`<p style="color:var(--muted);padding:12px 0">Sin ejercicios para ${day}.</p>`; return; }
    list.innerHTML=`<div class="exercises-grid">${exs.map((ex,i)=>buildCard(ex,i,exs.length,user)).join('')}</div>`;
  });
};

window.adminOpenExercise = function(user) {
  document.getElementById('fTargetUser').value=user;
  document.getElementById('fEditId').value='';
  document.getElementById('exerciseModalTitle').textContent=`Nuevo ejercicio para ${user}`;
  document.getElementById('overlay').classList.add('open');
};

window.openCopyRoutine = async function() {
  await renderAdmin();
  document.getElementById('copyOverlay').classList.add('open');
};
window.closeCopyRoutine = function() { document.getElementById('copyOverlay').classList.remove('open'); };

window.executeCopyRoutine = async function() {
  const from=document.getElementById('copyFrom').value;
  const to  =document.getElementById('copyTo').value;
  if (!from||!to||from===to) { alert('Selecciona usuarios diferentes'); return; }
  const snapF=await getDoc(doc(db,'usuarios',from));
  const snapT=await getDoc(doc(db,'usuarios',to));
  if (!snapF.exists()) { alert(`Usuario ${from} no encontrado`); return; }
  const fromEx=(snapF.data().exercises||[]).map(e=>({...e,id:Date.now().toString()+Math.random().toString(36).slice(2)}));
  const toData =snapT.exists()?snapT.data():{exercises:[],doneSet:[],meals:[],bodyData:[],medidasData:[]};
  toData.exercises=[...(toData.exercises||[]),...fromEx];
  await saveUserData(to,toData);
  closeCopyRoutine();
  alert(`✅ Rutina de ${from} copiada a ${to} exitosamente`);
};

/* ═══════════════════════════════════════════
   PROGRESO SEMANAL
═══════════════════════════════════════════ */
function updateProgress() {
  const total=exercises.length;
  const done =exercises.filter(e=>doneSet.includes(e.id)).length;
  const pct  =total===0?0:Math.round(done/total*100);
  document.getElementById('progressFill').style.width=pct+'%';
  document.getElementById('progressPct').textContent=pct+'%';
}

/* ═══════════════════════════════════════════
   UTILS
═══════════════════════════════════════════ */
function today() { return new Date().toISOString().split('T')[0]; }
function formatDate(d) {
  if (!d) return '—';
  const [y,m,day]=d.split('-');
  const M=['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  return `${parseInt(day)} ${M[parseInt(m)-1]} ${y}`;
}

/* ═══════════════════════════════════════════
   INICIO
═══════════════════════════════════════════ */
function initApp() {
  document.getElementById('sectionTitle').innerHTML=currentDay.toUpperCase();
  renderDaysNav();
  renderExercises();
  updateProgress();
}

document.getElementById('loginPass').addEventListener('keydown',e=>{if(e.key==='Enter')handleLogin();});
document.getElementById('loginUser').addEventListener('keydown',e=>{if(e.key==='Enter')handleLogin();});
document.getElementById('regPass2').addEventListener('keydown',e=>{if(e.key==='Enter')handleRegister();});

// Restaurar sesión
const saved=sessionStorage.getItem('fuerzapro_session');
if (saved) {
  getDoc(doc(db,'usuarios',saved)).then(snap=>{
    if (snap.exists()) loginSuccess(saved);
  });
}
