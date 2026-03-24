/* ═══════════════════════════════════════════
   FUERZA PRO — app.js
   - jhoao y karen: usuario/contraseña fijos en código
   - Otros usuarios: registro con correo electrónico
═══════════════════════════════════════════ */
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js";
import {
  getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword,
  sendEmailVerification, sendPasswordResetEmail, signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";
import {
  getFirestore, doc, setDoc, getDoc, onSnapshot, collection, getDocs
} from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey:            "AIzaSyALUv_MuDpzol8ArgD9gOw8gIYruy1bRog",
  authDomain:        "fuerzapro-e9d6f.firebaseapp.com",
  projectId:         "fuerzapro-e9d6f",
  storageBucket:     "fuerzapro-e9d6f.firebasestorage.app",
  messagingSenderId: "589184423001",
  appId:             "1:589184423001:web:e3088e42caebea8d9bcd48"
};

const fbApp = initializeApp(firebaseConfig);
const auth  = getAuth(fbApp);
const db    = getFirestore(fbApp);

/* ══════════════════════════════════════════
   USUARIOS FIJOS (jhoao y karen)
   Para cambiar: edita username, password o email
══════════════════════════════════════════ */
const FIXED_USERS = [
  {
    username: 'jhoao',
    password: 'Sxxafunny28',
    email:    'jhoaoxavier2365335@gmail.com',
    isAdmin:  true
  },
  {
    username: 'karen',
    password: 'karen',
    email:    null   // karen no tiene correo fijo, usa solo usuario/contraseña
  }
];

/* ── Constantes ── */
const ADMIN_USERNAME = 'jhoao';
const DAYS       = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'];
const MEAL_TIMES = ['Desayuno','Almuerzo','Merienda','Cena'];
const MEAL_ICONS = { Desayuno:'🌅', Almuerzo:'☀️', Merienda:'🍎', Cena:'🌙' };
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

/* ── Estado global ── */
let currentUser      = null;
let currentUID       = null;
let currentDay       = DAYS[0];
let currentDietDay   = DAYS[0];
let exercises        = [];
let doneSet          = [];
let meals            = [];
let bodyData         = [];
let medidasData      = [];
let cycle            = null;
let chartInstance    = null;
let medidasChartInst = null;
let unsubUser        = null;
let unsubCycle       = null;
let editingWeightId  = null;
let currentBodyChart     = 'peso';
let currentMedidasChart  = 'Cuello';

/* ══════════════════════════════════════════
   AUTH TABS
══════════════════════════════════════════ */
window.switchAuth = function(tab) {
  ['login','register','forgot'].forEach(t => {
    document.getElementById(`${t}Form`).classList.toggle('hidden', t !== tab);
  });
  document.getElementById('authTabLogin').classList.toggle('active', tab === 'login');
  document.getElementById('authTabRegister').classList.toggle('active', tab === 'register');
};

/* ══════════════════════════════════════════
   LOGIN
   Primero intenta con usuarios fijos,
   si no coincide usa Firebase Auth
══════════════════════════════════════════ */
window.handleLogin = async function() {
  const inputUser  = document.getElementById('loginEmail').value.trim().toLowerCase();
  const inputPass  = document.getElementById('loginPass').value;
  const errEl      = document.getElementById('loginError');
  errEl.style.display = 'none';

  if (!inputUser || !inputPass) {
    showErr(errEl, '⚠ Completa todos los campos'); return;
  }

  // ── Verificar si es usuario fijo (jhoao o karen) ──
  const fixedUser = FIXED_USERS.find(u =>
    u.username.toLowerCase() === inputUser && u.password === inputPass
  );

  if (fixedUser) {
    // Login con usuario fijo — guardar/actualizar en Firestore con su username
    const docRef = doc(db, 'usuarios', fixedUser.username);
    const snap   = await getDoc(docRef);
    if (!snap.exists()) {
      await setDoc(docRef, {
        username: fixedUser.username,
        exercises: [], doneSet: [], meals: [], bodyData: [], medidasData: []
      });
    }
    currentUID  = fixedUser.username; // usamos username como UID para usuarios fijos
    currentUser = fixedUser.username;
    sessionStorage.setItem('fuerzapro_fixed_session', fixedUser.username);
    enterApp(fixedUser.username);
    return;
  }

  // ── Si no es usuario fijo, intentar con Firebase Auth (correo) ──
  // El campo puede ser correo o username — si no tiene @ buscamos el correo
  let emailToUse = inputUser;
  if (!inputUser.includes('@')) {
    // Buscar correo por username en Firestore
    const snap = await getDoc(doc(db, 'usernames', inputUser));
    if (snap.exists()) {
      emailToUse = snap.data().email;
    } else {
      showErr(errEl, '⚠ Usuario o contraseña incorrectos'); return;
    }
  }

  try {
    await signInWithEmailAndPassword(auth, emailToUse, inputPass);
    // onAuthStateChanged se encarga del resto
  } catch(e) {
    showErr(errEl, firebaseErrMsg(e.code));
  }
};

/* ══════════════════════════════════════════
   REGISTRO (solo para usuarios nuevos, no jhoao/karen)
══════════════════════════════════════════ */
window.handleRegister = async function() {
  const username = document.getElementById('regUsername').value.trim().toLowerCase();
  const email    = document.getElementById('regEmail').value.trim();
  const pass     = document.getElementById('regPass').value;
  const pass2    = document.getElementById('regPass2').value;
  const errEl    = document.getElementById('registerError');
  errEl.style.display = 'none';

  if (!username || !email || !pass) { showErr(errEl, '⚠ Completa todos los campos'); return; }
  if (!/^[a-z0-9_]+$/.test(username)) { showErr(errEl, '⚠ Usuario: solo letras minúsculas, números y guión bajo'); return; }
  if (pass.length < 6) { showErr(errEl, '⚠ Contraseña: mínimo 6 caracteres'); return; }
  if (pass !== pass2)  { showErr(errEl, '⚠ Las contraseñas no coinciden'); return; }

  // No permitir registrar jhoao o karen
  if (FIXED_USERS.find(u => u.username === username)) {
    showErr(errEl, '⚠ Ese nombre de usuario no está disponible'); return;
  }

  // Verificar username disponible
  const snapU = await getDoc(doc(db, 'usernames', username));
  if (snapU.exists()) { showErr(errEl, '⚠ Ese nombre de usuario ya está en uso'); return; }

  try {
    const cred = await createUserWithEmailAndPassword(auth, email, pass);
    await setDoc(doc(db, 'usernames', username), { uid: cred.user.uid, email });
    await setDoc(doc(db, 'usuarios', cred.user.uid), {
      username, email,
      exercises: [], doneSet: [], meals: [], bodyData: [], medidasData: []
    });
    await sendEmailVerification(cred.user);
    document.getElementById('verifyNotice').classList.remove('hidden');
    ['regUsername','regEmail','regPass','regPass2'].forEach(id => document.getElementById(id).value = '');
  } catch(e) {
    showErr(errEl, firebaseErrMsg(e.code));
  }
};

