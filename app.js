/*
  Fuerza Pro — Lógica principal
  Desarrollado por Jhoao Guala
*/

import { initializeApp }   from "https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js";
import {
  getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword,
  sendEmailVerification, sendPasswordResetEmail, signOut, onAuthStateChanged, deleteUser
} from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";
import {
  getFirestore, doc, setDoc, getDoc, deleteDoc,
  onSnapshot, collection, getDocs, writeBatch
} from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";

/* ── Firebase ── */
const app  = initializeApp({
  apiKey:            "AIzaSyALUv_MuDpzol8ArgD9gOw8gIYruy1bRog",
  authDomain:        "fuerzapro-e9d6f.firebaseapp.com",
  projectId:         "fuerzapro-e9d6f",
  storageBucket:     "fuerzapro-e9d6f.firebasestorage.app",
  messagingSenderId: "589184423001",
  appId:             "1:589184423001:web:e3088e42caebea8d9bcd48"
});
const auth = getAuth(app);
const db   = getFirestore(app);

/* ── Credenciales fijas ──
   Para cambiar: edita username, password o email */
const FIXED_USERS = [
  { username: 'jhoao', password: 'Sxxafunny28', email: 'jhoaoxavier2365335@gmail.com', isAdmin: true },
  { username: 'karen', password: 'karen', email: null }
];
const ADMIN = 'jhoao';

/* ── Constantes ── */
const DAYS = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'];
const MEAL_TIMES = ['Desayuno','Almuerzo','Merienda','Cena'];
const MEDIDAS_KEYS = ['Cuello','Hombros','Pecho','Cintura','Abdomen','Cadera',
  'BrazoIzqR','BrazoIzqC','BrazoDerR','BrazoDerC',
  'AntebrazoIzq','AntebrazoDer','MusloIzq','MusloDer','PantIzq','PantDer'];
const MEDIDAS_LABELS = {
  Cuello:'Cuello',Hombros:'Hombros',Pecho:'Pecho',Cintura:'Cintura',
  Abdomen:'Abdomen',Cadera:'Cadera / Glúteos',
  BrazoIzqR:'Brazo Izq. Relajado',BrazoIzqC:'Brazo Izq. Contraído',
  BrazoDerR:'Brazo Der. Relajado',BrazoDerC:'Brazo Der. Contraído',
  AntebrazoIzq:'Antebrazo Izq.',AntebrazoDer:'Antebrazo Der.',
  MusloIzq:'Muslo Izq.',MusloDer:'Muslo Der.',
  PantIzq:'Pantorrilla Izq.',PantDer:'Pantorrilla Der.'
};

/* ── Estado ── */
let currentUser = null, currentUID = null;
let currentDay = DAYS[0], currentDietDay = DAYS[0];
let exercises = [], doneSet = [], meals = [], bodyData = [], medidasData = [];
let cycle = null;
let chartInst = null, medidasChartInst = null;
let unsubUser = null, unsubCycle = null;
let editingWeightId = null;
let currentBodyChart = 'peso', currentMedidasChart = 'Cuello';
let allUsers = []; // cache de usuarios para admin

/* ══════════════════════════════════════════
   SPLASH
══════════════════════════════════════════ */
setTimeout(() => {
  document.getElementById('splashScreen').classList.add('splash-out');
  setTimeout(() => {
    document.getElementById('splashScreen').style.display = 'none';
    // Solo mostrar login si no hay sesión activa
    const fixedSession = sessionStorage.getItem('fp_session');
    if (!fixedSession) document.getElementById('loginScreen').classList.remove('hidden');
  }, 500);
}, 2500);

/* ══════════════════════════════════════════
   AUTH
══════════════════════════════════════════ */
window.switchAuth = (tab) => {
  ['login','register','forgot'].forEach(t => {
    document.getElementById(`${t}Form`).classList.toggle('hidden', t !== tab);
  });
  document.getElementById('authTabLogin').classList.toggle('active', tab === 'login');
  document.getElementById('authTabRegister').classList.toggle('active', tab === 'register');
  document.getElementById('resendVerifyWrap').classList.add('hidden');
};

window.handleLogin = async () => {
  const input = document.getElementById('loginEmail').value.trim().toLowerCase();
  const pass  = document.getElementById('loginPass').value;
  const errEl = document.getElementById('loginError');
  hideErr(errEl);

  if (!input || !pass) { showErr(errEl, 'Completa todos los campos.'); return; }

  // Usuarios fijos — pueden entrar con username o correo
  const fixed = FIXED_USERS.find(u =>
    (u.username.toLowerCase() === input || (u.email && u.email.toLowerCase() === input)) &&
    u.password === pass
  );
  if (fixed) {
    const ref  = doc(db, 'usuarios', fixed.username);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, { username: fixed.username, exercises: [], doneSet: [], meals: [], bodyData: [], medidasData: [] });
    }
    currentUID = fixed.username;
    currentUser = fixed.username;
    sessionStorage.setItem('fp_session', fixed.username);
    enterApp(fixed.username);
    return;
  }

  // Usuarios normales — solo correo
  if (!input.includes('@')) { showErr(errEl, 'Ingresa tu correo electrónico.'); return; }

  try {
    const cred = await signInWithEmailAndPassword(auth, input, pass);
    if (!cred.user.emailVerified) {
      await signOut(auth);
      showErr(errEl, 'Debes verificar tu correo antes de entrar. Revisa tu bandeja de entrada.');
      document.getElementById('resendVerifyWrap').classList.remove('hidden');
      document.getElementById('resendVerifyWrap').dataset.email = input;
      return;
    }
  } catch(e) { showErr(errEl, authMsg(e.code)); }
};

window.resendVerification = async () => {
  const email = document.getElementById('resendVerifyWrap').dataset.email;
  const pass  = document.getElementById('loginPass').value;
  try {
    const cred = await signInWithEmailAndPassword(auth, email, pass);
    await sendEmailVerification(cred.user);
    await signOut(auth);
    document.getElementById('resendVerifyWrap').innerHTML =
      '<span style="color:#4ade80;font-size:0.82rem">Correo reenviado correctamente.</span>';
  } catch(e) { alert('No se pudo reenviar. Intenta de nuevo.'); }
};

window.handleRegister = async () => {
  const username = document.getElementById('regUsername').value.trim().toLowerCase();
  const email    = document.getElementById('regEmail').value.trim();
  const pass     = document.getElementById('regPass').value;
  const pass2    = document.getElementById('regPass2').value;
  const errEl    = document.getElementById('registerError');
  hideErr(errEl);

  if (!username || !email || !pass) { showErr(errEl, 'Completa todos los campos.'); return; }
  if (!/^[a-z0-9_]+$/.test(username)) { showErr(errEl, 'Usuario: solo letras minúsculas, números y _.'); return; }
  if (pass.length < 6) { showErr(errEl, 'La contraseña debe tener al menos 6 caracteres.'); return; }
  if (pass !== pass2)  { showErr(errEl, 'Las contraseñas no coinciden.'); return; }
  if (FIXED_USERS.find(u => u.username === username)) { showErr(errEl, 'Ese nombre de usuario no está disponible.'); return; }

  const snapU = await getDoc(doc(db, 'usernames', username));
  if (snapU.exists()) { showErr(errEl, 'Ese nombre de usuario ya está en uso.'); return; }

  try {
    const cred = await createUserWithEmailAndPassword(auth, email, pass);
    await setDoc(doc(db, 'usernames', username), { uid: cred.user.uid, email });
    await setDoc(doc(db, 'usuarios', cred.user.uid), {
      username, email, exercises: [], doneSet: [], meals: [], bodyData: [], medidasData: [],
      needsOnboarding: true
    });
    await sendEmailVerification(cred.user);
    await signOut(auth);
    document.getElementById('verifyNotice').classList.remove('hidden');
    ['regUsername','regEmail','regPass','regPass2'].forEach(id => document.getElementById(id).value = '');
  } catch(e) { showErr(errEl, authMsg(e.code)); }
};

