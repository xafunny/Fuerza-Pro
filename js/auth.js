/*
  Fuerza Pro — js/auth.js
  Autenticación con Firebase Auth.

  CAMBIOS DE SEGURIDAD respecto a la versión anterior:
  - Se ELIMINARON los usuarios con contraseña escrita en el código (jhoao/karen).
    Cualquiera podía leerlas viendo el código fuente en el navegador o en GitHub.
  - Se eliminó signInAnonymously (permitía saltarse la verificación).
  - La verificación de correo ahora es OBLIGATORIA para todos: nadie entra
    sin hacer clic en el enlace de verificación que llega a su correo.
  - Restablecer contraseña: Firebase envía un enlace de un solo uso al correo.
    Ese enlace ES el código de verificación (nadie puede cambiar la contraseña
    sin acceso al correo del dueño de la cuenta).
  - El rol de administrador ya no depende del nombre de usuario: se lee de
    Firestore (role:'admin') y las reglas del servidor lo protegen.
*/
import {
  createUserWithEmailAndPassword, signInWithEmailAndPassword,
  sendEmailVerification, sendPasswordResetEmail, signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";
import { auth, OWNER_EMAIL } from './firebase-config.js';
import { db, doc, getDoc, setDoc } from './db.js';
import { S, SESSION_KEY } from './state.js';
import { $, show, hide, authMsg } from './utils.js';

/* ── Cambio de pestaña login/registro/olvidé ── */
window.switchAuth = tab => {
  ['Login','Register','Forgot'].forEach(t =>
    $(`form${t}`).classList.toggle('hidden', t.toLowerCase() !== tab));
  $('atLogin').classList.toggle('active', tab==='login');
  $('atRegister').classList.toggle('active', tab==='register');
  $('resendWrap').classList.add('hidden');
};

/* ── Login ── */
window.handleLogin = async () => {
  const input = $('lEmail').value.trim().toLowerCase();
  const pass  = $('lPass').value;
  const err   = $('lErr');
  hide(err);
  if (!input || !pass) { show(err,'Completa todos los campos.'); return; }
  if (!input.includes('@')) { show(err,'Ingresa tu correo electrónico.'); return; }
  try {
    const cred = await signInWithEmailAndPassword(auth, input, pass);
    if (!cred.user.emailVerified) {
      await signOut(auth);
      show(err,'Verifica tu correo antes de entrar. Revisa tu bandeja de entrada (y spam).');
      $('resendWrap').classList.remove('hidden');
      $('resendWrap').dataset.email = input;
      $('resendWrap').dataset.pass  = pass;
      return;
    }
    /* onAuthStateChanged se encarga del resto */
  } catch(e) { show(err, authMsg(e.code)); }
};

window.resendVerification = async () => {
  const email = $('resendWrap').dataset.email;
  const pass  = $('resendWrap').dataset.pass || $('lPass').value;
  try {
    const c = await signInWithEmailAndPassword(auth, email, pass);
    await sendEmailVerification(c.user);
    await signOut(auth);
    $('resendWrap').innerHTML = '<span style="color:#22c55e;font-size:.82rem">Correo reenviado. Revisa tu bandeja.</span>';
  } catch(e) { alert('No se pudo reenviar. Verifica tu contraseña.'); }
};

/* ── Registro (con verificación de correo obligatoria) ── */
window.handleRegister = async () => {
  const username = $('rUser').value.trim().toLowerCase();
  const email    = $('rEmail').value.trim().toLowerCase();
  const pass     = $('rPass').value;
  const pass2    = $('rPass2').value;
  const err      = $('rErr');
  hide(err);
  if (!username || !email || !pass) { show(err,'Completa todos los campos.'); return; }
  if (!/^[a-z0-9_]{3,20}$/.test(username)) { show(err,'Usuario: 3-20 caracteres, solo minúsculas, números y _.'); return; }
  if (pass.length < 6) { show(err,'La contraseña debe tener al menos 6 caracteres.'); return; }
  if (pass !== pass2)  { show(err,'Las contraseñas no coinciden.'); return; }
  const snapU = await getDoc(doc(db,'usernames',username));
  if (snapU.exists()) { show(err,'Ese nombre de usuario ya está en uso.'); return; }
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, pass);
    /* Solo el uid: esta colección es legible sin sesión (para comprobar
       disponibilidad), así que no debe contener correos */
    await setDoc(doc(db,'usernames',username), { uid: cred.user.uid });
    await setDoc(doc(db,'usuarios',cred.user.uid), {
      username, email, role:'user',
      exercises:[], doneSet:[], meals:[], bodyData:[], medidasData:[],
      needsOnboarding: true, creadoEn: new Date().toISOString()
    });
    await sendEmailVerification(cred.user);
    await signOut(auth); /* no entra hasta verificar */
    $('verifyOk').classList.remove('hidden');
    ['rUser','rEmail','rPass','rPass2'].forEach(id => $(id).value = '');
  } catch(e) { show(err, authMsg(e.code)); }
};