/* ══════════════════════════════════════════
   RECUPERAR CONTRASEÑA
══════════════════════════════════════════ */
window.handleForgot = async function() {
  const email  = document.getElementById('forgotEmail').value.trim();
  const errEl  = document.getElementById('forgotError');
  const succEl = document.getElementById('forgotSuccess');
  errEl.style.display = 'none'; succEl.classList.add('hidden');
  if (!email) { showErr(errEl, '⚠ Ingresa tu correo'); return; }
  try {
    await sendPasswordResetEmail(auth, email);
    succEl.classList.remove('hidden');
  } catch(e) {
    showErr(errEl, firebaseErrMsg(e.code));
  }
};

/* ══════════════════════════════════════════
   LOGOUT
══════════════════════════════════════════ */
window.handleLogout = async function() {
  if (unsubUser)  unsubUser();
  if (unsubCycle) unsubCycle();
  if (chartInstance)    { chartInstance.destroy();    chartInstance = null; }
  if (medidasChartInst) { medidasChartInst.destroy(); medidasChartInst = null; }
  currentUser = null; currentUID = null;
  exercises = []; doneSet = []; meals = []; bodyData = []; medidasData = []; cycle = null;
  sessionStorage.removeItem('fuerzapro_fixed_session');
  try { await signOut(auth); } catch(e) {}
  document.getElementById('appScreen').classList.add('hidden');
  document.getElementById('loginScreen').classList.remove('hidden');
  switchAuth('login');
};

/* ══════════════════════════════════════════
   onAuthStateChanged — usuarios de Firebase Auth
══════════════════════════════════════════ */
onAuthStateChanged(auth, async (user) => {
  if (!user) return;
  // Si ya hay sesión fija activa, ignorar
  if (sessionStorage.getItem('fuerzapro_fixed_session')) return;

  currentUID = user.uid;
  const snap = await getDoc(doc(db, 'usuarios', user.uid));
  const userData = snap.exists() ? snap.data() : {};
  currentUser = userData.username || user.email.split('@')[0];

  if (!snap.exists()) {
    await setDoc(doc(db, 'usuarios', user.uid), {
      username: currentUser, email: user.email,
      exercises: [], doneSet: [], meals: [], bodyData: [], medidasData: []
    });
  }
  enterApp(currentUser);
});

/* ══════════════════════════════════════════
   ENTRAR A LA APP
══════════════════════════════════════════ */
function enterApp(username) {
  document.getElementById('loginScreen').classList.add('hidden');
  document.getElementById('appScreen').classList.remove('hidden');
  document.getElementById('userBadge').textContent = `👤 ${username}`;

  const isAdmin = username === ADMIN_USERNAME;
  document.querySelectorAll('.admin-only').forEach(el => el.classList.toggle('hidden', !isAdmin));

  // Día actual automático
  const dayIdx = new Date().getDay();
  currentDay     = DAYS[dayIdx === 0 ? 6 : dayIdx - 1];
  currentDietDay = currentDay;

  startListening();
  startCycleListener();
}

/* ══════════════════════════════════════════
   FIRESTORE
══════════════════════════════════════════ */
function startListening() {
  if (unsubUser) unsubUser();
  unsubUser = onSnapshot(doc(db, 'usuarios', currentUID), snap => {
    if (snap.exists()) {
      const d    = snap.data();
      exercises  = d.exercises   || [];
      doneSet    = d.doneSet     || [];
      meals      = d.meals       || [];
      bodyData   = d.bodyData    || [];
      medidasData= d.medidasData || [];
    }
    initApp();
  });
}

async function saveUser(data) {
  try { await setDoc(doc(db, 'usuarios', currentUID), data, { merge: true }); }
  catch(e) { alert('Error al guardar. Revisa tu conexión.'); }
}

async function saveUserByUID(uid, data) {
  try { await setDoc(doc(db, 'usuarios', uid), data, { merge: true }); }
  catch(e) { alert('Error al guardar.'); }
}

function startCycleListener() {
  if (unsubCycle) unsubCycle();
  unsubCycle = onSnapshot(doc(db, 'config', 'ciclo'), snap => {
    cycle = snap.exists() ? snap.data() : null;
    if (!document.getElementById('panelCiclo').classList.contains('hidden')) renderCycle();
  });
}