window.handleForgot = async () => {
  const email  = document.getElementById('forgotEmail').value.trim();
  const errEl  = document.getElementById('forgotError');
  const succEl = document.getElementById('forgotSuccess');
  hideErr(errEl); succEl.classList.add('hidden');
  if (!email) { showErr(errEl, 'Ingresa tu correo.'); return; }
  try { await sendPasswordResetEmail(auth, email); succEl.classList.remove('hidden'); }
  catch(e) { showErr(errEl, authMsg(e.code)); }
};

window.handleLogout = async () => {
  if (unsubUser)  unsubUser();
  if (unsubCycle) unsubCycle();
  if (chartInst)        { chartInst.destroy();        chartInst = null; }
  if (medidasChartInst) { medidasChartInst.destroy();  medidasChartInst = null; }
  currentUser = null; currentUID = null;
  exercises = []; doneSet = []; meals = []; bodyData = []; medidasData = []; cycle = null;
  sessionStorage.removeItem('fp_session');
  try { await signOut(auth); } catch(e) {}
  document.getElementById('appScreen').classList.add('hidden');
  document.getElementById('loginScreen').classList.remove('hidden');
  switchAuth('login');
};

onAuthStateChanged(auth, async (user) => {
  if (!user || sessionStorage.getItem('fp_session')) return;
  if (!user.emailVerified) return;
  currentUID = user.uid;
  const snap = await getDoc(doc(db, 'usuarios', user.uid));
  const data = snap.exists() ? snap.data() : {};
  currentUser = data.username || user.email.split('@')[0];
  if (!snap.exists()) {
    await setDoc(doc(db, 'usuarios', user.uid), { username: currentUser, email: user.email, exercises: [], doneSet: [], meals: [], bodyData: [], medidasData: [], needsOnboarding: true });
  }
  // Onboarding si es necesario
  if (data.needsOnboarding) {
    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('onboardingScreen').classList.remove('hidden');
    return;
  }
  enterApp(currentUser);
});

/* ══════════════════════════════════════════
   ONBOARDING
══════════════════════════════════════════ */
window.onboardNext = () => {
  const gender = document.querySelector('input[name="obGender"]:checked')?.value;
  const level  = document.getElementById('obLevel').value;
  if (!gender || !level) { alert('Por favor completa todos los campos.'); return; }
  document.getElementById('onboard1').classList.add('hidden');
  document.getElementById('onboard2').classList.remove('hidden');
};

window.toggleGoal = (btn) => btn.classList.toggle('active');

window.onboardFinish = async () => {
  const goals   = [...document.querySelectorAll('.goal-btn.active')].map(b => b.dataset.val);
  const errEl   = document.getElementById('onboardError');
  if (!goals.length) { errEl.classList.remove('hidden'); return; }
  errEl.classList.add('hidden');
  const gender  = document.querySelector('input[name="obGender"]:checked')?.value;
  const level   = document.getElementById('obLevel').value;
  await setDoc(doc(db, 'usuarios', currentUID), { gender, level, goals, needsOnboarding: false }, { merge: true });
  document.getElementById('onboardingScreen').classList.add('hidden');
  enterApp(currentUser);
};

/* ══════════════════════════════════════════
   ENTER APP
══════════════════════════════════════════ */
function enterApp(username) {
  document.getElementById('loginScreen').classList.add('hidden');
  document.getElementById('onboardingScreen').classList.add('hidden');
  document.getElementById('appScreen').classList.remove('hidden');
  document.getElementById('userBadge').textContent = username;
  const isAdmin = username === ADMIN;
  document.querySelectorAll('.admin-only').forEach(el => el.classList.toggle('hidden', !isAdmin));
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
      const d = snap.data();
      exercises   = d.exercises    || [];
      doneSet     = d.doneSet      || [];
      meals       = d.meals        || [];
      bodyData    = d.bodyData     || [];
      medidasData = d.medidasData  || [];
    }
    initApp();
  });
}

const save = (data) => setDoc(doc(db, 'usuarios', currentUID), data, { merge: true }).catch(() => alert('Error al guardar.'));
const saveUID = (uid, data) => setDoc(doc(db, 'usuarios', uid), data, { merge: true }).catch(() => alert('Error al guardar.'));

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
window.switchTab = (tab) => {
  ['rutina','dieta','progreso','ciclo','admin'].forEach(t => {
    document.getElementById(`panel${cap(t)}`)?.classList.toggle('hidden', t !== tab);
    document.getElementById(`tab${cap(t)}`)?.classList.toggle('active', t === tab);
  });
  const isAdmin = currentUser === ADMIN;
  document.getElementById('btnAgregar').style.display    = (tab==='rutina' && isAdmin) ? '' : 'none';
  document.getElementById('btnResetWeek').style.display  = (tab==='rutina' && isAdmin) ? '' : 'none';
  const bm = document.getElementById('btnAddMeal');
  if (bm) bm.style.display = (tab==='dieta' && isAdmin) ? '' : 'none';
  if (tab === 'progreso') switchProgressTab('comp');
  if (tab === 'ciclo')    renderCycle();
  if (tab === 'admin')    renderAdmin();
  if (tab === 'dieta')    renderDietDaysNav();
};

window.switchProgressTab = (sub) => {
  ['comp','medidas','graficas'].forEach(s => {
    document.getElementById(`pp${cap(s)}`)?.classList.toggle('hidden', s !== sub);
    document.getElementById(`pstab${cap(s)}`)?.classList.toggle('active', s === sub);
  });
  if (sub === 'comp')     renderBodyData();
  if (sub === 'medidas')  renderMedidasData();
  if (sub === 'graficas') renderGraficas();
};

/* ══════════════════════════════════════════
   RUTINA
══════════════════════════════════════════ */
function renderDaysNav() {
  document.getElementById('daysNav').innerHTML = DAYS.map(day => {
    const n = exercises.filter(e => e.day === day).length;
    return `<button class="day-pill${day===currentDay?' active':''}" onclick="selectDay('${day}')">${day}${n?`<span class="day-count">${n}</span>`:''}</button>`;
  }).join('');
}

window.selectDay = (day) => {
  currentDay = day;
  document.getElementById('sectionTitle').textContent = day.toUpperCase();
  renderDaysNav(); renderExercises();
};

function renderExercises(exList, targetUID) {
  const list    = document.getElementById('exercisesList');
  const isAdmin = currentUser === ADMIN;
  const src     = exList || exercises.filter(e => e.day === currentDay);
  if (!src.length) {
    list.innerHTML = `<div class="empty-state"><p>No hay ejercicios para <strong>${currentDay}</strong>.</p>${isAdmin?`<button class="btn-sm" onclick="openModal('${currentDay}')">Agregar ejercicio</button>`:''}</div>`;
    return;
  }
  list.innerHTML = `<div class="exercise-grid">${src.map((ex,i) => buildCard(ex,i,src.length,targetUID)).join('')}</div>`;
}

