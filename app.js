/* =============================================
   FUERZA PRO — app.js
   Conectado a Firebase Firestore
   Los datos se sincronizan entre todos los
   dispositivos en tiempo real.
============================================= */

// =============================================
// FIREBASE — Credenciales de tu proyecto
// Si cambias de proyecto, actualiza estos valores
// =============================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey:            "AIzaSyALUv_MuDpzol8ArgD9gOw8gIYruy1bRog",
  authDomain:        "fuerzapro-e9d6f.firebaseapp.com",
  projectId:         "fuerzapro-e9d6f",
  storageBucket:     "fuerzapro-e9d6f.firebasestorage.app",
  messagingSenderId: "589184423001",
  appId:             "1:589184423001:web:e3088e42caebea8d9bcd48"
};

const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);


// =============================================
// USUARIOS — Para cambiar contraseñas edita aquí
// =============================================
const USERS = [
  { username: 'jhoao', password: 'jhoao' },
  { username: 'karen', password: 'karen' },
];

const DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

let currentUser = null;
let currentDay  = DAYS[0];
let exercises   = [];
let doneSet     = [];
let unsubscribe = null; // para detener el listener de Firestore al cerrar sesión


// =============================================
// LOGIN / LOGOUT
// =============================================

window.handleLogin = function() {
  const userInput = document.getElementById('loginUser').value.trim().toLowerCase();
  const passInput = document.getElementById('loginPass').value.trim();
  const errorEl   = document.getElementById('loginError');

  const found = USERS.find(
    u => u.username.toLowerCase() === userInput && u.password === passInput
  );

  if (!found) {
    errorEl.style.display = 'block';
    document.getElementById('loginPass').value = '';
    return;
  }

  errorEl.style.display = 'none';
  currentUser = found.username;
  sessionStorage.setItem('fuerzapro_session', currentUser);

  document.getElementById('loginScreen').classList.add('hidden');
  document.getElementById('appScreen').classList.remove('hidden');
  document.getElementById('userBadge').textContent = `👤 ${currentUser}`;
  document.getElementById('loginUser').value = '';
  document.getElementById('loginPass').value = '';

  startListening(); // conecta a Firestore y escucha cambios en tiempo real
}

window.handleLogout = function() {
  if (unsubscribe) unsubscribe(); // detiene el listener
  currentUser = null;
  exercises   = [];
  doneSet     = [];
  currentDay  = DAYS[0];
  sessionStorage.removeItem('fuerzapro_session');

  document.getElementById('appScreen').classList.add('hidden');
  document.getElementById('loginScreen').classList.remove('hidden');
}


// =============================================
// FIRESTORE — Escuchar cambios en tiempo real
// Cada vez que se guarda algo en la nube,
// la app se actualiza automáticamente
// =============================================

function startListening() {
  const docRef = doc(db, 'usuarios', currentUser);

  // onSnapshot se ejecuta cada vez que los datos cambian en Firebase
  unsubscribe = onSnapshot(docRef, (snapshot) => {
    if (snapshot.exists()) {
      const data = snapshot.data();
      exercises = data.exercises || [];
      doneSet   = data.doneSet   || [];
    } else {
      exercises = [];
      doneSet   = [];
    }
    initApp();
  });
}

// Guarda todos los datos del usuario en Firestore
async function saveToFirebase() {
  try {
    const docRef = doc(db, 'usuarios', currentUser);
    await setDoc(docRef, { exercises, doneSet });
  } catch (e) {
    console.error('Error al guardar:', e);
    alert('Error al guardar. Revisa tu conexión a internet.');
  }
}


// =============================================
// RENDERIZADO DE DÍAS
// =============================================

function renderDaysNav() {
  const nav = document.getElementById('daysNav');
  nav.innerHTML = DAYS.map(day => {
    const count    = exercises.filter(e => e.day === day).length;
    const badge    = count > 0 ? `<span class="count">${count}</span>` : '';
    const isActive = day === currentDay ? ' active' : '';
    return `<button class="day-pill${isActive}" onclick="selectDay('${day}')">${day}${badge}</button>`;
  }).join('');
}

window.selectDay = function(day) {
  currentDay = day;
  document.getElementById('sectionTitle').innerHTML = day.toUpperCase();
  renderDaysNav();
  renderExercises();
}


// =============================================
// RENDERIZADO DE EJERCICIOS
// =============================================

