/*
  Fuerza Pro — js/main.js
  Punto de entrada: importa todos los módulos, maneja el splash, las pestañas
  y la sincronización en tiempo real con Firestore.

  ARREGLO del reset dominical: antes CADA navegador abierto intentaba
  resetear los ejercicios de TODOS los usuarios (setTimeout global), lo que
  causaba escrituras cruzadas y fallos de permisos. Ahora cada usuario
  resetea solo su propia semana la primera vez que abre la app cada semana
  (guardando la semana del último reset en su propio documento).
*/
import './auth.js';
import './onboarding.js';
import './exercises.js';
import './routine-parser.js';
import './routines.js';
import './diet.js';
import './progress.js';
import './photos.js';
import './profile.js';
import './cycle.js';
import './groups.js';
import './ai.js';
import './admin.js';

import { onSnapshot } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";
import { S, DAYS } from './state.js';
import { $, cap } from './utils.js';
import { db, doc, save } from './db.js';
import { renderDaysNav, renderExercises, updateWeekBar, loadExLibrary } from './exercises.js';
import { renderDietNav } from './diet.js';
import { renderCycle, renderCycleHistory } from './cycle.js';
import { loadProfileFields, renderProfile, updateHeaderAvatar } from './profile.js';
import { renderAdmin } from './admin.js';

/* ── Splash ── */
window.addEventListener('load', () => {
  document.addEventListener('keydown', e => {
    if (e.key !== 'Enter') return;
    const ls = $('loginScreen');
    if (ls && !ls.classList.contains('hidden')) {
      if (!$('formLogin').classList.contains('hidden')) window.handleLogin();
      else if (!$('formRegister').classList.contains('hidden')) window.handleRegister();
      else if (!$('formForgot').classList.contains('hidden')) window.handleForgot();
    }
  });
  setTimeout(() => {
    const s = $('splashScreen');
    s.classList.add('splash-out');
    setTimeout(() => { s.style.display = 'none'; }, 500);
  }, 2000);
});

/* ── Mostrar / ocultar contraseña ── */
window.togglePass = (inputId, btn) => {
  const input = $(inputId);
  if (!input) return;
  const show = input.type === 'password';
  input.type = show ? 'text' : 'password';
  btn.textContent = show ? '🙈' : '👁';
};

/* ── Overlay: cerrar al hacer clic fuera ── */
window.handleOvClick = (e, ovId, closeFn) => { if (e.target === $(ovId)) window[closeFn](); };

/* ── Entrar a la app (evento disparado por auth.js) ── */
document.addEventListener('fp:login', () => {
  $('loginScreen').classList.add('hidden');
  $('onboardScreen').classList.add('hidden');
  $('appScreen').classList.remove('hidden');
  $('headerName').textContent = S.USERNAME;
  document.querySelectorAll('.admin-only').forEach(el => el.classList.toggle('hidden', !S.isAdmin));
  const dayIdx = new Date().getDay();
  S.currentDay = DAYS[dayIdx===0?6:dayIdx-1];
  S.currentDietDay = S.currentDay;
  startListening();
  startCycleListener();
  loadExLibrary();
  window.switchTab('rutina');
});

document.addEventListener('fp:logout', () => {
  resetChecked = false;
  if (S.unsubUser)  { S.unsubUser();  S.unsubUser = null; }
  if (S.unsubCycle) { S.unsubCycle(); S.unsubCycle = null; }
  if (S.chartInst)    { S.chartInst.destroy();    S.chartInst = null; }
  if (S.medChartInst) { S.medChartInst.destroy(); S.medChartInst = null; }
  Object.assign(S, { UID:null, USERNAME:null, EMAIL:null, isAdmin:false,
    exercises:[], doneSet:[], meals:[], bodyData:[], medidasData:[], cycle:null });
});

/* ── Firestore en tiempo real ── */
function startListening() {
  if (S.unsubUser) S.unsubUser();
  S.unsubUser = onSnapshot(doc(db,'usuarios',S.UID), snap => {
    if (snap.exists()) {
      const d = snap.data();
      S.exercises   = d.exercises   || [];
      S.doneSet     = d.doneSet     || [];
      S.meals       = d.meals       || [];
      S.bodyData    = d.bodyData    || [];
      S.medidasData = d.medidasData || [];
      S.isAdmin     = d.role === 'admin' || S.isAdmin;
      loadProfileFields(d);
      updateHeaderAvatar(d.avatarB64||d.avatarUrl||'', d.nombre||S.USERNAME);
      checkAutoReset(d);
    }
    initApp();
  });
}

function startCycleListener() {
  if (S.unsubCycle) S.unsubCycle();
  S.unsubCycle = onSnapshot(doc(db,'config','ciclo'), snap => {
    S.cycle = snap.exists() ? snap.data() : null;
    if (!$('panelCiclo').classList.contains('hidden')) renderCycle();
  });
}

/* ── Reset semanal POR USUARIO ──
   Cada lunes (nueva semana ISO), la primera vez que el usuario abre la app,
   se desmarcan SUS ejercicios completados. Los pesos nunca se tocan. */
let resetChecked = false;
function checkAutoReset(d) {
  if (resetChecked) return;
  resetChecked = true;
  const now = new Date();
  const weekId = `${now.getFullYear()}-W${getWeekNumber(now)}`;
  if (d.lastReset === weekId) return;
  const update = { lastReset: weekId };
  if ((d.doneSet||[]).length > 0) { update.doneSet = []; S.doneSet = []; }
  save(update);
}

function getWeekNumber(dt) {
  const date = new Date(Date.UTC(dt.getFullYear(), dt.getMonth(), dt.getDate()));
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay()||7));
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(),0,1));
  return Math.ceil((((date - yearStart)/86400000)+1)/7);
}

function initApp() {
  $('dayTitle').textContent = S.currentDay.toUpperCase();
  renderDaysNav(); renderExercises(); updateWeekBar();
}

/* ── Pestañas ── */
window.switchTab = tab => {
  ['rutina','dieta','progreso','ciclo','perfil','admin'].forEach(t => {
    $(`panel${cap(t)}`)?.classList.toggle('hidden', t !== tab);
    $(`tab${cap(t)}`)?.classList.toggle('active', t === tab);
  });
  $('btnAdd').style.display       = tab==='rutina' ? '' : 'none';
  $('btnResetWeek').style.display = tab==='rutina' ? '' : 'none';
  const bm = $('btnMeal');
  if (bm) bm.style.display = (tab==='dieta' && S.isAdmin) ? '' : 'none';
  if (tab==='progreso') window.switchProg('comp');
  if (tab==='ciclo')    { renderCycle(); renderCycleHistory(); }
  if (tab==='admin')    renderAdmin();
  if (tab==='dieta')    renderDietNav();
  if (tab==='perfil')   renderProfile();
};