function buildCard(ex, idx, total, targetUID) {
  const isDone  = doneSet.includes(ex.id);
  const isAdmin = currentUser === ADMIN;
  const wh      = ex.weightHistory || [];
  const lastW   = wh.length ? wh[wh.length-1] : null;
  const tu      = targetUID ? `,'${targetUID}'` : '';

  const gifHtml = ex.gif
    ? `<div class="card-media"><img src="${ex.gif}" loading="lazy" alt="${ex.name}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"/><div class="card-media-fallback" style="display:none">${ex.name.charAt(0)}</div></div>`
    : `<div class="card-media"><div class="card-media-fallback">${ex.name.charAt(0)}</div></div>`;

  return `<div class="exercise-card">
    ${gifHtml}
    <div class="card-body">
      ${ex.muscle ? `<div class="card-tag">${ex.muscle}</div>` : ''}
      <div class="card-name">${ex.name}</div>
      <div class="card-meta">
        ${ex.sets  ? `<span class="meta-item">${ex.sets} series</span>` : ''}
        ${ex.reps  ? `<span class="meta-item">${ex.reps} reps</span>` : ''}
        ${ex.rest  ? `<span class="meta-item">${ex.rest}</span>` : ''}
        ${lastW    ? `<span class="meta-item weight">${lastW.kg} kg</span>` : ''}
      </div>
      ${ex.notes ? `<div class="card-notes">${ex.notes}</div>` : ''}
    </div>
    <div class="card-footer">
      <button class="btn-done${isDone?' active':''}" onclick="toggleDone('${ex.id}')">${isDone?'Completado':'Marcar hecho'}</button>
      <div class="card-actions-right">
        <button class="btn-icon-sm" onclick="openWeightModal('${ex.id}',${targetUID?`'${targetUID}'`:'null'})" title="Actualizar peso">kg</button>
        ${isAdmin ? `
        <button class="btn-icon-sm" onclick="editExercise('${ex.id}'${tu})" title="Editar">✎</button>
        ${idx>0?`<button class="btn-icon-sm" onclick="moveExercise('${ex.id}','up'${tu})">↑</button>`:''}
        ${idx<total-1?`<button class="btn-icon-sm" onclick="moveExercise('${ex.id}','down'${tu})">↓</button>`:''}
        <button class="btn-icon-sm danger" onclick="deleteExercise('${ex.id}'${tu})" title="Eliminar">✕</button>` : ''}
      </div>
    </div>
  </div>`;
}

window.toggleDone = async (id) => {
  doneSet.includes(id) ? doneSet = doneSet.filter(d => d !== id) : doneSet.push(id);
  await save({ doneSet });
};

window.deleteExercise = async (id, targetUID) => {
  if (!confirm('¿Eliminar este ejercicio?')) return;
  const uid  = targetUID || currentUID;
  const snap = await getDoc(doc(db, 'usuarios', uid));
  const d    = snap.data();
  d.exercises = d.exercises.filter(e => e.id !== id);
  await saveUID(uid, d);
  if (uid === currentUID) { exercises = d.exercises; renderDaysNav(); renderExercises(); }
  else adminLoadUser();
};