function renderExercises() {
  const list         = document.getElementById('exercisesList');
  const dayExercises = exercises.filter(e => e.day === currentDay);

  if (dayExercises.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="icon">🏋️</div>
        <p>No hay ejercicios para <strong>${currentDay}</strong> todavía.</p>
        <button onclick="openModal('${currentDay}')">+ Agregar ejercicio</button>
      </div>`;
    return;
  }

  list.innerHTML = `<div class="exercises-grid">${dayExercises.map(ex => buildCard(ex)).join('')}</div>`;
}

function buildCard(ex) {
  const isDone = doneSet.includes(ex.id);

  const gifSection = ex.gif
    ? `<div class="card-gif"><img src="${ex.gif}" alt="${ex.name}" loading="lazy"
         onerror="this.parentElement.innerHTML='<span class=\\'placeholder\\'>🏋️</span>'" /></div>`
    : `<div class="card-gif"><span class="placeholder">🏋️</span></div>`;

  const muscle = ex.muscle ? `<span class="muscle-group">${ex.muscle}</span><br>` : '';
  const sets   = ex.sets   ? `<span class="badge badge-sets">${ex.sets} series</span>` : '';
  const reps   = ex.reps   ? `<span class="badge badge-reps">${ex.reps} reps</span>`   : '';
  const rest   = ex.rest   ? `<span class="badge badge-rest">⏱ ${ex.rest}</span>`      : '';
  const notes  = ex.notes  ? `<div class="card-notes">${ex.notes}</div>`               : '';

  return `
    <div class="exercise-card" id="card-${ex.id}">
      ${gifSection}
      <div class="card-body">
        ${muscle}
        <div class="card-name">${ex.name}</div>
        <div class="card-meta">${sets}${reps}${rest}</div>
        ${notes}
      </div>
      <div class="card-actions">
        <button class="btn-done${isDone ? ' done' : ''}" onclick="toggleDone('${ex.id}')">
          ${isDone ? '✓ Completado' : 'Marcar hecho'}
        </button>
        <button class="btn-delete" onclick="deleteExercise('${ex.id}')" title="Eliminar">🗑</button>
      </div>
    </div>`;
}


// =============================================
// ACCIONES
// =============================================

window.toggleDone = async function(id) {
  if (doneSet.includes(id)) {
    doneSet = doneSet.filter(d => d !== id);
  } else {
    doneSet.push(id);
  }
  await saveToFirebase();
}

window.deleteExercise = async function(id) {
  if (!confirm('¿Eliminar este ejercicio?')) return;
  exercises = exercises.filter(e => e.id !== id);
  doneSet   = doneSet.filter(d => d !== id);
  await saveToFirebase();
}


// =============================================
// PROGRESO SEMANAL
// =============================================

function updateProgress() {
  const total = exercises.length;
  const done  = exercises.filter(e => doneSet.includes(e.id)).length;
  const pct   = total === 0 ? 0 : Math.round((done / total) * 100);
  document.getElementById('progressFill').style.width = pct + '%';
  document.getElementById('progressPct').textContent  = pct + '%';
}


// =============================================
// MODAL
// =============================================

window.openModal = function(day) {
  document.getElementById('fDay').value = day || currentDay;
  document.getElementById('overlay').classList.add('open');
}

window.closeModal = function() {
  document.getElementById('overlay').classList.remove('open');
  resetForm();
}

window.handleOverlayClick = function(e) {
  if (e.target === document.getElementById('overlay')) closeModal();
}

function resetForm() {
  ['fName', 'fSets', 'fReps', 'fRest', 'fGif', 'fNotes'].forEach(id => {
    document.getElementById(id).value = '';
  });
  document.getElementById('fMuscle').value = '';
  const preview = document.getElementById('gifPreview');
  preview.innerHTML = '<span style="color:var(--muted);font-size:0.85rem;">Vista previa del GIF</span>';
  preview.classList.remove('has-img');
  document.getElementById('gifError').style.display = 'none';
}


// =============================================
// VISTA PREVIA DEL GIF
// =============================================

window.previewGif = function() {
  const url     = document.getElementById('fGif').value.trim();
  const preview = document.getElementById('gifPreview');
  const errMsg  = document.getElementById('gifError');

  errMsg.style.display = 'none';
  if (!url) {
    preview.classList.remove('has-img');
    preview.innerHTML = '<span style="color:var(--muted);font-size:0.85rem;">Vista previa del GIF</span>';
    return;
  }

  const img = new Image();
  img.src = url;
  img.onload  = () => { preview.innerHTML = ''; preview.appendChild(img); preview.classList.add('has-img'); };
  img.onerror = () => {
    errMsg.style.display = 'block';
    preview.classList.remove('has-img');
    preview.innerHTML = '<span style="color:var(--muted);font-size:0.85rem;">Vista previa del GIF</span>';
  };
}


// =============================================
// GUARDAR EJERCICIO
// =============================================

window.saveExercise = async function() {
  const name = document.getElementById('fName').value.trim();
  const day  = document.getElementById('fDay').value;

  if (!name) { alert('Por favor ingresa el nombre del ejercicio'); return; }

  const newExercise = {
    id:     Date.now().toString(),
    name, day,
    sets:   document.getElementById('fSets').value,
    reps:   document.getElementById('fReps').value,
    rest:   document.getElementById('fRest').value,
    muscle: document.getElementById('fMuscle').value,
    gif:    document.getElementById('fGif').value.trim(),
    notes:  document.getElementById('fNotes').value.trim(),
  };

  exercises.push(newExercise);
  await saveToFirebase();
  closeModal();
  currentDay = day;
  document.getElementById('sectionTitle').innerHTML = day.toUpperCase();
  renderDaysNav();
  renderExercises();
  updateProgress();
}


// =============================================
// INICIO DE LA APP
// =============================================

function initApp() {
  document.getElementById('sectionTitle').innerHTML = currentDay.toUpperCase();
  renderDaysNav();
  renderExercises();
  updateProgress();
}

// Permite hacer Enter para iniciar sesión
document.getElementById('loginPass').addEventListener('keydown', e => { if (e.key === 'Enter') handleLogin(); });
document.getElementById('loginUser').addEventListener('keydown', e => { if (e.key === 'Enter') handleLogin(); });

// Revisa si ya había sesión activa al recargar
const savedUser = sessionStorage.getItem('fuerzapro_session');
if (savedUser && USERS.find(u => u.username === savedUser)) {
  currentUser = savedUser;
  document.getElementById('loginScreen').classList.add('hidden');
  document.getElementById('appScreen').classList.remove('hidden');
  document.getElementById('userBadge').textContent = `👤 ${currentUser}`;
  startListening();
}
