/* =============================================
   FUERZA PRO — Lógica de la aplicación
   Archivo: app.js

   SECCIONES:
   1. Usuarios y configuración
   2. Login / Logout
   3. Renderizado de días
   4. Renderizado de ejercicios
   5. Acciones (completar, eliminar)
   6. Progreso semanal
   7. Modal (abrir, cerrar)
   8. Vista previa del GIF
   9. Guardar ejercicio
   10. Inicio de la app
============================================= */


/* =============================================
   1. USUARIOS Y CONFIGURACIÓN
   ─────────────────────────────────────────────
   Para cambiar usuarios o contraseñas,
   edita solo este bloque.
============================================= */

// Lista de usuarios permitidos
// Para agregar más: { username: 'nombre', password: 'clave' }
const USERS = [
  { username: 'jhoao',  password: 'jhoao'  },
  { username: 'karen',  password: 'karen'  },
];

// Días de la semana
const DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

// Usuario que está logueado actualmente (null = nadie)
let currentUser = null;

// Día seleccionado en la app
let currentDay = DAYS[0];

// Ejercicios y completados del usuario activo
// (se cargan al hacer login, son distintos por usuario)
let exercises = [];
let doneSet   = [];


/* =============================================
   2. LOGIN / LOGOUT
============================================= */

// Genera las claves de localStorage usando el nombre del usuario
// Así cada usuario tiene sus propios datos separados
// Ej: "fuerzapro_jhoao_exercises" y "fuerzapro_karen_exercises"
function storageKey(type) {
  return `fuerzapro_${currentUser}_${type}`;
}

// Intenta hacer login con los valores del formulario
function handleLogin() {
  const userInput = document.getElementById('loginUser').value.trim().toLowerCase();
  const passInput = document.getElementById('loginPass').value.trim();
  const errorEl   = document.getElementById('loginError');

  // Busca el usuario en la lista
  const found = USERS.find(
    u => u.username.toLowerCase() === userInput && u.password === passInput
  );

  if (!found) {
    // Credenciales incorrectas — muestra el error
    errorEl.style.display = 'block';
    document.getElementById('loginPass').value = '';
    return;
  }

  // Login correcto
  errorEl.style.display = 'none';
  currentUser = found.username;

  // Guarda la sesión para que no se pierda al recargar
  sessionStorage.setItem('fuerzapro_session', currentUser);

  // Carga los datos del usuario
  loadUserData();

  // Muestra la app y oculta el login
  document.getElementById('loginScreen').classList.add('hidden');
  document.getElementById('appScreen').classList.remove('hidden');

  // Muestra el nombre del usuario en el header
  document.getElementById('userBadge').textContent = `👤 ${currentUser}`;

  // Limpia el formulario de login
  document.getElementById('loginUser').value = '';
  document.getElementById('loginPass').value = '';

  // Renderiza la app
  initApp();
}

// Cierra la sesión y vuelve al login
function handleLogout() {
  // Guarda los datos antes de salir
  saveExercises();

  // Limpia el estado en memoria
  currentUser = null;
  exercises   = [];
  doneSet     = [];
  currentDay  = DAYS[0];

  // Elimina la sesión guardada
  sessionStorage.removeItem('fuerzapro_session');

  // Muestra el login y oculta la app
  document.getElementById('appScreen').classList.add('hidden');
  document.getElementById('loginScreen').classList.remove('hidden');
}

// Carga los ejercicios y completados del usuario activo desde localStorage
function loadUserData() {
  exercises = JSON.parse(localStorage.getItem(storageKey('exercises')) || '[]');
  doneSet   = JSON.parse(localStorage.getItem(storageKey('done'))      || '[]');
}

// Guarda los ejercicios del usuario activo en localStorage
function saveExercises() {
  localStorage.setItem(storageKey('exercises'), JSON.stringify(exercises));
}


/* =============================================
   3. RENDERIZADO DE DÍAS
============================================= */

function renderDaysNav() {
  const nav = document.getElementById('daysNav');

  nav.innerHTML = DAYS.map(day => {
    const count    = exercises.filter(e => e.day === day).length;
    const badge    = count > 0 ? `<span class="count">${count}</span>` : '';
    const isActive = day === currentDay ? ' active' : '';

    return `<button class="day-pill${isActive}" onclick="selectDay('${day}')">${day}${badge}</button>`;
  }).join('');
}

function selectDay(day) {
  currentDay = day;
  document.getElementById('sectionTitle').innerHTML = day.toUpperCase();
  renderDaysNav();
  renderExercises();
}


/* =============================================
   4. RENDERIZADO DE EJERCICIOS
============================================= */