window.editExercise = async (id, targetUID) => {
  const uid  = targetUID || currentUID;
  const snap = await getDoc(doc(db, 'usuarios', uid));
  const ex   = (snap.data()?.exercises || []).find(e => e.id === id);
  if (!ex) return;
  document.getElementById('exerciseModalTitle').textContent = 'Editar ejercicio';
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

window.moveExercise = async (id, dir, targetUID) => {
  const uid  = targetUID || currentUID;
  const snap = await getDoc(doc(db, 'usuarios', uid));
  const d    = snap.data();
  const exs  = d.exercises || [];
  const idx  = exs.findIndex(e => e.id === id);
  const ni   = dir === 'up' ? idx - 1 : idx + 1;
  if (ni < 0 || ni >= exs.length) return;
  [exs[idx], exs[ni]] = [exs[ni], exs[idx]];
  d.exercises = exs;
  await saveUID(uid, d);
  if (uid === currentUID) { exercises = exs; renderExercises(); }
  else adminLoadUser();
};

window.confirmResetWeek = () => {
  if (!confirm('¿Resetear la semana? Todos los ejercicios se desmarcarán como completados.')) return;
  doneSet = []; save({ doneSet });
};

/* ══════════════════════════════════════════
   MOVER EJERCICIOS ENTRE DÍAS
══════════════════════════════════════════ */
window.openMoveExercisesModal = async () => {
  document.getElementById('moveFrom').value = currentDay;
  // Cargar usuarios en select
  const users = await getAdminUsers();
  const sel = document.getElementById('moveUserSelect');
  sel.innerHTML = `<option value="${currentUID}">${currentUser} (yo)</option>` +
    users.map(u => `<option value="${u.uid}">${u.username}</option>`).join('');
  document.getElementById('moveExOverlay').classList.add('open');
};
window.closeMoveExercisesModal = () => document.getElementById('moveExOverlay').classList.remove('open');

window.executeMoveExercises = async () => {
  const from = document.getElementById('moveFrom').value;
  const to   = document.getElementById('moveTo').value;
  const uid  = document.getElementById('moveUserSelect').value;
  if (from === to) { alert('El día origen y destino son iguales.'); return; }
  const snap = await getDoc(doc(db, 'usuarios', uid));
  const d    = snap.data();
  d.exercises = (d.exercises || []).map(ex => ex.day === from ? { ...ex, day: to } : ex);
  await saveUID(uid, d);
  if (uid === currentUID) exercises = d.exercises;
  closeMoveExercisesModal();
  renderDaysNav(); renderExercises();
  alert(`Ejercicios movidos de ${from} a ${to}.`);
};

/* ══════════════════════════════════════════
   GUARDAR / CARGAR RUTINAS
══════════════════════════════════════════ */
window.openSaveRoutineModal = async () => {
  const users = await getAdminUsers();
  const sel   = document.getElementById('routineUserSelect');
  sel.innerHTML = `<option value="${currentUID}">${currentUser} (yo)</option>` +
    users.map(u => `<option value="${u.uid}">${u.username}</option>`).join('');
  document.getElementById('saveRoutineOverlay').classList.add('open');
};
window.closeSaveRoutineModal = () => document.getElementById('saveRoutineOverlay').classList.remove('open');

window.saveRoutine = async () => {
  const name  = document.getElementById('routineName').value.trim();
  const scope = document.querySelector('input[name="routineScope"]:checked')?.value;
  const uid   = document.getElementById('routineUserSelect').value;
  if (!name) { alert('Ingresa un nombre para la rutina.'); return; }

  const snap  = await getDoc(doc(db, 'usuarios', uid));
  const exs   = snap.data()?.exercises || [];
  const toSave = scope === 'day'
    ? exs.filter(e => e.day === currentDay)
    : exs;

  if (!toSave.length) { alert('No hay ejercicios para guardar.'); return; }

  const routineId = Date.now().toString();
  await setDoc(doc(db, 'rutinas', routineId), {
    id: routineId, name, scope, day: scope === 'day' ? currentDay : null,
    exercises: toSave, createdAt: today()
  });
  closeSaveRoutineModal();
  alert(`Rutina "${name}" guardada correctamente.`);
};

window.openSavedRoutinesModal = async () => {
  const snap = await getDocs(collection(db, 'rutinas'));
  const list = document.getElementById('savedRoutinesList');
  if (snap.empty) { list.innerHTML = '<p style="color:var(--muted)">No hay rutinas guardadas.</p>'; }
  else {
    list.innerHTML = snap.docs.map(d => {
      const r = d.data();
      return `<div class="routine-row">
        <div>
          <div class="routine-name">${r.name}</div>
          <div class="routine-meta">${r.scope === 'day' ? r.day : 'Semana completa'} · ${r.exercises?.length || 0} ejercicios · ${r.createdAt}</div>
        </div>
        <div style="display:flex;gap:8px">
          <button class="btn-sm" onclick="applyRoutine('${r.id}')">Aplicar</button>
          <button class="btn-sm danger" onclick="deleteRoutine('${r.id}')">Eliminar</button>
        </div>
      </div>`;
    }).join('');
  }
  document.getElementById('savedRoutinesOverlay').classList.add('open');
};
window.closeSavedRoutinesModal = () => document.getElementById('savedRoutinesOverlay').classList.remove('open');

window.applyRoutine = async (id) => {
  const snap = await getDoc(doc(db, 'rutinas', id));
  if (!snap.exists()) return;
  const r    = snap.data();
  const exs  = (r.exercises || []).map(e => ({ ...e, id: Date.now().toString() + Math.random().toString(36).slice(2) }));
  exercises  = [...exercises, ...exs];
  await save({ exercises });
  closeSavedRoutinesModal();
  renderDaysNav(); renderExercises();
  alert(`Rutina "${r.name}" aplicada.`);
};

window.deleteRoutine = async (id) => {
  if (!confirm('¿Eliminar esta rutina guardada?')) return;
  await deleteDoc(doc(db, 'rutinas', id));
  openSavedRoutinesModal();
};

/* ══════════════════════════════════════════
   MODAL EJERCICIO
══════════════════════════════════════════ */
window.openModal = (day) => {
  document.getElementById('exerciseModalTitle').textContent = 'Nuevo ejercicio';
  document.getElementById('fDay').value = day || currentDay;
  document.getElementById('fEditId').value = '';
  document.getElementById('fTargetUser').value = '';
  document.getElementById('overlay').classList.add('open');
};
window.closeModal = () => {
  document.getElementById('overlay').classList.remove('open');
  ['fName','fSets','fReps','fRest','fGif','fNotes','fWeight','fEditId','fTargetUser']
    .forEach(id => document.getElementById(id).value = '');
  document.getElementById('fMuscle').value = '';
  const p = document.getElementById('gifPreview');
  p.innerHTML = '<span>Vista previa aquí</span>';
  p.classList.remove('has-img');
  document.getElementById('gifError').classList.add('hidden');
};
window.handleOverlayClick = (e) => { if (e.target === document.getElementById('overlay')) closeModal(); };

window.previewGif = () => {
  let url = document.getElementById('fGif').value.trim();
  const preview = document.getElementById('gifPreview'), err = document.getElementById('gifError');
  err.classList.add('hidden');
  if (!url) return;
  if (url.includes('giphy.com/gifs/') && !url.endsWith('.gif')) {
    const parts = url.split('-'); const hash = parts[parts.length-1].split('/')[0];
    if (hash) { url = `https://media.giphy.com/media/${hash}/giphy.gif`; document.getElementById('fGif').value = url; }
  }
  preview.innerHTML = '<span>Cargando...</span>';
  const img = new Image(); img.crossOrigin = 'anonymous'; img.src = url;
  img.onload  = () => { preview.innerHTML=''; img.style.cssText='width:100%;height:100%;object-fit:cover;border-radius:6px'; preview.appendChild(img); preview.classList.add('has-img'); };
  img.onerror = () => { err.classList.remove('hidden'); preview.classList.remove('has-img'); preview.innerHTML='<span>No se pudo cargar</span>'; };
};

window.saveExercise = async () => {
  const name      = document.getElementById('fName').value.trim();
  const day       = document.getElementById('fDay').value;
  const editId    = document.getElementById('fEditId').value;
  const targetUID = document.getElementById('fTargetUser').value || currentUID;
  if (!name) { alert('Ingresa el nombre del ejercicio.'); return; }

  const snap   = await getDoc(doc(db, 'usuarios', targetUID));
  const d      = snap.data() || {};
  const exs    = d.exercises || [];
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
      if (weight > 0) {
        if (!exs[idx].weightHistory) exs[idx].weightHistory = [];
        exs[idx].weightHistory.push({ kg: weight, date: today() });
      }
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
  await saveUID(targetUID, d);
  closeModal();
  if (targetUID === currentUID) {
    exercises = exs; currentDay = day;
    document.getElementById('sectionTitle').textContent = day.toUpperCase();
    renderDaysNav(); renderExercises(); updateProgress();
  } else adminLoadUser();
};

/* ══════════════════════════════════════════
   PESO POR EJERCICIO
══════════════════════════════════════════ */
window.openWeightModal = async (id, targetUID) => {
  editingWeightId = id;
  const uid  = targetUID || currentUID;
  const snap = await getDoc(doc(db, 'usuarios', uid));
  const ex   = (snap.data()?.exercises || []).find(e => e.id === id);
  if (!ex) return;
  document.getElementById('weightModalTitle').textContent = ex.name;
  document.getElementById('wNewWeight').value = '';
  document.getElementById('weightOverlay').dataset.targetUID = targetUID || '';
  const wh   = ex.weightHistory || [];
  const wrap = document.getElementById('weightHistoryWrap');
  wrap.innerHTML = wh.length
    ? `<div class="weight-hist-title">Historial</div><div class="weight-hist-list">${[...wh].reverse().map((w,i) =>
        `<div class="weight-hist-row"><span>${formatDate(w.date)}</span><span class="wh-kg">${w.kg} kg</span>
        <button class="btn-icon-sm danger" onclick="deleteWeightEntry('${id}',${wh.length-1-i},'${targetUID||''}')">✕</button></div>`
      ).join('')}</div>`
    : '<p class="text-muted" style="margin-bottom:12px">Sin registros de peso aún.</p>';
  document.getElementById('weightOverlay').classList.add('open');
};
window.closeWeightModal = () => { document.getElementById('weightOverlay').classList.remove('open'); editingWeightId = null; };

window.saveWeight = async () => {
  const kg = parseFloat(document.getElementById('wNewWeight').value);
  if (!kg || kg <= 0) { alert('Ingresa un peso válido.'); return; }
  const targetUID = document.getElementById('weightOverlay').dataset.targetUID || currentUID;
  const snap = await getDoc(doc(db, 'usuarios', targetUID));
  const d    = snap.data();
  const ex   = (d.exercises || []).find(e => e.id === editingWeightId);
  if (!ex) return;
  if (!ex.weightHistory) ex.weightHistory = [];
  ex.weightHistory.push({ kg, date: today() });
  await saveUID(targetUID, d);
  if (targetUID === currentUID) exercises = d.exercises;
  closeWeightModal();
};

window.deleteWeightEntry = async (exId, idx, targetUID) => {
  if (!confirm('¿Eliminar este registro?')) return;
  const uid  = targetUID || currentUID;
  const snap = await getDoc(doc(db, 'usuarios', uid));
  const d    = snap.data();
  const ex   = (d.exercises || []).find(e => e.id === exId);
  if (ex) { ex.weightHistory.splice(idx, 1); await saveUID(uid, d); }
  openWeightModal(exId, targetUID || null);
};

/* ══════════════════════════════════════════
   DIETA
══════════════════════════════════════════ */
function renderDietDaysNav() {
  document.getElementById('dietDaysNav').innerHTML = DAYS.map(day => {
    const n = meals.filter(m => m.day === day).length;
    return `<button class="day-pill${day===currentDietDay?' active':''}" onclick="selectDietDay('${day}')">${day}${n?`<span class="day-count">${n}</span>`:''}</button>`;
  }).join('');
  renderDietContent();
}

window.selectDietDay = (day) => {
  currentDietDay = day;
  document.getElementById('dietSectionTitle').textContent = day.toUpperCase();
  renderDietDaysNav();
};

function renderDietContent(mealList, targetUID) {
  const cont    = document.getElementById('dietContent');
  const isAdmin = currentUser === ADMIN;
  const src     = mealList || meals;
  const dayM    = src.filter(m => m.day === currentDietDay);

  if (!dayM.length) {
    cont.innerHTML = `<div class="empty-state"><p>No hay comidas para <strong>${currentDietDay}</strong>.</p>${isAdmin?`<button class="btn-sm" onclick="openMealModal('${currentDietDay}')">Agregar comida</button>`:''}</div>`;
    return;
  }

  let html = '';
  MEAL_TIMES.forEach(time => {
    const tm = dayM.filter(m => m.time === time);
    if (!tm.length) return;
    const totCal   = tm.reduce((s,m) => s + (parseFloat(m.cal)  || 0), 0);
    const totProt  = tm.reduce((s,m) => s + (parseFloat(m.prot) || 0), 0);
    const totCarbs = tm.reduce((s,m) => s + (parseFloat(m.carbs)|| 0), 0);
    const totFat   = tm.reduce((s,m) => s + (parseFloat(m.fat)  || 0), 0);
    const tu       = targetUID ? `,'${targetUID}'` : '';
    html += `<div class="meal-section">
      <div class="meal-section-header">
        <span class="meal-section-title">${time}</span>
        <div class="meal-macros-row">
          ${totCal   ? `<span class="macro-tag cal">${Math.round(totCal)} kcal</span>` : ''}
          ${totProt  ? `<span class="macro-tag prot">P: ${Math.round(totProt)}g</span>` : ''}
          ${totCarbs ? `<span class="macro-tag carbs">C: ${Math.round(totCarbs)}g</span>` : ''}
          ${totFat   ? `<span class="macro-tag fat">G: ${Math.round(totFat)}g</span>` : ''}
        </div>
      </div>
      ${tm.map(m => `<div class="meal-item">
        <div class="meal-item-body">
          <div class="meal-item-name">${m.name}${m.qty ? ` <span class="meal-qty">${m.qty}</span>` : ''}</div>
          <div class="meal-item-macros">
            ${m.cal   ? `<span class="macro-tag sm cal">${m.cal} kcal</span>` : ''}
            ${m.prot  ? `<span class="macro-tag sm prot">P: ${m.prot}g</span>` : ''}
            ${m.carbs ? `<span class="macro-tag sm carbs">C: ${m.carbs}g</span>` : ''}
            ${m.fat   ? `<span class="macro-tag sm fat">G: ${m.fat}g</span>` : ''}
          </div>
          ${m.notes ? `<div class="card-notes">${m.notes}</div>` : ''}
        </div>
        ${isAdmin ? `<div class="meal-item-actions">
          <button class="btn-icon-sm" onclick="editMeal('${m.id}'${tu})">✎</button>
          <button class="btn-icon-sm danger" onclick="deleteMeal('${m.id}'${tu})">✕</button>
        </div>` : ''}
      </div>`).join('')}
    </div>`;
  });
  cont.innerHTML = html;
}

window.openMealModal = (day, targetUID) => {
  document.getElementById('mealModalTitle').textContent = 'Nueva comida';
  document.getElementById('mealDay').value = day || currentDietDay;
  document.getElementById('mealEditId').value = '';
  document.getElementById('mealTargetUser').value = targetUID || '';
  document.getElementById('mealOverlay').classList.add('open');
};
window.closeMealModal = () => {
  document.getElementById('mealOverlay').classList.remove('open');
  ['mealName','mealQty','mealCal','mealProt','mealCarbs','mealFat','mealNotes','mealEditId','mealTargetUser']
    .forEach(id => document.getElementById(id).value = '');
};

window.editMeal = async (id, targetUID) => {
  const uid  = targetUID || currentUID;
  const snap = await getDoc(doc(db, 'usuarios', uid));
  const m    = (snap.data()?.meals || []).find(m => m.id === id);
  if (!m) return;
  document.getElementById('mealModalTitle').textContent = 'Editar comida';
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
  document.getElementById('mealTargetUser').value = targetUID || '';
  document.getElementById('mealOverlay').classList.add('open');
};

window.deleteMeal = async (id, targetUID) => {
  if (!confirm('¿Eliminar esta comida?')) return;
  const uid  = targetUID || currentUID;
  const snap = await getDoc(doc(db, 'usuarios', uid));
  const d    = snap.data();
  d.meals    = (d.meals || []).filter(m => m.id !== id);
  await saveUID(uid, d);
  if (uid === currentUID) { meals = d.meals; renderDietDaysNav(); }
  else adminShowDiet(document.getElementById('adminViewUser').value);
};

window.saveMeal = async () => {
  const name      = document.getElementById('mealName').value.trim();
  const targetUID = document.getElementById('mealTargetUser').value || currentUID;
  if (!name) { alert('Ingresa el nombre del alimento.'); return; }
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

  const snap = await getDoc(doc(db, 'usuarios', targetUID));
  const d    = snap.data() || {};
  const mls  = d.meals || [];
  if (editId) { const i = mls.findIndex(m => m.id === editId); if (i >= 0) mls[i] = meal; }
  else mls.push(meal);
  d.meals = mls;
  await saveUID(targetUID, d);
  closeMealModal();
  if (targetUID === currentUID) { meals = mls; renderDietDaysNav(); }
  else adminShowDiet(targetUID);
};

/* ══════════════════════════════════════════
   COMPOSICIÓN CORPORAL
══════════════════════════════════════════ */
const RANGES = {
  grasa:    [[0,6,'Muy bajo','low'],[6,18,'Atlético','good'],[18,25,'Normal','ok'],[25,32,'Alto','warn'],[32,100,'Elevado','danger']],
  visceral: [[0,9,'Normal','good'],[9,15,'Alto','warn'],[15,100,'Peligroso','danger']],
  bmi:      [[0,18.5,'Bajo peso','low'],[18.5,25,'Normal','good'],[25,30,'Sobrepeso','warn'],[30,100,'Obesidad','danger']],
  agua:     [[0,45,'Bajo','warn'],[45,65,'Normal','good'],[65,100,'Alto','low']],
};
const semaforo = (key, val) => {
  if (!val) return '';
  for (const [min,max,label,cls] of (RANGES[key] || [])) {
    if (val >= min && val < max) return `<span class="semaforo ${cls}">${label}</span>`;
  }
  return '';
};

window.openBodyModal  = () => { document.getElementById('bDate').value = today(); document.getElementById('bodyOverlay').classList.add('open'); };
window.closeBodyModal = () => {
  document.getElementById('bodyOverlay').classList.remove('open');
  ['bEdad','bEstatura','bPeso','bAgua','bGrasa','bHueso','bVisceral','bMusculo','bBMI','bBMR','bEdadFisio']
    .forEach(id => document.getElementById(id).value = '');
};
window.saveBody = async () => {
  const date = document.getElementById('bDate').value; if (!date) { alert('Selecciona una fecha.'); return; }
  const peso = parseFloat(document.getElementById('bPeso').value) || null;
  const est  = parseFloat(document.getElementById('bEstatura').value) || null;
  const edad = parseFloat(document.getElementById('bEdad').value) || null;
  let bmi    = parseFloat(document.getElementById('bBMI').value) || null;
  let bmr    = parseFloat(document.getElementById('bBMR').value) || null;
  if (!bmi && peso && est) bmi = +(peso / ((est/100)**2)).toFixed(1);
  if (!bmr && peso && est && edad) bmr = Math.round(10*peso + 6.25*est - 5*edad + 5);
  bodyData.push({ id: Date.now().toString(), date, edad, estatura: est, peso,
    agua: parseFloat(document.getElementById('bAgua').value) || null,
    grasa: parseFloat(document.getElementById('bGrasa').value) || null,
    hueso: parseFloat(document.getElementById('bHueso').value) || null,
    visceral: parseFloat(document.getElementById('bVisceral').value) || null,
    musculo: parseFloat(document.getElementById('bMusculo').value) || null,
    bmi, bmr, edadFisio: parseFloat(document.getElementById('bEdadFisio').value) || null,
  });
  bodyData.sort((a,b) => a.date.localeCompare(b.date));
  await save({ bodyData }); closeBodyModal(); renderBodyData();
};

function renderBodyData() {
  const el   = document.getElementById('bodyLatest');
  const hist = document.getElementById('bodyHistory');
  if (!bodyData.length) {
    el.innerHTML = '<div class="empty-state"><p>Agrega tu primera medición de composición corporal.</p></div>';
    hist.innerHTML = ''; return;
  }
  const last   = bodyData[bodyData.length-1];
  const fields = [
    {k:'peso',l:'Peso',u:'kg'},{k:'estatura',l:'Estatura',u:'cm'},
    {k:'grasa',l:'Grasa corporal',u:'%'},{k:'musculo',l:'Masa muscular',u:'%'},
    {k:'agua',l:'Agua corporal',u:'%'},{k:'bmi',l:'BMI',u:''},
    {k:'bmr',l:'BMR',u:'kcal'},{k:'visceral',l:'Grasa visceral',u:''},
    {k:'hueso',l:'Masa ósea',u:'kg'},{k:'edadFisio',l:'Edad fisiológica',u:'años'}
  ];
  el.innerHTML = `<div class="stat-grid">${fields.filter(f => last[f.k] != null).map(f =>
    `<div class="stat-card"><div class="stat-val">${last[f.k]}<span>${f.u}</span></div><div class="stat-lbl">${f.l}</div>${semaforo(f.k, last[f.k])}</div>`
  ).join('')}</div><p class="text-muted" style="margin:12px 0 20px">Última actualización: <strong>${formatDate(last.date)}</strong></p>`;

  hist.innerHTML = `<h3 class="section-subtitle">Historial</h3>` +
    [...bodyData].reverse().map((r,i) => `<div class="history-row">
      <div class="history-date">${formatDate(r.date)}</div>
      <div class="history-tags">
        ${r.peso    ? `<span class="htag">${r.peso} kg</span>` : ''}
        ${r.grasa   ? `<span class="htag">${r.grasa}% grasa</span>` : ''}
        ${r.musculo ? `<span class="htag">${r.musculo}% músculo</span>` : ''}
        ${r.bmi     ? `<span class="htag">BMI ${r.bmi}</span>` : ''}
      </div>
      <button class="btn-icon-sm danger" onclick="deleteBody(${bodyData.length-1-i})">✕</button>
    </div>`).join('');
}
window.deleteBody = async (i) => { if (!confirm('¿Eliminar?')) return; bodyData.splice(i,1); await save({bodyData}); renderBodyData(); };

/* ══════════════════════════════════════════
   MEDIDAS CORPORALES
══════════════════════════════════════════ */
window.openMedidasModal  = () => { document.getElementById('mDate').value = today(); document.getElementById('medidasOverlay').classList.add('open'); };
window.closeMedidasModal = () => {
  document.getElementById('medidasOverlay').classList.remove('open');
  MEDIDAS_KEYS.forEach(k => { const el = document.getElementById('m'+k); if (el) el.value = ''; });
  document.getElementById('mDate').value = '';
};
window.saveMedidas = async () => {
  const date = document.getElementById('mDate').value; if (!date) { alert('Selecciona una fecha.'); return; }
  const record = { id: Date.now().toString(), date };
  MEDIDAS_KEYS.forEach(k => { const v = parseFloat(document.getElementById('m'+k)?.value) || null; if (v) record[k] = v; });
  if (Object.keys(record).length <= 2) { alert('Ingresa al menos una medida.'); return; }
  medidasData.push(record); medidasData.sort((a,b) => a.date.localeCompare(b.date));
  await save({ medidasData }); closeMedidasModal(); renderMedidasData();
};

function renderMedidasData() {
  const el   = document.getElementById('medidasLatest');
  const hist = document.getElementById('medidasHistory');
  if (!medidasData.length) {
    el.innerHTML = '<div class="empty-state"><p>Agrega tu primera medición corporal.</p></div>';
    hist.innerHTML = ''; return;
  }
  const last = medidasData[medidasData.length-1], first = medidasData[0];
  el.innerHTML = `<div class="medidas-table">
    <div class="mt-row header"><span>Medida</span><span>Actual</span><span>Cambio</span></div>
    ${MEDIDAS_KEYS.filter(k => last[k] != null).map(k => {
      const diff  = first[k] && last[k] ? (last[k]-first[k]).toFixed(1) : null;
      const color = diff === null ? '' : parseFloat(diff) > 0 ? 'color:var(--success)' : 'color:#ef4444';
      return `<div class="mt-row"><span>${MEDIDAS_LABELS[k]}</span><span><strong>${last[k]} cm</strong></span><span style="${color}">${diff !== null ? (parseFloat(diff)>0?'+':'')+diff+' cm' : '—'}</span></div>`;
    }).join('')}
  </div><p class="text-muted" style="margin:12px 0 20px">Última actualización: <strong>${formatDate(last.date)}</strong></p>`;

  hist.innerHTML = `<h3 class="section-subtitle">Historial</h3>` +
    [...medidasData].reverse().map((r,i) => `<div class="history-row">
      <div class="history-date">${formatDate(r.date)}</div>
      <div class="history-tags">${MEDIDAS_KEYS.filter(k => r[k]).slice(0,4).map(k => `<span class="htag">${MEDIDAS_LABELS[k]}: ${r[k]}cm</span>`).join('')}</div>
      <button class="btn-icon-sm danger" onclick="deleteMedida(${medidasData.length-1-i})">✕</button>
    </div>`).join('');
}
window.deleteMedida = async (i) => { if (!confirm('¿Eliminar?')) return; medidasData.splice(i,1); await save({medidasData}); renderMedidasData(); };

/* ══════════════════════════════════════════
   GRÁFICAS
══════════════════════════════════════════ */
function renderGraficas() { renderBodyChart(currentBodyChart); renderMedidasChart(currentMedidasChart); renderWeightCharts(); }

window.switchBodyChart = (type) => {
  currentBodyChart = type;
  document.querySelectorAll('#bodyChartTabs .ctab').forEach(b => b.classList.toggle('active', b.textContent.toLowerCase() === type));
  renderBodyChart(type);
};

function renderBodyChart(type) {
  const canvas = document.getElementById('bodyChart'), empty = document.getElementById('bodyChartEmpty');
  const data   = bodyData.filter(r => r[type] != null);
  if (data.length < 2) { canvas.style.display='none'; empty.style.display='flex'; return; }
  canvas.style.display='block'; empty.style.display='none';
  if (chartInst) chartInst.destroy();
  const clr = { peso:'#b91c1c', grasa:'#dc2626', musculo:'#7f1d1d', agua:'#3b82f6' };
  const unt  = { peso:'kg', grasa:'%', musculo:'%', agua:'%' };
  chartInst = new Chart(canvas, { type:'line', data:{ labels: data.map(r => formatDate(r.date)), datasets:[{ label:`${type} (${unt[type]})`, data: data.map(r => r[type]), borderColor: clr[type], backgroundColor: clr[type]+'20', borderWidth:2, pointBackgroundColor: clr[type], pointRadius:4, tension:0.3, fill:true }] }, options:{ responsive:true, plugins:{ legend:{ labels:{ color:'#f5f5f5', font:{ family:'Inter' } } } }, scales:{ x:{ ticks:{ color:'#888' }, grid:{ color:'#2a2a2a' } }, y:{ ticks:{ color:'#888' }, grid:{ color:'#2a2a2a' } } } } });
}

function renderMedidasChart(key) {
  const tabs   = document.getElementById('medidasChartTabs');
  tabs.innerHTML = MEDIDAS_KEYS.map(k => `<button class="ctab${k===key?' active':''}" onclick="switchMedidasChart('${k}')">${MEDIDAS_LABELS[k]}</button>`).join('');
  const canvas = document.getElementById('medidasChart'), empty = document.getElementById('medidasChartEmpty');
  const data   = medidasData.filter(r => r[key] != null);
  if (data.length < 2) { canvas.style.display='none'; empty.style.display='flex'; return; }
  canvas.style.display='block'; empty.style.display='none';
  if (medidasChartInst) medidasChartInst.destroy();
  medidasChartInst = new Chart(canvas, { type:'line', data:{ labels: data.map(r => formatDate(r.date)), datasets:[{ label:`${MEDIDAS_LABELS[key]} (cm)`, data: data.map(r => r[key]), borderColor:'#b91c1c', backgroundColor:'#b91c1c20', borderWidth:2, pointBackgroundColor:'#b91c1c', pointRadius:4, tension:0.3, fill:true }] }, options:{ responsive:true, plugins:{ legend:{ labels:{ color:'#f5f5f5', font:{ family:'Inter' } } } }, scales:{ x:{ ticks:{ color:'#888' }, grid:{ color:'#2a2a2a' } }, y:{ ticks:{ color:'#888' }, grid:{ color:'#2a2a2a' } } } } });
}
window.switchMedidasChart = (key) => { currentMedidasChart = key; renderMedidasChart(key); };

function renderWeightCharts() {
  const sec  = document.getElementById('weightChartSection');
  const withH = exercises.filter(e => (e.weightHistory||[]).length >= 2);
  if (!withH.length) { sec.innerHTML = '<p class="text-muted">Agrega al menos 2 registros de peso en un ejercicio para ver su evolución.</p>'; return; }
  sec.innerHTML = withH.map(ex => `<div class="card" style="margin-bottom:16px"><div class="card-title">${ex.name}</div><canvas id="wc-${ex.id}" height="80"></canvas></div>`).join('');
  withH.forEach(ex => { new Chart(document.getElementById(`wc-${ex.id}`), { type:'line', data:{ labels: ex.weightHistory.map(w => formatDate(w.date)), datasets:[{ label:'Peso (kg)', data: ex.weightHistory.map(w => w.kg), borderColor:'#b91c1c', backgroundColor:'#b91c1c20', borderWidth:2, pointBackgroundColor:'#b91c1c', pointRadius:4, tension:0.3, fill:true }] }, options:{ responsive:true, plugins:{ legend:{ display:false } }, scales:{ x:{ ticks:{ color:'#888', font:{size:10} }, grid:{ color:'#2a2a2a' } }, y:{ ticks:{ color:'#888' }, grid:{ color:'#2a2a2a' } } } } }); });
}

/* ══════════════════════════════════════════
   CICLO
══════════════════════════════════════════ */
function renderCycle() {
  const hero = document.getElementById('cycleHero');
  const cfg  = document.getElementById('cycleConfig');
  if (cfg) cfg.classList.toggle('hidden', currentUser !== ADMIN);
  if (cycle?.start) {
    document.getElementById('cycleStart').value = cycle.start;
    document.getElementById('cycleEnd').value   = cycle.end;
    document.getElementById('cycleName').value  = cycle.name || '';
  }
  if (!cycle?.start || !cycle?.end) { hero.innerHTML = '<p class="text-muted" style="padding:20px 0">No hay ciclo configurado.</p>'; return; }
  const t0    = new Date(); t0.setHours(0,0,0,0);
  const start = new Date(cycle.start+'T00:00:00'), end = new Date(cycle.end+'T00:00:00');
  const total = Math.round((end-start)/86400000);
  const elapsed = Math.round((t0-start)/86400000);
  const rem   = Math.round((end-t0)/86400000);
  const pct   = Math.min(100, Math.max(0, Math.round(elapsed/total*100)));
  let status  = '';
  if (t0 < start) status = `<div class="cycle-badge pending">Comienza en ${Math.round((start-t0)/86400000)} días</div>`;
  else if (t0 > end) status = '<div class="cycle-badge done">Ciclo completado</div>';
  else {
    const w = Math.floor(rem/7), d = rem%7;
    const txt = [(w>0?`${w} sem`:''),(d>0?`${d} días`:'')].filter(Boolean).join(' y ');
    status = `<div class="cycle-badge ${rem<=7?'warn':'active'}">Quedan ${txt}</div>`;
  }
  hero.innerHTML = `
    ${cycle.name ? `<div class="cycle-name">${cycle.name}</div>` : ''}
    <div class="cycle-dates">${formatDate(cycle.start)} <span>—</span> ${formatDate(cycle.end)}</div>
    ${status}
    <div class="cycle-track"><div class="cycle-fill" style="width:${pct}%"></div></div>
    <div class="cycle-track-labels"><span>Inicio</span><span>${pct}% completado</span><span>Fin</span></div>
    <div class="cycle-stats">
      <div class="cstat"><span class="cstat-val">${total}</span><span class="cstat-lbl">días totales</span></div>
      <div class="cstat"><span class="cstat-val">${Math.max(0,elapsed)}</span><span class="cstat-lbl">cursados</span></div>
      <div class="cstat"><span class="cstat-val">${Math.max(0,rem)}</span><span class="cstat-lbl">restantes</span></div>
    </div>`;
}
window.saveCycle = async () => {
  const start = document.getElementById('cycleStart').value;
  const end   = document.getElementById('cycleEnd').value;
  const name  = document.getElementById('cycleName').value.trim();
  if (!start || !end) { alert('Selecciona fechas de inicio y fin.'); return; }
  if (end <= start)   { alert('La fecha de fin debe ser posterior al inicio.'); return; }
  await setDoc(doc(db, 'config', 'ciclo'), { start, end, name });
};

/* ══════════════════════════════════════════
   ADMIN
══════════════════════════════════════════ */
async function getAdminUsers() {
  const snap = await getDocs(collection(db, 'usuarios'));
  return snap.docs
    .map(d => ({ uid: d.id, username: d.data().username || d.id, gender: d.data().gender || '', level: d.data().level || '', goals: d.data().goals || [] }))
    .filter(u => u.username !== ADMIN);
}

async function renderAdmin() {
  allUsers = await getAdminUsers();
  filterUsers();
  // Populate selects
  const sel = document.getElementById('adminViewUser');
  sel.innerHTML = '<option value="">— Seleccionar —</option>' + allUsers.map(u => `<option value="${u.uid}">${u.username}</option>`).join('');
  const allWithAdmin = [{ uid: currentUID, username: ADMIN }, ...allUsers];
  ['copyFrom','copyTo','moveUserSelect','routineUserSelect'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = allWithAdmin.map(u => `<option value="${u.uid}">${u.username}</option>`).join('');
  });
}