/* ── Restablecer contraseña ──
   El enlace que llega al correo es de un solo uso y caduca:
   funciona como código de verificación. */
window.handleForgot = async () => {
  const email = $('fEmail').value.trim().toLowerCase();
  const err = $('fErr'), ok = $('fOk');
  hide(err); ok.classList.add('hidden');
  if (!email) { show(err,'Ingresa tu correo.'); return; }
  try { await sendPasswordResetEmail(auth, email); ok.classList.remove('hidden'); }
  catch(e) { show(err, authMsg(e.code)); }
};

/* ── Logout ── */
window.handleLogout = async () => {
  document.dispatchEvent(new CustomEvent('fp:logout'));
  localStorage.removeItem(SESSION_KEY);
  try { await signOut(auth); } catch(e) {}
  $('appScreen').classList.add('hidden');
  $('onboardScreen').classList.add('hidden');
  $('loginScreen').classList.remove('hidden');
  window.switchAuth('login');
};

/* ── Estado de sesión ──
   Único punto de entrada a la app: exige sesión real y correo verificado. */
onAuthStateChanged(auth, async user => {
  if (!user) {
    $('loginScreen')?.classList.remove('hidden');
    return;
  }
  if (!user.emailVerified) { await signOut(auth); return; }

  /* Usuarios bloqueados/eliminados por el admin no pueden volver a entrar */
  const email = (user.email || '').toLowerCase();
  try {
    const blq = await getDoc(doc(db,'bloqueados', email.replaceAll('/','_')));
    if (blq.exists()) {
      await signOut(auth);
      alert('Tu cuenta fue desactivada por el administrador.');
      return;
    }
  } catch(e) { /* sin permiso de lectura => no bloqueado */ }

  S.UID = user.uid;
  S.EMAIL = email;
  let snap = await getDoc(doc(db,'usuarios',user.uid));
  let data = snap.exists() ? snap.data() : null;
  if (!data) {
    data = {
      username: email.split('@')[0], email, role:'user',
      exercises:[], doneSet:[], meals:[], bodyData:[], medidasData:[],
      needsOnboarding: true, creadoEn: new Date().toISOString()
    };
    await setDoc(doc(db,'usuarios',user.uid), data);
  }
  S.USERNAME = data.username || email.split('@')[0];
  S.isAdmin  = data.role === 'admin' || email === OWNER_EMAIL;
  localStorage.setItem(SESSION_KEY, user.uid);

  /* Onboarding obligatorio: también para cuentas antiguas
     a las que les falten datos (sexo, fecha de nacimiento o teléfono). */
  const faltanDatos = !data.gender || !data.fechaNac || !data.telefono;
  if (data.needsOnboarding || faltanDatos) {
    $('loginScreen').classList.add('hidden');
    $('appScreen').classList.add('hidden');
    document.dispatchEvent(new CustomEvent('fp:onboarding', { detail:{ data } }));
    return;
  }
  document.dispatchEvent(new CustomEvent('fp:login'));
});