function renderExercises() {
  const list        = document.getElementById('exercisesList');
  const dayExercises = exercises.filter(e => e.day === currentDay);

  if (dayExercises.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="icon">🏋️</div>
        <p>No hay ejercicios para <strong>${currentDay}</strong> todavía.</p>
        <button onclick="openModal('${currentDay}')">+ Agregar ejercicio</button>
      </div>
    `;
    return;
  }

  list.innerHTML = `
    <div class="exercises-grid">
      ${dayExercises.map(ex => buildCard(ex)).join('')}
    </div>
  `;
}

function buildCard(ex) {
  const isDone = doneSet.includes(ex.id);

  const gifSection = ex.gif
    ? `<div class="card-gif">
         <img src="${ex.gif}" alt="${ex.name}" loading="lazy"
           onerror="this.parentElement.innerHTML='<span class=\\'placeholder\\'>🏋️</span>'" />
       </div>`
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
    </div>
  `;
}


/* =============================================
   5. ACCIONES — Completar y eliminar
============================================= */

function toggleDone(id) {
  if (doneSet.includes(id)) {
    doneSet = doneSet.filter(d => d !== id);
  } else {
    doneSet.push(id);
  }
  localStorage.setItem(storageKey('done'), JSON.stringify(doneSet));
  renderExercises();
  updateProgress();
}

function deleteExercise(id) {
  if (!confirm('¿Eliminar este ejercicio?')) return;
  exercises = exercises.filter(e => e.id !== id);
  doneSet   = doneSet.filter(d => d !== id);
  saveExercises();
  renderDaysNav();
  renderExercises();
  updateProgress();
}


/* =============================================
   6. PROGRESO SEMANAL
============================================= */

function updateProgress() {
  const total = exercises.length;
  const done  = exercises.filter(e => doneSet.includes(e.id)).length;
  const pct   = total === 0 ? 0 : Math.round((done / total) * 100);

  document.getElementById('progressFill').style.width = pct + '%';
  document.getElementById('progressPct').textContent  = pct + '%';
}


/* =============================================
   7. MODAL — Abrir y cerrar
============================================= */

function openModal(day) {
  document.getElementById('fDay').value = day || currentDay;
  document.getElementById('overlay').classList.add('open');
}

function closeModal() {
  document.getElementById('overlay').classList.remove('open');
  resetForm();
}

function handleOverlayClick(e) {
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


/* =============================================
   8. VISTA PREVIA DEL GIF
============================================= */

function previewGif() {
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


/* =============================================
   9. GUARDAR EJERCICIO
============================================= */

function saveExercise() {
  const name = document.getElementById('fName').value.trim();
  const day  = document.getElementById('fDay').value;

  if (!name) {
    alert('Por favor ingresa el nombre del ejercicio');
    return;
  }

  const newExercise = {
    id:     Date.now().toString(),
    name,
    day,
    sets:   document.getElementById('fSets').value,
    reps:   document.getElementById('fReps').value,
    rest:   document.getElementById('fRest').value,
    muscle: document.getElementById('fMuscle').value,
    gif:    document.getElementById('fGif').value.trim(),
    notes:  document.getElementById('fNotes').value.trim(),
  };

  exercises.push(newExercise);
  saveExercises();
  closeModal();

  currentDay = day;
  renderDaysNav();
  renderExercises();
  updateProgress();
}


/* =============================================
   10. INICIO DE LA APP
============================================= */

// Renderiza la navegación y ejercicios (después del login)
function initApp() {
  currentDay = DAYS[0];
  document.getElementById('sectionTitle').innerHTML = currentDay.toUpperCase();
  renderDaysNav();
  renderExercises();
  updateProgress();
}

// Al cargar la página, revisa si ya había una sesión activa
// (por si el usuario recargó sin cerrar sesión)
function checkSession() {
  const savedUser = sessionStorage.getItem('fuerzapro_session');

  if (savedUser && USERS.find(u => u.username === savedUser)) {
    // Sesión válida — entra directo a la app
    currentUser = savedUser;
    loadUserData();

    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('appScreen').classList.remove('hidden');
    document.getElementById('userBadge').textContent = `👤 ${currentUser}`;

    initApp();
  }
  // Si no hay sesión, se queda en el login (estado por defecto)
}

// Permite hacer login presionando Enter en el formulario
document.getElementById('loginPass').addEventListener('keydown', function(e) {
  if (e.key === 'Enter') handleLogin();
});
document.getElementById('loginUser').addEventListener('keydown', function(e) {
  if (e.key === 'Enter') handleLogin();
});

// Arranca
checkSession();