window.filterUsers = () => {
  const q     = (document.getElementById('userSearch')?.value || '').toLowerCase();
  const panel = document.getElementById('usersPanel');
  const filtered = allUsers.filter(u => u.username.toLowerCase().includes(q));
  const masc  = filtered.filter(u => u.gender === 'Masculino');
  const fem   = filtered.filter(u => u.gender === 'Femenino');
  const otros = filtered.filter(u => !u.gender);

  const renderGroup = (title, users) => users.length ? `
    <div class="user-group">
      <div class="user-group-title">${title} <span class="user-group-count">${users.length}</span></div>
      ${users.map(u => `<div class="user-row">
        <div class="user-row-info">
          <span class="user-row-name">${u.username}</span>
          ${u.level ? `<span class="user-tag">${u.level}</span>` : ''}
          ${(u.goals||[]).slice(0,2).map(g => `<span class="user-tag">${g}</span>`).join('')}
        </div>
      </div>`).join('')}
    </div>` : '';

  panel.innerHTML = renderGroup('Masculino', masc) + renderGroup('Femenino', fem) + renderGroup('Sin clasificar', otros);
  if (!filtered.length) panel.innerHTML = '<p class="text-muted">No se encontraron usuarios.</p>';
};

window.adminLoadUser = async () => {
  const uid   = document.getElementById('adminViewUser').value;
  const panel = document.getElementById('adminUserPanel');
  if (!uid) { panel.innerHTML = ''; return; }
  const snap  = await getDoc(doc(db, 'usuarios', uid));
  if (!snap.exists()) { panel.innerHTML = '<p class="text-muted">Sin datos.</p>'; return; }
  const d     = snap.data();
  const uname = d.username || uid;
  panel.innerHTML = `
    <div class="admin-user-header">
      <div>
        <span class="admin-user-name">${uname}</span>
        ${d.gender ? `<span class="user-tag">${d.gender}</span>` : ''}
        ${d.level  ? `<span class="user-tag">${d.level}</span>` : ''}
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn-sm" onclick="adminOpenExercise('${uid}')">+ Ejercicio</button>
        <button class="btn-sm" onclick="openMealModal('${currentDietDay}','${uid}')">+ Comida</button>
        <button class="btn-sm" onclick="openSaveRoutineModal()">Guardar rutina</button>
      </div>
    </div>
    <div class="subtabs" style="margin-bottom:16px">
      ${DAYS.map(day => {
        const count = (d.exercises||[]).filter(e => e.day === day).length;
        return `<button class="stab" onclick="adminShowDay('${day}','${uid}')">${day}${count?` (${count})`:''}</button>`;
      }).join('')}
      <button class="stab" onclick="adminShowDiet('${uid}')">Dieta</button>
    </div>
    <div id="adminExList"></div>`;
};