/* ══════════════════════════════════════════
   TABS
══════════════════════════════════════════ */
window.switchTab = function(tab) {
  ['rutina','dieta','progreso','ciclo','admin'].forEach(t => {
    const p = document.getElementById(`panel${cap(t)}`);
    const b = document.getElementById(`tab${cap(t)}`);
    if (p) p.classList.toggle('hidden', t !== tab);
    if (b) b.classList.toggle('active', t === tab);
  });
  const isAdmin = currentUser === ADMIN_USERNAME;
  document.getElementById('btnAgregar').style.display    = (tab==='rutina' && isAdmin) ? '' : 'none';
  document.getElementById('btnResetWeek').style.display  = (tab==='rutina' && isAdmin) ? '' : 'none';
  const bm = document.getElementById('btnAddMeal');
  if (bm) bm.style.display = (tab==='dieta' && isAdmin) ? '' : 'none';
  if (tab==='progreso') switchProgressTab('comp');
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

function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

/* ══════════════════════════════════════════
   RUTINA
══════════════════════════════════════════ */
function renderDaysNav() {
  document.getElementById('daysNav').innerHTML = DAYS.map(day => {
    const count = exercises.filter(e => e.day === day).length;
    const badge = count ? `<span class="count">${count}</span>` : '';
    return `<button class="day-pill${day===currentDay?' active':''}" onclick="selectDay('${day}')">${day}${badge}</button>`;
  }).join('');
}

window.selectDay = function(day) {
  currentDay = day;
  document.getElementById('sectionTitle').innerHTML = day.toUpperCase();
  renderDaysNav(); renderExercises();
};

function renderExercises(exList, targetUID) {
  const list    = document.getElementById('exercisesList');
  const isAdmin = currentUser === ADMIN_USERNAME;
  const src     = exList || exercises.filter(e => e.day === currentDay);
  if (!src.length) {
    list.innerHTML = `<div class="empty-state"><div class="icon">🏋️</div><p>No hay ejercicios para <strong>${currentDay}</strong>.</p>${isAdmin?`<button onclick="openModal('${currentDay}')">+ Agregar ejercicio</button>`:''}</div>`;
    return;
  }
  list.innerHTML = `<div class="exercises-grid">${src.map((ex,i) => buildCard(ex,i,src.length,targetUID)).join('')}</div>`;
}

function buildCard(ex, idx, total, targetUID) {
  const isDone  = doneSet.includes(ex.id);
  const isAdmin = currentUser === ADMIN_USERNAME;
  const wh      = ex.weightHistory || [];
  const lastW   = wh.length ? wh[wh.length-1] : null;
  const wBadge  = lastW
    ? `<span class="badge badge-weight">⚖️ ${lastW.kg} kg</span>`
    : `<span class="badge badge-weight-empty">⚖️ Sin peso</span>`;
  const gifSection = ex.gif
    ? `<div class="card-gif"><img src="${ex.gif}" loading="lazy" alt="${ex.name}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"/><span class="placeholder" style="display:none">🏋️</span></div>`
    : `<div class="card-gif"><span class="placeholder">🏋️</span></div>`;
  const muscle = ex.muscle ? `<span class="muscle-group">${ex.muscle}</span><br>` : '';
  const sets   = ex.sets   ? `<span class="badge badge-sets">${ex.sets} series</span>` : '';
  const reps   = ex.reps   ? `<span class="badge badge-reps">${ex.reps} reps</span>` : '';
  const rest   = ex.rest   ? `<span class="badge badge-rest">⏱ ${ex.rest}</span>` : '';
  const notes  = ex.notes  ? `<div class="card-notes">${ex.notes}</div>` : '';
  const tu     = targetUID ? `,'${targetUID}'` : '';
  const adminBtns = isAdmin ? `
    <button class="btn-icon" onclick="editExercise('${ex.id}'${tu})" title="Editar">✏️</button>
    ${idx>0?`<button class="btn-icon" onclick="moveExercise('${ex.id}','up'${tu})">⬆️</button>`:''}
    ${idx<total-1?`<button class="btn-icon" onclick="moveExercise('${ex.id}','down'${tu})">⬇️</button>`:''}
    <button class="btn-delete" onclick="deleteExercise('${ex.id}'${tu})">🗑</button>` : '';
  return `
    <div class="exercise-card" id="card-${ex.id}">
      ${gifSection}
      <div class="card-body">${muscle}<div class="card-name">${ex.name}</div><div class="card-meta">${sets}${reps}${rest}${wBadge}</div>${notes}</div>
      <div class="card-actions">
        <button class="btn-done${isDone?' done':''}" onclick="toggleDone('${ex.id}')">${isDone?'✓ Hecho':'Marcar hecho'}</button>
        <button class="btn-weight" onclick="openWeightModal('${ex.id}',${targetUID?`'${targetUID}'`:'null'})">⚖️</button>
        ${adminBtns}
      </div>
    </div>`;
}

window.toggleDone = async function(id) {
  doneSet.includes(id) ? doneSet = doneSet.filter(d => d !== id) : doneSet.push(id);
  await saveUser({ doneSet });
};

window.deleteExercise = async function(id, targetUID) {
  if (!confirm('¿Eliminar este ejercicio?')) return;
  const uid  = targetUID || currentUID;
  const snap = await getDoc(doc(db, 'usuarios', uid));
  const d    = snap.data();
  d.exercises = d.exercises.filter(e => e.id !== id);
  await saveUserByUID(uid, d);
  if (uid === currentUID) { exercises = d.exercises; renderDaysNav(); renderExercises(); }
  else adminLoadUser();
};

window.editExercise = async function(id, targetUID) {
  const uid  = targetUID || currentUID;
  const snap = await getDoc(doc(db, 'usuarios', uid));
  const ex   = (snap.data()?.exercises || []).find(e => e.id === id);
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
  document.getElementById('fTargetUser').value = targetUID || '';
  document.getElementById('overlay').classList.add('open');
};

window.moveExercise = async function(id, dir, targetUID) {
  const uid  = targetUID || currentUID;
  const snap = await getDoc(doc(db, 'usuarios', uid));
  const d    = snap.data();
  const exs  = d.exercises || [];
  const idx  = exs.findIndex(e => e.id === id);
  const newIdx = dir === 'up' ? idx-1 : idx+1;
  if (newIdx < 0 || newIdx >= exs.length) return;
  [exs[idx], exs[newIdx]] = [exs[newIdx], exs[idx]];
  d.exercises = exs;
  await saveUserByUID(uid, d);
  if (uid === currentUID) { exercises = exs; renderExercises(); }
  else adminLoadUser();
};

window.confirmResetWeek = function() {
  if (!confirm('¿Resetear la semana? Todos los ejercicios se desmarcarán.')) return;
  doneSet = [];
  saveUser({ doneSet });
};

/* ══════════════════════════════════════════
   MODAL EJERCICIO
══════════════════════════════════════════ */
window.openModal = function(day) {
  document.getElementById('exerciseModalTitle').textContent = 'Nuevo Ejercicio';
  document.getElementById('fDay').value = day || currentDay;
  document.getElementById('fEditId').value = '';
  document.getElementById('fTargetUser').value = '';
  document.getElementById('overlay').classList.add('open');
};
window.closeModal = function() {
  document.getElementById('overlay').classList.remove('open');
  ['fName','fSets','fReps','fRest','fGif','fNotes','fWeight','fEditId','fTargetUser'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('fMuscle').value = '';
  const p = document.getElementById('gifPreview');
  p.innerHTML = '<span style="color:var(--muted);font-size:0.85rem">Preview aquí</span>';
  p.classList.remove('has-img');
  document.getElementById('gifError').style.display = 'none';
};
window.handleOverlayClick = function(e) { if (e.target === document.getElementById('overlay')) closeModal(); };

window.previewGif = function() {
  let url = document.getElementById('fGif').value.trim();
  const preview = document.getElementById('gifPreview'), errMsg = document.getElementById('gifError');
  errMsg.style.display = 'none';
  if (!url) return;
  if (url.includes('giphy.com/gifs/') && !url.endsWith('.gif')) {
    const parts = url.split('-'); const hash = parts[parts.length-1].split('/')[0];
    if (hash) { url = `https://media.giphy.com/media/${hash}/giphy.gif`; document.getElementById('fGif').value = url; }
  }
  preview.innerHTML = '<span style="color:var(--muted);font-size:0.85rem">Cargando...</span>';
  const img = new Image(); img.crossOrigin = 'anonymous'; img.src = url;
  img.onload  = () => { preview.innerHTML=''; img.style.cssText='width:100%;height:100%;object-fit:cover;border-radius:8px'; preview.appendChild(img); preview.classList.add('has-img'); };
  img.onerror = () => { errMsg.style.display='block'; preview.classList.remove('has-img'); preview.innerHTML='<span style="color:var(--muted);font-size:0.85rem">No se pudo cargar</span>'; };
};

window.saveExercise = async function() {
  const name      = document.getElementById('fName').value.trim();
  const day       = document.getElementById('fDay').value;
  const editId    = document.getElementById('fEditId').value;
  const targetUID = document.getElementById('fTargetUser').value || currentUID;
  if (!name) { alert('Ingresa el nombre del ejercicio'); return; }

  const snap = await getDoc(doc(db, 'usuarios', targetUID));
  const d    = snap.data() || {};
  const exs  = d.exercises || [];
  const weight = parseFloat(document.getElementById('fWeight').value);

  if (editId) {
    const idx = exs.findIndex(e => e.id === editId);
    if (idx >= 0) {
      exs[idx] = { ...exs[idx], name, day,
        sets: document.getElementById('fSets').value,
        reps: document.getElementById('fReps').value,
        rest: document.getElementById('fRest').value,
        muscle: document.getElementById('fMuscle').value,
        gif:  document.getElementById('fGif').value.trim(),
        notes: document.getElementById('fNotes').value.trim(),
      };
      if (weight > 0) { if (!exs[idx].weightHistory) exs[idx].weightHistory = []; exs[idx].weightHistory.push({ kg: weight, date: today() }); }
    }
  } else {
    exs.push({ id: Date.now().toString(), name, day,
      sets: document.getElementById('fSets').value,
      reps: document.getElementById('fReps').value,
      rest: document.getElementById('fRest').value,
      muscle: document.getElementById('fMuscle').value,
      gif:  document.getElementById('fGif').value.trim(),
      notes: document.getElementById('fNotes').value.trim(),
      weightHistory: weight > 0 ? [{ kg: weight, date: today() }] : [],
    });
  }
  d.exercises = exs;
  await saveUserByUID(targetUID, d);
  closeModal();
  if (targetUID === currentUID) {
    exercises = exs; currentDay = day;
    document.getElementById('sectionTitle').innerHTML = day.toUpperCase();
    renderDaysNav(); renderExercises(); updateProgress();
  } else adminLoadUser();
};

/* ══════════════════════════════════════════
   PESO POR EJERCICIO
══════════════════════════════════════════ */
window.openWeightModal = async function(id, targetUID) {
  editingWeightId = id;
  const uid  = targetUID || currentUID;
  const snap = await getDoc(doc(db, 'usuarios', uid));
  const ex   = (snap.data()?.exercises || []).find(e => e.id === id);
  if (!ex) return;
  document.getElementById('weightModalTitle').textContent = `⚖️ ${ex.name}`;
  document.getElementById('wNewWeight').value = '';
  document.getElementById('weightOverlay').dataset.targetUID = targetUID || '';
  const wh = ex.weightHistory || [];
  const wrap = document.getElementById('weightHistoryWrap');
  wrap.innerHTML = wh.length
    ? `<div class="weight-history-title">Historial</div><div class="weight-history-list">${[...wh].reverse().map((w,i) => `<div class="weight-history-row"><span class="wh-date">${formatDate(w.date)}</span><span class="wh-kg">${w.kg} kg</span><button class="wh-del" onclick="deleteWeightEntry('${id}',${wh.length-1-i},'${targetUID||''}')">✕</button></div>`).join('')}</div>`
    : '<p style="color:var(--muted);font-size:0.82rem;margin-bottom:12px">Sin registros de peso aún.</p>';
  document.getElementById('weightOverlay').classList.add('open');
};
window.closeWeightModal = function() { document.getElementById('weightOverlay').classList.remove('open'); editingWeightId = null; };

window.saveWeight = async function() {
  const kg = parseFloat(document.getElementById('wNewWeight').value);
  if (!kg || kg <= 0) { alert('Ingresa un peso válido'); return; }
  const targetUID = document.getElementById('weightOverlay').dataset.targetUID || currentUID;
  const snap = await getDoc(doc(db, 'usuarios', targetUID));
  const d    = snap.data();
  const ex   = (d.exercises || []).find(e => e.id === editingWeightId);
  if (!ex) return;
  if (!ex.weightHistory) ex.weightHistory = [];
  ex.weightHistory.push({ kg, date: today() });
  await saveUserByUID(targetUID, d);
  if (targetUID === currentUID) exercises = d.exercises;
  closeWeightModal();
};

window.deleteWeightEntry = async function(exId, idx, targetUID) {
  if (!confirm('¿Eliminar este registro?')) return;
  const uid  = targetUID || currentUID;
  const snap = await getDoc(doc(db, 'usuarios', uid));
  const d    = snap.data();
  const ex   = (d.exercises || []).find(e => e.id === exId);
  if (ex) { ex.weightHistory.splice(idx, 1); await saveUserByUID(uid, d); }
  openWeightModal(exId, targetUID || null);
};

/* ══════════════════════════════════════════
   DIETA
══════════════════════════════════════════ */
function renderDietDaysNav() {
  document.getElementById('dietDaysNav').innerHTML = DAYS.map(day => {
    const count = meals.filter(m => m.day === day).length;
    const badge = count ? `<span class="count">${count}</span>` : '';
    return `<button class="day-pill${day===currentDietDay?' active':''}" onclick="selectDietDay('${day}')">${day}${badge}</button>`;
  }).join('');
  renderDietContent();
}
window.selectDietDay = function(day) {
  currentDietDay = day;
  document.getElementById('dietSectionTitle').innerHTML = day.toUpperCase();
  renderDietDaysNav();
};
function renderDietContent() {
  const cont    = document.getElementById('dietContent');
  const isAdmin = currentUser === ADMIN_USERNAME;
  const dayM    = meals.filter(m => m.day === currentDietDay);
  if (!dayM.length) {
    cont.innerHTML = `<div class="empty-state"><div class="icon">🥗</div><p>No hay comidas para <strong>${currentDietDay}</strong>.</p>${isAdmin?`<button onclick="openMealModal('${currentDietDay}')">+ Agregar comida</button>`:''}</div>`;
    return;
  }
  let html = '';
  MEAL_TIMES.forEach(time => {
    const tm = dayM.filter(m => m.time === time); if (!tm.length) return;
    const totCal  = tm.reduce((s,m) => s + (parseFloat(m.cal)  || 0), 0);
    const totProt = tm.reduce((s,m) => s + (parseFloat(m.prot) || 0), 0);
    const totCarbs= tm.reduce((s,m) => s + (parseFloat(m.carbs)|| 0), 0);
    const totFat  = tm.reduce((s,m) => s + (parseFloat(m.fat)  || 0), 0);
    html += `<div class="meal-block">
      <div class="meal-block-header">
        <span class="meal-time-title">${MEAL_ICONS[time]} ${time}</span>
        <div class="meal-macros-summary">
          ${totCal  ? `<span class="mmac cal">${Math.round(totCal)} kcal</span>` : ''}
          ${totProt ? `<span class="mmac prot">P:${Math.round(totProt)}g</span>` : ''}
          ${totCarbs? `<span class="mmac carbs">C:${Math.round(totCarbs)}g</span>` : ''}
          ${totFat  ? `<span class="mmac fat">G:${Math.round(totFat)}g</span>` : ''}
        </div>
      </div>
      ${tm.map(m => `<div class="meal-card">
        <div class="meal-card-body">
          <div class="meal-name">${m.name}${m.qty?` <span class="meal-qty">(${m.qty})</span>`:''}</div>
          <div class="card-meta">
            ${m.cal  ? `<span class="badge badge-cal">${m.cal} kcal</span>` : ''}
            ${m.prot ? `<span class="badge badge-prot">P:${m.prot}g</span>` : ''}
            ${m.carbs? `<span class="badge badge-carbs">C:${m.carbs}g</span>` : ''}
            ${m.fat  ? `<span class="badge badge-fat">G:${m.fat}g</span>` : ''}
          </div>
          ${m.notes ? `<div class="card-notes">${m.notes}</div>` : ''}
        </div>
        ${isAdmin?`<div class="meal-card-actions"><button class="btn-icon" onclick="editMeal('${m.id}')">✏️</button><button class="btn-delete" onclick="deleteMeal('${m.id}')">🗑</button></div>`:''}</div>`).join('')}
    </div>`;
  });
  cont.innerHTML = html;
}
window.openMealModal = function(day) {
  document.getElementById('mealModalTitle').textContent = 'Nueva Comida';
  document.getElementById('mealDay').value = day || currentDietDay;
  document.getElementById('mealEditId').value = '';
  document.getElementById('mealOverlay').classList.add('open');
};
window.closeMealModal = function() {
  document.getElementById('mealOverlay').classList.remove('open');
  ['mealName','mealQty','mealCal','mealProt','mealCarbs','mealFat','mealNotes','mealEditId'].forEach(id => document.getElementById(id).value = '');
};
window.editMeal = function(id) {
  const m = meals.find(m => m.id === id); if (!m) return;
  document.getElementById('mealModalTitle').textContent = 'Editar Comida';
  document.getElementById('mealTime').value  = m.time  || 'Desayuno';
  document.getElementById('mealDay').value   = m.day   || currentDietDay;
  document.getElementById('mealName').value  = m.name  || '';
  document.getElementById('mealQty').value   = m.qty   || '';
  document.getElementById('mealCal').value   = m.cal   || '';
  document.getElementById('mealProt').value  = m.prot  || '';
  document.getElementById('mealCarbs').value = m.carbs || '';
  document.getElementById('mealFat').value   = m.fat   || '';
  document.getElementById('mealNotes').value = m.notes || '';
  document.getElementById('mealEditId').value = id;
  document.getElementById('mealOverlay').classList.add('open');
};
window.deleteMeal = async function(id) {
  if (!confirm('¿Eliminar esta comida?')) return;
  meals = meals.filter(m => m.id !== id);
  await saveUser({ meals });
};
window.saveMeal = async function() {
  const name = document.getElementById('mealName').value.trim();
  if (!name) { alert('Ingresa el nombre del alimento'); return; }
  const editId = document.getElementById('mealEditId').value;
  const meal = {
    id: editId || Date.now().toString(),
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
  if (editId) { const i = meals.findIndex(m => m.id === editId); if (i >= 0) meals[i] = meal; }
  else meals.push(meal);
  await saveUser({ meals }); closeMealModal();
};

/* ══════════════════════════════════════════
   COMPOSICIÓN CORPORAL
══════════════════════════════════════════ */
const RANGES = {
  grasa:    { all: [[0,6,'Muy bajo','blue'],[6,18,'Atlético','green'],[18,25,'Normal','yellow'],[25,32,'Alto','orange'],[32,100,'Obeso','red']] },
  visceral: { all: [[0,9,'Normal ✅','green'],[9,15,'Alto ⚠️','orange'],[15,100,'Peligroso 🚨','red']] },
  bmi:      { all: [[0,18.5,'Bajo peso','blue'],[18.5,25,'Normal ✅','green'],[25,30,'Sobrepeso','orange'],[30,100,'Obesidad 🚨','red']] },
  agua:     { all: [[0,45,'Bajo','orange'],[45,65,'Normal ✅','green'],[65,100,'Alto','blue']] },
};
function getSemaforo(key, val) {
  if (!val) return '';
  for (const [min,max,label,color] of (RANGES[key]?.all || [])) { if (val>=min && val<max) return `<span class="semaforo ${color}">${label}</span>`; }
  return '';
}
window.openBodyModal  = function() { document.getElementById('bDate').value = today(); document.getElementById('bodyOverlay').classList.add('open'); };
window.closeBodyModal = function() { document.getElementById('bodyOverlay').classList.remove('open'); ['bEdad','bEstatura','bPeso','bAgua','bGrasa','bHueso','bVisceral','bMusculo','bBMI','bBMR','bEdadFisio'].forEach(id => document.getElementById(id).value = ''); };
window.saveBody = async function() {
  const date = document.getElementById('bDate').value; if (!date) { alert('Selecciona fecha'); return; }
  const peso = parseFloat(document.getElementById('bPeso').value) || null;
  const est  = parseFloat(document.getElementById('bEstatura').value) || null;
  const edad = parseFloat(document.getElementById('bEdad').value) || null;
  let bmi = parseFloat(document.getElementById('bBMI').value) || null;
  let bmr = parseFloat(document.getElementById('bBMR').value) || null;
  if (!bmi && peso && est) bmi = +(peso / ((est/100)**2)).toFixed(1);
  if (!bmr && peso && est && edad) bmr = Math.round(10*peso + 6.25*est - 5*edad + 5);
  const record = { id: Date.now().toString(), date, edad, estatura: est, peso,
    agua: parseFloat(document.getElementById('bAgua').value) || null,
    grasa: parseFloat(document.getElementById('bGrasa').value) || null,
    hueso: parseFloat(document.getElementById('bHueso').value) || null,
    visceral: parseFloat(document.getElementById('bVisceral').value) || null,
    musculo: parseFloat(document.getElementById('bMusculo').value) || null,
    bmi, bmr, edadFisio: parseFloat(document.getElementById('bEdadFisio').value) || null,
  };
  bodyData.push(record); bodyData.sort((a,b) => a.date.localeCompare(b.date));
  await saveUser({ bodyData }); closeBodyModal(); renderBodyData();
};
function renderBodyData() {
  const el = document.getElementById('bodyLatest'), hist = document.getElementById('bodyHistory');
  if (!bodyData.length) { el.innerHTML = '<div class="empty-state" style="padding:40px 20px"><div class="icon">🧬</div><p>Agrega tu primera medición.</p></div>'; hist.innerHTML = ''; return; }
  const last = bodyData[bodyData.length-1];
  const fields = [{k:'peso',label:'Peso',unit:'kg',icon:'⚖️'},{k:'estatura',label:'Estatura',unit:'cm',icon:'📏'},{k:'grasa',label:'Grasa',unit:'%',icon:'🔥'},{k:'musculo',label:'Músculo',unit:'%',icon:'💪'},{k:'agua',label:'Agua',unit:'%',icon:'💧'},{k:'bmi',label:'BMI',unit:'',icon:'📊'},{k:'bmr',label:'BMR',unit:'kcal',icon:'🔋'},{k:'visceral',label:'Grasa visceral',unit:'',icon:'⚠️'},{k:'hueso',label:'Masa ósea',unit:'kg',icon:'🦴'},{k:'edadFisio',label:'Edad fisiológica',unit:'años',icon:'🕐'}];
  el.innerHTML = `<div class="stats-cards">${fields.filter(f => last[f.k] != null).map(f => `<div class="stat-card"><div class="stat-icon">${f.icon}</div><div class="stat-value">${last[f.k]}<span>${f.unit}</span></div><div class="stat-label">${f.label}</div>${getSemaforo(f.k, last[f.k])}</div>`).join('')}</div><p class="stats-last-date">Último: <strong>${formatDate(last.date)}</strong> · ${bodyData.length} registro${bodyData.length>1?'s':''}</p>`;
  hist.innerHTML = `<div class="stats-history-title">Historial</div>` + [...bodyData].reverse().map((r,i) => `<div class="history-row"><div class="history-date">${formatDate(r.date)}</div><div class="history-values">${r.peso?`<span class="hv-badge">⚖️${r.peso}kg</span>`:''}${r.grasa?`<span class="hv-badge">🔥${r.grasa}%</span>`:''}${r.musculo?`<span class="hv-badge">💪${r.musculo}%</span>`:''}${r.bmi?`<span class="hv-badge">BMI ${r.bmi}</span>`:''}${r.visceral?`<span class="hv-badge">Visceral ${r.visceral}</span>`:''}</div><button class="btn-delete-stat" onclick="deleteBody(${bodyData.length-1-i})">🗑</button></div>`).join('');
}
window.deleteBody = async function(i) { if (!confirm('¿Eliminar?')) return; bodyData.splice(i,1); await saveUser({ bodyData }); renderBodyData(); };

/* ══════════════════════════════════════════
   MEDIDAS CORPORALES
══════════════════════════════════════════ */
window.openMedidasModal  = function() { document.getElementById('mDate').value = today(); document.getElementById('medidasOverlay').classList.add('open'); };
window.closeMedidasModal = function() { document.getElementById('medidasOverlay').classList.remove('open'); MEDIDAS_KEYS.forEach(k => { const el = document.getElementById('m'+k); if (el) el.value = ''; }); document.getElementById('mDate').value = ''; };
window.saveMedidas = async function() {
  const date = document.getElementById('mDate').value; if (!date) { alert('Selecciona fecha'); return; }
  const record = { id: Date.now().toString(), date };
  MEDIDAS_KEYS.forEach(k => { const v = parseFloat(document.getElementById('m'+k)?.value) || null; if (v) record[k] = v; });
  if (Object.keys(record).length <= 2) { alert('Ingresa al menos una medida'); return; }
  medidasData.push(record); medidasData.sort((a,b) => a.date.localeCompare(b.date));
  await saveUser({ medidasData }); closeMedidasModal(); renderMedidasData();
};
function renderMedidasData() {
  const el = document.getElementById('medidasLatest'), hist = document.getElementById('medidasHistory');
  if (!medidasData.length) { el.innerHTML = '<div class="empty-state" style="padding:40px 20px"><div class="icon">📐</div><p>Agrega tu primera medición corporal.</p></div>'; hist.innerHTML = ''; return; }
  const last = medidasData[medidasData.length-1], first = medidasData[0];
  el.innerHTML = `<div class="medidas-table"><div class="mt-header"><span>Medida</span><span>Actual</span><span>Cambio</span></div>${MEDIDAS_KEYS.filter(k => last[k] != null).map(k => { const diff = first[k] && last[k] ? (last[k]-first[k]).toFixed(1) : null; const color = diff === null ? '' : parseFloat(diff) > 0 ? 'var(--success)' : '#ff6b6b'; return `<div class="mt-row"><span>${MEDIDAS_LABELS[k]}</span><span><strong>${last[k]} cm</strong></span><span style="color:${color}">${diff !== null ? (parseFloat(diff)>0?'+':'')+diff+' cm' : '—'}</span></div>`; }).join('')}</div><p class="stats-last-date" style="margin-top:12px">Último: <strong>${formatDate(last.date)}</strong> · ${medidasData.length} registro${medidasData.length>1?'s':''}</p>`;
  hist.innerHTML = `<div class="stats-history-title">Historial</div>` + [...medidasData].reverse().map((r,i) => `<div class="history-row"><div class="history-date">${formatDate(r.date)}</div><div class="history-values">${MEDIDAS_KEYS.filter(k => r[k]).map(k => `<span class="hv-badge">${MEDIDAS_LABELS[k]}: ${r[k]}cm</span>`).join('')}</div><button class="btn-delete-stat" onclick="deleteMedida(${medidasData.length-1-i})">🗑</button></div>`).join('');
}
window.deleteMedida = async function(i) { if (!confirm('¿Eliminar?')) return; medidasData.splice(i,1); await saveUser({ medidasData }); renderMedidasData(); };

/* ══════════════════════════════════════════
   GRÁFICAS
══════════════════════════════════════════ */
function renderGraficas() { renderBodyChart(currentBodyChart); renderMedidasChart(currentMedidasChart); renderWeightCharts(); }
window.switchBodyChart = function(type) { currentBodyChart = type; document.querySelectorAll('.csub').forEach(b => b.classList.toggle('active', b.textContent.toLowerCase() === type)); renderBodyChart(type); };
function renderBodyChart(type) {
  const canvas = document.getElementById('bodyChart'), empty = document.getElementById('bodyChartEmpty');
  const data = bodyData.filter(r => r[type] != null);
  if (data.length < 2) { canvas.style.display='none'; empty.style.display='flex'; return; }
  canvas.style.display='block'; empty.style.display='none';
  const colors = { peso:'#c0392b', grasa:'#e74c3c', musculo:'#922b21', agua:'#5dade2' };
  const units  = { peso:'kg', grasa:'%', musculo:'%', agua:'%' };
  if (chartInstance) chartInstance.destroy();
  chartInstance = new Chart(canvas, { type:'line', data:{ labels: data.map(r => formatDate(r.date)), datasets:[{ label:`${type}(${units[type]})`, data:data.map(r => r[type]), borderColor:colors[type], backgroundColor:colors[type]+'22', borderWidth:2.5, pointBackgroundColor:colors[type], pointRadius:5, tension:0.3, fill:true }] }, options:{ responsive:true, plugins:{ legend:{ labels:{ color:'#f0f0f0', font:{ family:'DM Sans' } } } }, scales:{ x:{ ticks:{ color:'#888' }, grid:{ color:'#2a2a30' } }, y:{ ticks:{ color:'#888' }, grid:{ color:'#2a2a30' } } } } });
}
function renderMedidasChart(key) {
  const tabs = document.getElementById('medidasChartTabs');
  tabs.innerHTML = MEDIDAS_KEYS.map(k => `<button class="csub${k===key?' active':''}" onclick="switchMedidasChart('${k}')" style="font-size:0.68rem;padding:4px 10px">${MEDIDAS_LABELS[k]}</button>`).join('');
  const canvas = document.getElementById('medidasChart'), empty = document.getElementById('medidasChartEmpty');
  const data = medidasData.filter(r => r[key] != null);
  if (data.length < 2) { canvas.style.display='none'; empty.style.display='flex'; return; }
  canvas.style.display='block'; empty.style.display='none';
  if (medidasChartInst) medidasChartInst.destroy();
  medidasChartInst = new Chart(canvas, { type:'line', data:{ labels: data.map(r => formatDate(r.date)), datasets:[{ label:`${MEDIDAS_LABELS[key]}(cm)`, data:data.map(r => r[key]), borderColor:'#c0392b', backgroundColor:'#c0392b22', borderWidth:2.5, pointBackgroundColor:'#c0392b', pointRadius:5, tension:0.3, fill:true }] }, options:{ responsive:true, plugins:{ legend:{ labels:{ color:'#f0f0f0', font:{ family:'DM Sans' } } } }, scales:{ x:{ ticks:{ color:'#888' }, grid:{ color:'#2a2a30' } }, y:{ ticks:{ color:'#888' }, grid:{ color:'#2a2a30' } } } } });
}
window.switchMedidasChart = function(key) { currentMedidasChart = key; renderMedidasChart(key); };
function renderWeightCharts() {
  const sec = document.getElementById('weightChartSection');
  const withH = exercises.filter(e => (e.weightHistory||[]).length >= 2);
  if (!withH.length) { sec.innerHTML = '<p style="color:var(--muted);font-size:0.88rem">Agrega al menos 2 registros de peso en un ejercicio para ver su gráfica.</p>'; return; }
  sec.innerHTML = withH.map(ex => `<div class="chart-section" style="margin-bottom:20px"><div style="font-size:0.9rem;font-weight:600;color:var(--text);margin-bottom:12px">${ex.name}</div><canvas id="wc-${ex.id}" height="80"></canvas></div>`).join('');
  withH.forEach(ex => { new Chart(document.getElementById(`wc-${ex.id}`), { type:'line', data:{ labels: ex.weightHistory.map(w => formatDate(w.date)), datasets:[{ label:'Peso(kg)', data:ex.weightHistory.map(w => w.kg), borderColor:'#c0392b', backgroundColor:'#c0392b22', borderWidth:2, pointBackgroundColor:'#c0392b', pointRadius:4, tension:0.3, fill:true }] }, options:{ responsive:true, plugins:{ legend:{ labels:{ color:'#f0f0f0', font:{ family:'DM Sans' } } } }, scales:{ x:{ ticks:{ color:'#888' }, grid:{ color:'#2a2a30' } }, y:{ ticks:{ color:'#888' }, grid:{ color:'#2a2a30' } } } } }); });
}

/* ══════════════════════════════════════════
   CICLO
══════════════════════════════════════════ */
function renderCycle() {
  const hero = document.getElementById('cycleHero');
  const cfg  = document.getElementById('cycleConfig');
  if (cfg) cfg.classList.toggle('hidden', currentUser !== ADMIN_USERNAME);
  if (cycle?.start) { document.getElementById('cycleStart').value = cycle.start; document.getElementById('cycleEnd').value = cycle.end; document.getElementById('cycleName').value = cycle.name || ''; }
  if (!cycle?.start || !cycle?.end) { hero.innerHTML = '<div class="cycle-empty"><span>📅</span><p>No hay ciclo configurado.</p></div>'; return; }
  const t0 = new Date(); t0.setHours(0,0,0,0);
  const start = new Date(cycle.start+'T00:00:00'), end = new Date(cycle.end+'T00:00:00');
  const total = Math.round((end-start)/86400000), elapsed = Math.round((t0-start)/86400000), rem = Math.round((end-t0)/86400000);
  const pct = Math.min(100, Math.max(0, Math.round(elapsed/total*100)));
  let status = '';
  if (t0 < start) status = `<div class="cycle-status pending">⏳ Empieza en ${Math.round((start-t0)/86400000)} días</div>`;
  else if (t0 > end) status = '<div class="cycle-status done">✅ ¡Ciclo completado!</div>';
  else { const w=Math.floor(rem/7), d=rem%7; const txt=[(w>0?`${w} sem`:''),(d>0?`${d} días`:'')].filter(Boolean).join(' y '); status = `<div class="cycle-status ${rem<=7?'warning':'active'}">${rem<=7?'🚨':'🏃'} Quedan <strong>${txt}</strong></div>`; }
  hero.innerHTML = `${cycle.name?`<div class="cycle-name">${cycle.name}</div>`:''}
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
  const start = document.getElementById('cycleStart').value, end = document.getElementById('cycleEnd').value, name = document.getElementById('cycleName').value.trim();
  if (!start || !end) { alert('Selecciona inicio y fin'); return; }
  if (end <= start)   { alert('El fin debe ser después del inicio'); return; }
  await setDoc(doc(db, 'config', 'ciclo'), { start, end, name });
};

/* ══════════════════════════════════════════
   ADMIN
══════════════════════════════════════════ */
async function renderAdmin() {
  const snap  = await getDocs(collection(db, 'usuarios'));
  const users = snap.docs
    .map(d => ({ uid: d.id, username: d.data().username || d.id }))
    .filter(u => u.username !== ADMIN_USERNAME);
  document.getElementById('usersList').innerHTML = users.length
    ? users.map(u => `<div class="user-row"><span class="user-row-name">👤 ${u.username}</span></div>`).join('')
    : '<p style="color:var(--muted)">No hay otros usuarios.</p>';
  const sel = document.getElementById('adminViewUser');
  sel.innerHTML = '<option value="">— Seleccionar —</option>' + users.map(u => `<option value="${u.uid}">${u.username}</option>`).join('');
  const allU = [{ uid: currentUID, username: ADMIN_USERNAME }, ...users];
  document.getElementById('copyFrom').innerHTML = allU.map(u => `<option value="${u.uid}">${u.username}</option>`).join('');
  document.getElementById('copyTo').innerHTML   = allU.map(u => `<option value="${u.uid}">${u.username}</option>`).join('');
}
window.adminLoadUser = async function() {
  const uid   = document.getElementById('adminViewUser').value;
  const panel = document.getElementById('adminUserPanel');
  if (!uid) { panel.innerHTML = ''; return; }
  const snap = await getDoc(doc(db, 'usuarios', uid));
  if (!snap.exists()) { panel.innerHTML = '<p style="color:var(--muted)">Sin datos.</p>'; return; }
  const d = snap.data(), exs = d.exercises || [], uname = d.username || uid;
  const dayTabs = DAYS.map(day => { const count = exs.filter(e => e.day === day).length; return `<button class="day-pill" onclick="adminShowDay('${day}','${uid}')" style="font-size:0.75rem;padding:6px 12px">${day}${count?` (${count})`:''}</button>`; }).join('');
  panel.innerHTML = `<div class="admin-user-header"><strong style="color:var(--accent)">👤 ${uname}</strong><button class="header-btn" style="font-size:0.78rem;padding:7px 14px" onclick="adminOpenExercise('${uid}')">+ Ejercicio</button></div><div class="days-nav" style="padding:12px 0;border:none">${dayTabs}</div><div id="adminExList"></div>`;
};
window.adminShowDay = function(day, uid) {
  currentDay = day;
  getDoc(doc(db, 'usuarios', uid)).then(snap => {
    const exs = (snap.data()?.exercises || []).filter(e => e.day === day);
    const list = document.getElementById('adminExList');
    if (!exs.length) { list.innerHTML = `<p style="color:var(--muted);padding:12px 0">Sin ejercicios para ${day}.</p>`; return; }
    list.innerHTML = `<div class="exercises-grid">${exs.map((ex,i) => buildCard(ex,i,exs.length,uid)).join('')}</div>`;
  });
};
window.adminOpenExercise = function(uid) {
  document.getElementById('fTargetUser').value = uid;
  document.getElementById('fEditId').value = '';
  document.getElementById('exerciseModalTitle').textContent = 'Nuevo ejercicio para usuario';
  document.getElementById('overlay').classList.add('open');
};
window.openCopyRoutine  = async function() { await renderAdmin(); document.getElementById('copyOverlay').classList.add('open'); };
window.closeCopyRoutine = function() { document.getElementById('copyOverlay').classList.remove('open'); };
window.executeCopyRoutine = async function() {
  const from = document.getElementById('copyFrom').value, to = document.getElementById('copyTo').value;
  if (!from || !to || from === to) { alert('Selecciona usuarios diferentes'); return; }
  const snapF = await getDoc(doc(db, 'usuarios', from)), snapT = await getDoc(doc(db, 'usuarios', to));
  if (!snapF.exists()) { alert('Usuario origen no encontrado'); return; }
  const fromEx = (snapF.data().exercises || []).map(e => ({ ...e, id: Date.now().toString() + Math.random().toString(36).slice(2) }));
  const toData = snapT.exists() ? snapT.data() : { exercises:[], doneSet:[], meals:[], bodyData:[], medidasData:[] };
  toData.exercises = [...(toData.exercises || []), ...fromEx];
  await saveUserByUID(to, toData);
  closeCopyRoutine();
  alert('✅ Rutina copiada exitosamente');
};

/* ══════════════════════════════════════════
   UTILS
══════════════════════════════════════════ */
function today() { return new Date().toISOString().split('T')[0]; }
function formatDate(d) {
  if (!d) return '—';
  const [y,m,day] = d.split('-');
  const M = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  return `${parseInt(day)} ${M[parseInt(m)-1]} ${y}`;
}
function showErr(el, msg) { el.textContent = msg; el.style.display = 'block'; }
function firebaseErrMsg(code) {
  const msgs = {
    'auth/email-already-in-use': '⚠ Ese correo ya está registrado',
    'auth/invalid-email':        '⚠ Correo inválido',
    'auth/weak-password':        '⚠ Contraseña muy débil (mínimo 6 caracteres)',
    'auth/user-not-found':       '⚠ No existe una cuenta con ese correo',
    'auth/wrong-password':       '⚠ Correo o contraseña incorrectos',
    'auth/invalid-credential':   '⚠ Correo o contraseña incorrectos',
    'auth/too-many-requests':    '⚠ Demasiados intentos. Espera unos minutos.',
  };
  return msgs[code] || '⚠ Error. Intenta de nuevo.';
}
function updateProgress() {
  const total = exercises.length, done = exercises.filter(e => doneSet.includes(e.id)).length;
  const pct = total === 0 ? 0 : Math.round(done/total*100);
  document.getElementById('progressFill').style.width = pct + '%';
  document.getElementById('progressPct').textContent  = pct + '%';
}
function initApp() {
  document.getElementById('sectionTitle').innerHTML = currentDay.toUpperCase();
  renderDaysNav(); renderExercises(); updateProgress();
}

/* ══════════════════════════════════════════
   RESTAURAR SESIÓN AL RECARGAR
══════════════════════════════════════════ */
const fixedSession = sessionStorage.getItem('fuerzapro_fixed_session');
if (fixedSession) {
  const fixedUser = FIXED_USERS.find(u => u.username === fixedSession);
  if (fixedUser) {
    currentUID  = fixedSession;
    currentUser = fixedSession;
    enterApp(fixedSession);
  }
}