window.adminShowDay = (day, uid) => {
  currentDay = day;
  getDoc(doc(db, 'usuarios', uid)).then(snap => {
    const exs  = (snap.data()?.exercises || []).filter(e => e.day === day);
    const list = document.getElementById('adminExList');
    if (!exs.length) { list.innerHTML = `<p class="text-muted">Sin ejercicios para ${day}.</p>`; return; }
    list.innerHTML = `<div class="exercise-grid">${exs.map((ex,i) => buildCard(ex,i,exs.length,uid)).join('')}</div>`;
  });
};

window.adminShowDiet = async (uid) => {
  const snap = await getDoc(doc(db, 'usuarios', uid));
  const mls  = snap.data()?.meals || [];
  const list = document.getElementById('adminExList');
  const savedTarget = currentDietDay;
  list.innerHTML = `
    <div class="subtabs" style="margin-bottom:12px">
      ${DAYS.map(d => `<button class="stab${d===savedTarget?' active':''}" onclick="currentDietDay='${d}';adminShowDiet('${uid}')">${d}</button>`).join('')}
    </div>
    <div id="adminDietContent"></div>`;
  // Render diet for this user
  const dayM = mls.filter(m => m.day === currentDietDay);
  const cont = document.getElementById('adminDietContent');
  if (!dayM.length) { cont.innerHTML = `<p class="text-muted">Sin comidas para ${currentDietDay}.</p>`; return; }
  let html = '';
  MEAL_TIMES.forEach(time => {
    const tm = dayM.filter(m => m.time === time); if (!tm.length) return;
    html += `<div class="meal-section"><div class="meal-section-header"><span class="meal-section-title">${time}</span></div>
      ${tm.map(m => `<div class="meal-item">
        <div class="meal-item-body"><div class="meal-item-name">${m.name}${m.qty?` <span class="meal-qty">${m.qty}</span>`:''}</div></div>
        <div class="meal-item-actions">
          <button class="btn-icon-sm" onclick="editMeal('${m.id}','${uid}')">✎</button>
          <button class="btn-icon-sm danger" onclick="deleteMeal('${m.id}','${uid}')">✕</button>
        </div>
      </div>`).join('')}
    </div>`;
  });
  cont.innerHTML = html;
};

window.adminOpenExercise = (uid) => {
  document.getElementById('fTargetUser').value = uid;
  document.getElementById('fEditId').value = '';
  document.getElementById('exerciseModalTitle').textContent = 'Nuevo ejercicio';
  document.getElementById('overlay').classList.add('open');
};

window.deleteSelectedUser = async () => {
  const uid   = document.getElementById('adminViewUser').value;
  if (!uid) { alert('Selecciona un usuario primero.'); return; }
  const snap  = await getDoc(doc(db, 'usuarios', uid));
  const uname = snap.data()?.username || uid;
  if (!confirm(`¿Eliminar al usuario "${uname}" y todos sus datos? Esta acción no se puede deshacer.`)) return;

  // Eliminar datos de Firestore
  await deleteDoc(doc(db, 'usuarios', uid));
  if (snap.data()?.username) {
    try { await deleteDoc(doc(db, 'usernames', snap.data().username)); } catch(e) {}
  }
  alert(`Usuario "${uname}" eliminado correctamente.`);
  document.getElementById('adminUserPanel').innerHTML = '';
  await renderAdmin();
};

/* ══════════════════════════════════════════
   COPIAR RUTINA
══════════════════════════════════════════ */
window.openCopyRoutine  = async () => { await renderAdmin(); document.getElementById('copyOverlay').classList.add('open'); };
window.closeCopyRoutine = () => document.getElementById('copyOverlay').classList.remove('open');
window.executeCopyRoutine = async () => {
  const from = document.getElementById('copyFrom').value;
  const to   = document.getElementById('copyTo').value;
  if (!from || !to || from === to) { alert('Selecciona usuarios distintos.'); return; }
  const snapF = await getDoc(doc(db, 'usuarios', from));
  const snapT = await getDoc(doc(db, 'usuarios', to));
  if (!snapF.exists()) { alert('Usuario origen no encontrado.'); return; }
  const fromEx = (snapF.data().exercises || []).map(e => ({ ...e, id: Date.now().toString() + Math.random().toString(36).slice(2) }));
  const toData = snapT.exists() ? snapT.data() : { exercises:[], doneSet:[], meals:[], bodyData:[], medidasData:[] };
  toData.exercises = [...(toData.exercises||[]), ...fromEx];
  await saveUID(to, toData);
  closeCopyRoutine();
  alert('Rutina copiada correctamente.');
};

/* ══════════════════════════════════════════
   PROGRESO
══════════════════════════════════════════ */
function updateProgress() {
  const total = exercises.length;
  const done  = exercises.filter(e => doneSet.includes(e.id)).length;
  const pct   = total === 0 ? 0 : Math.round(done/total*100);
  document.getElementById('progressFill').style.width = pct + '%';
  document.getElementById('progressPct').textContent  = pct + '%';
}

/* ══════════════════════════════════════════
   UTILS
══════════════════════════════════════════ */
const today      = () => new Date().toISOString().split('T')[0];
const cap        = s  => s.charAt(0).toUpperCase() + s.slice(1);
const showErr    = (el, msg) => { el.textContent = msg; el.classList.remove('hidden'); };
const hideErr    = (el)      => el.classList.add('hidden');
const formatDate = (d) => {
  if (!d) return '—';
  const [y,m,day] = d.split('-');
  return `${parseInt(day)} ${['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'][parseInt(m)-1]} ${y}`;
};
const authMsg = (code) => ({
  'auth/email-already-in-use': 'Ese correo ya está registrado.',
  'auth/invalid-email':        'Correo inválido.',
  'auth/weak-password':        'La contraseña debe tener al menos 6 caracteres.',
  'auth/user-not-found':       'No existe una cuenta con ese correo.',
  'auth/wrong-password':       'Correo o contraseña incorrectos.',
  'auth/invalid-credential':   'Correo o contraseña incorrectos.',
  'auth/too-many-requests':    'Demasiados intentos. Espera unos minutos.',
}[code] || 'Error inesperado. Intenta de nuevo.');

function initApp() {
  document.getElementById('sectionTitle').textContent = currentDay.toUpperCase();
  renderDaysNav(); renderExercises(); updateProgress();
}

/* ══════════════════════════════════════════
   RESTAURAR SESIÓN
══════════════════════════════════════════ */
const savedSession = sessionStorage.getItem('fp_session');
if (savedSession) {
  const fixed = FIXED_USERS.find(u => u.username === savedSession);
  if (fixed) {
    currentUID  = fixed.username;
    currentUser = fixed.username;
    // Esperar a que el splash termine
    setTimeout(() => enterApp(fixed.username), 3100);
  }
}
