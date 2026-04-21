/*
  Fuerza Pro — app.js
  Desarrollado por Jhoao Guala
*/
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js";
import {
  getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword,
  sendEmailVerification, sendPasswordResetEmail, signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";
import {
  getFirestore, doc, setDoc, getDoc, deleteDoc,
  onSnapshot, collection, getDocs
} from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";

const fbApp = initializeApp({
  apiKey:            "AIzaSyALUv_MuDpzol8ArgD9gOw8gIYruy1bRog",
  authDomain:        "fuerzapro-e9d6f.firebaseapp.com",
  projectId:         "fuerzapro-e9d6f",
  storageBucket:     "fuerzapro-e9d6f.firebasestorage.app",
  messagingSenderId: "589184423001",
  appId:             "1:589184423001:web:e3088e42caebea8d9bcd48"
});
const auth = getAuth(fbApp);
const db   = getFirestore(fbApp);

/* ── Credenciales fijas ── */
const FIXED = [
  { username:'jhoao', password:'Sxxafunny28', email:'jhoaoxavier2365335@gmail.com', isAdmin:true },
  { username:'karen', password:'karen', email:null }
];
const ADMIN = 'jhoao';
const SESSION_KEY = 'fp_uid';

const DAYS  = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'];
const MEALS = ['Desayuno','Almuerzo','Merienda','Cena'];
const MK = ['Cuello','Hombros','Pecho','Cintura','Abdomen','Cadera','BIzqR','BIzqC','BDerR','BDerC','AIzq','ADer','MIzq','MDer','PIzq','PDer'];
const ML = {Cuello:'Cuello',Hombros:'Hombros',Pecho:'Pecho',Cintura:'Cintura',Abdomen:'Abdomen',Cadera:'Cadera/Glúteos',BIzqR:'Brazo Izq. Relajado',BIzqC:'Brazo Izq. Contraído',BDerR:'Brazo Der. Relajado',BDerC:'Brazo Der. Contraído',AIzq:'Antebrazo Izq.',ADer:'Antebrazo Der.',MIzq:'Muslo Izq.',MDer:'Muslo Der.',PIzq:'Pantorrilla Izq.',PDer:'Pantorrilla Der.'};

/* ── Estado ── */
let UID = null, USERNAME = null;
let currentDay = DAYS[0], currentDietDay = DAYS[0];
let exercises=[], doneSet=[], meals=[], bodyData=[], medidasData=[];
let cycle=null, allUsers=[];
let chartInst=null, medChartInst=null;
let unsubUser=null, unsubCycle=null;
let editWeightId=null;
let bodyChartType='peso', medChartKey='Cuello';
let exLibrary = []; // biblioteca de ejercicios guardados

/* ══════════════════════════════
   SPLASH — 2.5s y desaparece
══════════════════════════════ */
window.addEventListener('load', () => {
  setTimeout(() => {
    const s = document.getElementById('splashScreen');
    s.classList.add('splash-out');
    setTimeout(() => {
      s.style.display = 'none';
      checkPersistedSession();
    }, 500);
  }, 2500);
});

/* ══════════════════════════════
   SESIÓN PERSISTENTE
   Guarda en localStorage para que
   no pida login al recargar
══════════════════════════════ */
function checkPersistedSession() {
  const saved = localStorage.getItem(SESSION_KEY);
  if (saved) {
    const fixed = FIXED.find(u => u.username === saved);
    if (fixed) { enterApp(fixed.username, fixed.username); return; }
    // Usuario Firebase Auth — onAuthStateChanged lo maneja
  } else {
    document.getElementById('loginScreen').classList.remove('hidden');
  }
}

onAuthStateChanged(auth, async user => {
  if (!user) {
    if (!localStorage.getItem(SESSION_KEY)) {
      document.getElementById('loginScreen').classList.remove('hidden');
    }
    return;
  }
  if (!user.emailVerified) return;
  const saved = localStorage.getItem(SESSION_KEY);
  if (saved && FIXED.find(u => u.username === saved)) return; // ya manejado
  UID = user.uid;
  const snap = await getDoc(doc(db,'usuarios',user.uid));
  const data = snap.exists() ? snap.data() : {};
  USERNAME = data.username || user.email.split('@')[0];
  localStorage.setItem(SESSION_KEY, user.uid);
  if (data.needsOnboarding) {
    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('onboardScreen').classList.remove('hidden');
    return;
  }
  enterApp(USERNAME, user.uid);
});

/* ══════════════════════════════
   AUTH TABS
══════════════════════════════ */
window.switchAuth = tab => {
  ['Login','Register','Forgot'].forEach(t => {
    document.getElementById(`form${t}`).classList.toggle('hidden', t.toLowerCase() !== tab);
  });
  document.getElementById('atLogin').classList.toggle('active', tab==='login');
  document.getElementById('atRegister').classList.toggle('active', tab==='register');
  document.getElementById('resendWrap').classList.add('hidden');
};

/* ══════════════════════════════
   LOGIN
══════════════════════════════ */
window.handleLogin = async () => {
  const input = document.getElementById('lEmail').value.trim().toLowerCase();
  const pass  = document.getElementById('lPass').value;
  const err   = document.getElementById('lErr');
  hide(err);

  if (!input || !pass) { show(err,'Completa todos los campos.'); return; }

  // Usuarios fijos — username o correo
  const fixed = FIXED.find(u =>
    (u.username.toLowerCase()===input || (u.email&&u.email.toLowerCase()===input)) && u.password===pass
  );
  if (fixed) {
    localStorage.setItem(SESSION_KEY, fixed.username);
    await ensureFixedUser(fixed);
    enterApp(fixed.username, fixed.username);
    return;
  }

  if (!input.includes('@')) { show(err,'Ingresa tu correo electrónico.'); return; }

  try {
    const cred = await signInWithEmailAndPassword(auth, input, pass);
    if (!cred.user.emailVerified) {
      await signOut(auth);
      show(err,'Verifica tu correo antes de entrar. Revisa tu bandeja de entrada.');
      document.getElementById('resendWrap').classList.remove('hidden');
      document.getElementById('resendWrap').dataset.email = input;
      return;
    }
    // onAuthStateChanged toma el control
  } catch(e) { show(err, authMsg(e.code)); }
};

async function ensureFixedUser(fixed) {
  const ref = doc(db,'usuarios',fixed.username);
  const s   = await getDoc(ref);
  if (!s.exists()) {
    await setDoc(ref,{username:fixed.username,exercises:[],doneSet:[],meals:[],bodyData:[],medidasData:[]});
  }
}

window.resendVerification = async () => {
  const email = document.getElementById('resendWrap').dataset.email;
  const pass  = document.getElementById('lPass').value;
  try {
    const c = await signInWithEmailAndPassword(auth, email, pass);
    await sendEmailVerification(c.user);
    await signOut(auth);
    document.getElementById('resendWrap').innerHTML = '<span style="color:#22c55e;font-size:0.82rem">Correo reenviado.</span>';
  } catch(e) { alert('No se pudo reenviar. Intenta de nuevo.'); }
};

/* ══════════════════════════════
   REGISTRO
══════════════════════════════ */
window.handleRegister = async () => {
  const username = document.getElementById('rUser').value.trim().toLowerCase();
  const email    = document.getElementById('rEmail').value.trim();
  const pass     = document.getElementById('rPass').value;
  const pass2    = document.getElementById('rPass2').value;
  const err      = document.getElementById('rErr');
  hide(err);

  if (!username||!email||!pass) { show(err,'Completa todos los campos.'); return; }
  if (!/^[a-z0-9_]+$/.test(username)) { show(err,'Usuario: solo letras minúsculas, números y _.'); return; }
  if (pass.length<6) { show(err,'La contraseña debe tener al menos 6 caracteres.'); return; }
  if (pass!==pass2)  { show(err,'Las contraseñas no coinciden.'); return; }
  if (FIXED.find(u=>u.username===username)) { show(err,'Ese nombre de usuario no está disponible.'); return; }

  const snapU = await getDoc(doc(db,'usernames',username));
  if (snapU.exists()) { show(err,'Ese nombre de usuario ya está en uso.'); return; }

  try {
    const cred = await createUserWithEmailAndPassword(auth, email, pass);
    await setDoc(doc(db,'usernames',username),{uid:cred.user.uid,email});
    await setDoc(doc(db,'usuarios',cred.user.uid),{
      username,email,exercises:[],doneSet:[],meals:[],bodyData:[],medidasData:[],needsOnboarding:true
    });
    await sendEmailVerification(cred.user);
    await signOut(auth);
    document.getElementById('verifyOk').classList.remove('hidden');
    ['rUser','rEmail','rPass','rPass2'].forEach(id=>document.getElementById(id).value='');
  } catch(e) { show(err,authMsg(e.code)); }
};

/* ══════════════════════════════
   RECUPERAR CONTRASEÑA
══════════════════════════════ */
window.handleForgot = async () => {
  const email = document.getElementById('fEmail').value.trim();
  const err   = document.getElementById('fErr');
  const ok    = document.getElementById('fOk');
  hide(err); ok.classList.add('hidden');
  if (!email) { show(err,'Ingresa tu correo.'); return; }
  try { await sendPasswordResetEmail(auth,email); ok.classList.remove('hidden'); }
  catch(e) { show(err,authMsg(e.code)); }
};

/* ══════════════════════════════
   LOGOUT — limpia sesión
══════════════════════════════ */
window.handleLogout = async () => {
  if (unsubUser)  unsubUser();
  if (unsubCycle) unsubCycle();
  if (chartInst)    { chartInst.destroy();    chartInst=null; }
  if (medChartInst) { medChartInst.destroy(); medChartInst=null; }
  UID=null; USERNAME=null;
  exercises=[]; doneSet=[]; meals=[]; bodyData=[]; medidasData=[]; cycle=null;
  localStorage.removeItem(SESSION_KEY);
  try { await signOut(auth); } catch(e) {}
  document.getElementById('appScreen').classList.add('hidden');
  document.getElementById('loginScreen').classList.remove('hidden');
  switchAuth('login');
};

/* ══════════════════════════════
   ONBOARDING
══════════════════════════════ */
window.ob1Next = () => {
  const gender = document.querySelector('input[name="obGender"]:checked')?.value;
  const level  = document.getElementById('obLevel').value;
  if (!gender||!level) { alert('Completa todos los campos.'); return; }
  document.getElementById('ob1').classList.add('hidden');
  document.getElementById('ob2').classList.remove('hidden');
};
window.toggleGoal = btn => btn.classList.toggle('active');
window.obFinish = async () => {
  const goals  = [...document.querySelectorAll('.goal-btn.active')].map(b=>b.dataset.val);
  const errEl  = document.getElementById('obErr');
  if (!goals.length) { errEl.classList.remove('hidden'); return; }
  errEl.classList.add('hidden');
  const gender = document.querySelector('input[name="obGender"]:checked')?.value;
  const level  = document.getElementById('obLevel').value;
  await setDoc(doc(db,'usuarios',UID),{gender,level,goals,needsOnboarding:false},{merge:true});
  document.getElementById('onboardScreen').classList.add('hidden');
  enterApp(USERNAME, UID);
};

/* ══════════════════════════════
   ENTER APP
══════════════════════════════ */
function enterApp(username, uid) {
  USERNAME = username; UID = uid;
  document.getElementById('loginScreen').classList.add('hidden');
  document.getElementById('onboardScreen').classList.add('hidden');
  document.getElementById('appScreen').classList.remove('hidden');
  document.getElementById('headerName').textContent = username;
  const isAdmin = username === ADMIN;
  document.querySelectorAll('.admin-only').forEach(el=>el.classList.toggle('hidden',!isAdmin));
  const dayIdx = new Date().getDay();
  currentDay     = DAYS[dayIdx===0?6:dayIdx-1];
  currentDietDay = currentDay;
  startListening();
  startCycleListener();
  loadExLibrary();
}

/* ══════════════════════════════
   FIRESTORE
══════════════════════════════ */
function startListening() {
  if (unsubUser) unsubUser();
  unsubUser = onSnapshot(doc(db,'usuarios',UID), snap => {
    if (snap.exists()) {
      const d=snap.data();
      exercises   = d.exercises   ||[];
      doneSet     = d.doneSet     ||[];
      meals       = d.meals       ||[];
      bodyData    = d.bodyData    ||[];
      medidasData = d.medidasData ||[];
      // Cargar perfil en el tab de perfil
      loadProfileFields(d);
      updateHeaderAvatar(d.avatarUrl||'', d.nombre||USERNAME);
    }
    initApp();
  });
}

const save    = data => setDoc(doc(db,'usuarios',UID), data, {merge:true}).catch(()=>alert('Error al guardar.'));
const saveUID = (uid,data) => setDoc(doc(db,'usuarios',uid), data, {merge:true}).catch(()=>alert('Error al guardar.'));

function startCycleListener() {
  if (unsubCycle) unsubCycle();
  unsubCycle = onSnapshot(doc(db,'config','ciclo'), snap => {
    cycle = snap.exists() ? snap.data() : null;
    if (!document.getElementById('panelCiclo').classList.contains('hidden')) renderCycle();
  });
}

/* ══════════════════════════════
   BIBLIOTECA DE EJERCICIOS
   Guarda ejercicios usados para
   autocompletar en el formulario
══════════════════════════════ */
async function loadExLibrary() {
  const snap = await getDoc(doc(db,'config','exLibrary'));
  exLibrary = snap.exists() ? (snap.data().items||[]) : [];
  updateExSuggestions();
}

function updateExSuggestions() {
  const dl = document.getElementById('exSuggestions');
  if (!dl) return;
  dl.innerHTML = exLibrary.map(ex =>
    `<option value="${ex.name}" data-gif="${ex.gif||''}" data-muscle="${ex.muscle||''}">`
  ).join('');
}

async function addToLibrary(ex) {
  if (!exLibrary.find(e=>e.name.toLowerCase()===ex.name.toLowerCase())) {
    exLibrary.push({name:ex.name, gif:ex.gif||'', muscle:ex.muscle||''});
    await setDoc(doc(db,'config','exLibrary'),{items:exLibrary},{merge:true});
    updateExSuggestions();
  }
}

// Autorellenar GIF y músculo al seleccionar de la lista
document.addEventListener('DOMContentLoaded',()=>{
  const nameInput = document.getElementById('fName');
  if (nameInput) {
    nameInput.addEventListener('input', () => {
      const val = nameInput.value.trim().toLowerCase();
      const found = exLibrary.find(e=>e.name.toLowerCase()===val);
      if (found) {
        if (found.gif    && !document.getElementById('fGif').value)    document.getElementById('fGif').value    = found.gif;
        if (found.muscle && !document.getElementById('fMuscle').value) document.getElementById('fMuscle').value = found.muscle;
      }
    });
  }
});

/* ══════════════════════════════
   TABS
══════════════════════════════ */
window.switchTab = tab => {
  ['rutina','dieta','progreso','ciclo','perfil','admin'].forEach(t=>{
    document.getElementById(`panel${cap(t)}`)?.classList.toggle('hidden',t!==tab);
    document.getElementById(`tab${cap(t)}`)?.classList.toggle('active',t===tab);
  });
  const isAdmin = USERNAME===ADMIN;
  document.getElementById('btnAdd').style.display       = (tab==='rutina'&&isAdmin)?'':'none';
  document.getElementById('btnResetWeek').style.display = (tab==='rutina'&&isAdmin)?'':'none';
  const bm=document.getElementById('btnMeal');
  if(bm) bm.style.display=(tab==='dieta'&&isAdmin)?'':'none';
  if(tab==='progreso') switchProg('comp');
  if(tab==='ciclo')    renderCycle();
  if(tab==='admin')    renderAdmin();
  if(tab==='dieta')    renderDietNav();
  if(tab==='perfil')   renderProfile();
};

window.switchProg = sub => {
  ['comp','medidas','graficas'].forEach(s=>{
    document.getElementById(`pp${cap(s)}`)?.classList.toggle('hidden',s!==sub);
    document.getElementById(`pst${cap(s)}`)?.classList.toggle('active',s===sub);
  });
  if(sub==='comp')     renderBodyData();
  if(sub==='medidas')  renderMedidasData();
  if(sub==='graficas') renderGraficas();
};

/* ══════════════════════════════
   RUTINA
══════════════════════════════ */
function renderDaysNav() {
  document.getElementById('daysNav').innerHTML = DAYS.map(day=>{
    const n=exercises.filter(e=>e.day===day).length;
    return `<button class="dpill${day===currentDay?' active':''}" onclick="selDay('${day}')">${day}${n?`<span class="dc">${n}</span>`:''}</button>`;
  }).join('');
}

window.selDay = day => {
  currentDay=day;
  document.getElementById('dayTitle').textContent=day.toUpperCase();
  renderDaysNav(); renderExercises();
};

function renderExercises(exList, targetUID) {
  const list    = document.getElementById('exList');
  const isAdmin = USERNAME===ADMIN;
  const src     = exList||exercises.filter(e=>e.day===currentDay);
  if (!src.length) {
    list.innerHTML=`<div class="empty"><p>No hay ejercicios para <strong>${currentDay}</strong>.</p>${isAdmin?`<button class="btn-sm" onclick="openModal('${currentDay}')">Agregar ejercicio</button>`:''}</div>`;
    return;
  }
  list.innerHTML=`<div class="ex-grid">${src.map((ex,i)=>buildCard(ex,i,src.length,targetUID)).join('')}</div>`;
}

function buildCard(ex,idx,total,targetUID) {
  const isDone  = doneSet.includes(ex.id);
  const isAdmin = USERNAME===ADMIN;
  const wh      = ex.weightHistory||[];
  const lastW   = wh.length?wh[wh.length-1]:null;
  const tu      = targetUID?`,'${targetUID}'`:'';
  const gifHtml = ex.gif
    ? `<div class="cm"><img src="${ex.gif}" loading="lazy" alt="${ex.name}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"/><div class="cm-fb">${ex.name.charAt(0).toUpperCase()}</div></div>`
    : `<div class="cm"><div class="cm-fb">${ex.name.charAt(0).toUpperCase()}</div></div>`;
  return `<div class="ec">
    ${gifHtml}
    <div class="cb">
      ${ex.muscle?`<div class="ctag">${ex.muscle}</div>`:''}
      <div class="cn">${ex.name}</div>
      <div class="cmeta">
        ${ex.sets?`<span class="mi">${ex.sets} series</span>`:''}
        ${ex.reps?`<span class="mi">${ex.reps} reps</span>`:''}
        ${ex.rest?`<span class="mi">${ex.rest}</span>`:''}
        ${lastW?`<span class="mi wt">${lastW.kg} kg</span>`:''}
      </div>
      ${ex.notes?`<div class="cnotes">${ex.notes}</div>`:''}
    </div>
    <div class="cf">
      <button class="bdone${isDone?' on':''}" onclick="toggleDone('${ex.id}')">${isDone?'Completado':'Marcar hecho'}</button>
      <div class="ca-right">
        <button class="bi" onclick="openWeightModal('${ex.id}',${targetUID?`'${targetUID}'`:'null'})" title="Peso">kg</button>
        ${isAdmin?`
        <button class="bi" onclick="editExercise('${ex.id}'${tu})" title="Editar">✎</button>
        ${idx>0?`<button class="bi" onclick="moveEx('${ex.id}','up'${tu})">↑</button>`:''}
        ${idx<total-1?`<button class="bi" onclick="moveEx('${ex.id}','down'${tu})">↓</button>`:''}
        <button class="bi danger" onclick="deleteExercise('${ex.id}'${tu})" title="Eliminar">✕</button>`:''}
      </div>
    </div>
  </div>`;
}

window.toggleDone = async id => {
  doneSet.includes(id)?doneSet=doneSet.filter(d=>d!==id):doneSet.push(id);
  await save({doneSet});
};

/* RESETEAR SEMANA — solo desmarca, no borra pesos */
window.confirmResetWeek = () => {
  if (!confirm('¿Resetear la semana? Solo se desmarcarán los ejercicios completados. Los pesos registrados no se perderán.')) return;
  doneSet=[];
  save({doneSet});
};

window.deleteExercise = async (id, targetUID) => {
  if (!confirm('¿Eliminar este ejercicio?')) return;
  const uid=targetUID||UID;
  const snap=await getDoc(doc(db,'usuarios',uid));
  const d=snap.data();
  d.exercises=d.exercises.filter(e=>e.id!==id);
  await saveUID(uid,d);
  if(uid===UID){exercises=d.exercises;renderDaysNav();renderExercises();}
  else adminLoadUser();
};

window.editExercise = async (id,targetUID) => {
  const uid=targetUID||UID;
  const snap=await getDoc(doc(db,'usuarios',uid));
  const ex=(snap.data()?.exercises||[]).find(e=>e.id===id);
  if(!ex) return;
  document.getElementById('exModalTitle').textContent='Editar ejercicio';
  document.getElementById('fName').value  =ex.name  ||'';
  document.getElementById('fDay').value   =ex.day   ||'Lunes';
  document.getElementById('fSets').value  =ex.sets  ||'';
  document.getElementById('fReps').value  =ex.reps  ||'';
  document.getElementById('fRest').value  =ex.rest  ||'';
  document.getElementById('fMuscle').value=ex.muscle||'';
  document.getElementById('fGif').value   =ex.gif   ||'';
  document.getElementById('fNotes').value =ex.notes ||'';
  document.getElementById('fWeight').value='';
  document.getElementById('fEditId').value=id;
  document.getElementById('fTargetUser').value=targetUID||'';
  document.getElementById('ovExercise').classList.add('open');
};

window.moveEx = async (id,dir,targetUID) => {
  const uid=targetUID||UID;
  const snap=await getDoc(doc(db,'usuarios',uid));
  const d=snap.data(); const exs=d.exercises||[];
  const idx=exs.findIndex(e=>e.id===id);
  const ni=dir==='up'?idx-1:idx+1;
  if(ni<0||ni>=exs.length) return;
  [exs[idx],exs[ni]]=[exs[ni],exs[idx]];
  d.exercises=exs; await saveUID(uid,d);
  if(uid===UID){exercises=exs;renderExercises();}else adminLoadUser();
};

/* ══════════════════════════════
   MODAL EJERCICIO
══════════════════════════════ */
window.openModal = day => {
  document.getElementById('exModalTitle').textContent='Nuevo ejercicio';
  document.getElementById('fDay').value=day||currentDay;
  document.getElementById('fEditId').value='';
  document.getElementById('fTargetUser').value='';
  document.getElementById('ovExercise').classList.add('open');
};
window.closeModal = () => {
  document.getElementById('ovExercise').classList.remove('open');
  ['fName','fSets','fReps','fRest','fGif','fNotes','fWeight','fEditId','fTargetUser'].forEach(id=>document.getElementById(id).value='');
  document.getElementById('fMuscle').value='';
  resetGifPreview();
};

window.previewGif = () => {
  let url=document.getElementById('fGif').value.trim();
  const p=document.getElementById('gifPreview'),e=document.getElementById('gifErr');
  e.classList.add('hidden');
  if(!url) return;
  if(url.includes('giphy.com/gifs/')&&!url.endsWith('.gif')){
    const parts=url.split('-');const hash=parts[parts.length-1].split('/')[0];
    if(hash){url=`https://media.giphy.com/media/${hash}/giphy.gif`;document.getElementById('fGif').value=url;}
  }
  p.innerHTML='<span>Cargando...</span>';
  const img=new Image();img.crossOrigin='anonymous';img.src=url;
  img.onload=()=>{p.innerHTML='';img.style.cssText='width:100%;height:100%;object-fit:cover;border-radius:6px';p.appendChild(img);p.classList.add('has-img');};
  img.onerror=()=>{e.classList.remove('hidden');p.classList.remove('has-img');p.innerHTML='<span>No se pudo cargar</span>';};
};

function resetGifPreview() {
  const p=document.getElementById('gifPreview');
  p.innerHTML='<span>Vista previa aquí</span>';
  p.classList.remove('has-img');
  document.getElementById('gifErr').classList.add('hidden');
}

window.saveExercise = async () => {
  const name    =document.getElementById('fName').value.trim();
  const day     =document.getElementById('fDay').value;
  const editId  =document.getElementById('fEditId').value;
  const tUID    =document.getElementById('fTargetUser').value||UID;
  if(!name){alert('Ingresa el nombre del ejercicio.');return;}

  const snap=await getDoc(doc(db,'usuarios',tUID));
  const d=snap.data()||{};
  const exs=d.exercises||[];
  const weight=parseFloat(document.getElementById('fWeight').value);
  const newEx={
    name,day,
    sets:document.getElementById('fSets').value,
    reps:document.getElementById('fReps').value,
    rest:document.getElementById('fRest').value,
    muscle:document.getElementById('fMuscle').value,
    gif:document.getElementById('fGif').value.trim(),
    notes:document.getElementById('fNotes').value.trim(),
  };

  if(editId) {
    const idx=exs.findIndex(e=>e.id===editId);
    if(idx>=0){
      exs[idx]={...exs[idx],...newEx};
      if(weight>0){if(!exs[idx].weightHistory)exs[idx].weightHistory=[];exs[idx].weightHistory.push({kg:weight,date:today()});}
    }
  } else {
    exs.push({id:Date.now().toString(),...newEx,weightHistory:weight>0?[{kg:weight,date:today()}]:[]});
    // Agregar a biblioteca
    await addToLibrary(newEx);
  }
  d.exercises=exs;
  await saveUID(tUID,d);
  closeModal();
  if(tUID===UID){exercises=exs;currentDay=day;document.getElementById('dayTitle').textContent=day.toUpperCase();renderDaysNav();renderExercises();updateWeekBar();}
  else adminLoadUser();
};

/* ══════════════════════════════
   PESO POR EJERCICIO
══════════════════════════════ */
window.openWeightModal = async (id,targetUID) => {
  editWeightId=id;
  const uid=targetUID||UID;
  const snap=await getDoc(doc(db,'usuarios',uid));
  const ex=(snap.data()?.exercises||[]).find(e=>e.id===id);
  if(!ex) return;
  document.getElementById('wModalTitle').textContent=ex.name;
  document.getElementById('wKg').value='';
  document.getElementById('ovWeight').dataset.tuid=targetUID||'';
  const wh=ex.weightHistory||[];
  document.getElementById('wHistWrap').innerHTML=wh.length
    ?`<div class="wht">Historial</div><div class="whl">${[...wh].reverse().map((w,i)=>`<div class="whr"><span>${formatDate(w.date)}</span><span class="wkg">${w.kg} kg</span><button class="bi danger" onclick="deleteWeightEntry('${id}',${wh.length-1-i},'${targetUID||''}')">✕</button></div>`).join('')}</div>`
    :'<p class="tmuted" style="margin-bottom:12px">Sin registros de peso aún.</p>';
  document.getElementById('ovWeight').classList.add('open');
};
window.closeWeightModal=()=>{document.getElementById('ovWeight').classList.remove('open');editWeightId=null;};

window.saveWeight=async()=>{
  const kg=parseFloat(document.getElementById('wKg').value);
  if(!kg||kg<=0){alert('Ingresa un peso válido.');return;}
  const tuid=document.getElementById('ovWeight').dataset.tuid||UID;
  const snap=await getDoc(doc(db,'usuarios',tuid));
  const d=snap.data();
  const ex=(d.exercises||[]).find(e=>e.id===editWeightId);
  if(!ex) return;
  if(!ex.weightHistory) ex.weightHistory=[];
  ex.weightHistory.push({kg,date:today()});
  await saveUID(tuid,d);
  if(tuid===UID) exercises=d.exercises;
  closeWeightModal();
};

window.deleteWeightEntry=async(exId,idx,tuid)=>{
  if(!confirm('¿Eliminar este registro?')) return;
  const uid=tuid||UID;
  const snap=await getDoc(doc(db,'usuarios',uid));
  const d=snap.data();
  const ex=(d.exercises||[]).find(e=>e.id===exId);
  if(ex){ex.weightHistory.splice(idx,1);await saveUID(uid,d);}
  openWeightModal(exId,tuid||null);
};

/* ══════════════════════════════
   MOVER / INTERCAMBIAR DÍAS
══════════════════════════════ */
window.openMoveModal = async () => {
  document.getElementById('moveFrom').value=currentDay;
  const users=await getAdminUsers();
  const sel=document.getElementById('moveUserSel');
  sel.innerHTML=`<option value="${UID}">${USERNAME} (yo)</option>`+users.map(u=>`<option value="${u.uid}">${u.username}</option>`).join('');
  document.getElementById('ovMove').classList.add('open');
};
window.closeMoveModal=()=>document.getElementById('ovMove').classList.remove('open');

window.executeMoveExercises=async()=>{
  const from  =document.getElementById('moveFrom').value;
  const to    =document.getElementById('moveTo').value;
  const action=document.querySelector('input[name="moveAction"]:checked')?.value;
  const uid   =document.getElementById('moveUserSel').value;
  if(from===to){alert('Selecciona días distintos.');return;}
  const snap=await getDoc(doc(db,'usuarios',uid));
  const d=snap.data(); let exs=d.exercises||[];
  if(action==='swap'){
    exs=exs.map(ex=>{
      if(ex.day===from) return{...ex,day:to};
      if(ex.day===to)   return{...ex,day:from};
      return ex;
    });
  } else {
    exs=exs.map(ex=>ex.day===from?{...ex,day:to}:ex);
  }
  d.exercises=exs; await saveUID(uid,d);
  if(uid===UID) exercises=exs;
  closeMoveModal();
  renderDaysNav();renderExercises();
  alert(`Ejercicios ${action==='swap'?'intercambiados':'movidos'} correctamente.`);
};

/* ══════════════════════════════
   GUARDAR / APLICAR RUTINAS
══════════════════════════════ */
window.openSaveRoutineModal=async()=>{
  const users=await getAdminUsers();
  const sel=document.getElementById('routineUserSel');
  sel.innerHTML=`<option value="${UID}">${USERNAME} (yo)</option>`+users.map(u=>`<option value="${u.uid}">${u.username}</option>`).join('');
  document.getElementById('ovSaveRoutine').classList.add('open');
};
window.closeSaveRoutineModal=()=>document.getElementById('ovSaveRoutine').classList.remove('open');

window.saveRoutine=async()=>{
  const name =document.getElementById('routineName').value.trim();
  const scope=document.querySelector('input[name="routineScope"]:checked')?.value;
  const uid  =document.getElementById('routineUserSel').value;
  if(!name){alert('Ingresa un nombre.');return;}
  const snap =await getDoc(doc(db,'usuarios',uid));
  const exs  =snap.data()?.exercises||[];
  const toSave=scope==='day'?exs.filter(e=>e.day===currentDay):exs;
  if(!toSave.length){alert('No hay ejercicios para guardar.');return;}
  const id=Date.now().toString();
  await setDoc(doc(db,'rutinas',id),{id,name,scope,day:scope==='day'?currentDay:null,exercises:toSave,createdAt:today()});
  closeSaveRoutineModal();
  alert(`Rutina "${name}" guardada.`);
};

window.openSavedRoutinesModal=async()=>{
  const snap=await getDocs(collection(db,'rutinas'));
  const list=document.getElementById('savedRoutinesList');
  list.innerHTML=snap.empty
    ?'<p class="tmuted">No hay rutinas guardadas.</p>'
    :snap.docs.map(d=>{const r=d.data();return`<div class="rrow"><div><div class="rname">${r.name}</div><div class="rmeta">${r.scope==='day'?r.day:'Semana completa'} · ${r.exercises?.length||0} ejercicios · ${r.createdAt}</div></div><div style="display:flex;gap:6px"><button class="btn-sm" onclick="applyRoutine('${r.id}')">Aplicar</button><button class="btn-sm danger" onclick="deleteRoutine('${r.id}')">Eliminar</button></div></div>`;}).join('');
  document.getElementById('ovSavedRoutines').classList.add('open');
};
window.closeSavedRoutinesModal=()=>document.getElementById('ovSavedRoutines').classList.remove('open');

window.applyRoutine=async id=>{
  const snap=await getDoc(doc(db,'rutinas',id));
  if(!snap.exists()) return;
  const r=snap.data();
  const exs=(r.exercises||[]).map(e=>({...e,id:Date.now().toString()+Math.random().toString(36).slice(2)}));
  exercises=[...exercises,...exs];
  await save({exercises});
  closeSavedRoutinesModal();
  renderDaysNav();renderExercises();
  alert(`Rutina "${r.name}" aplicada.`);
};

window.deleteRoutine=async id=>{
  if(!confirm('¿Eliminar esta rutina?')) return;
  await deleteDoc(doc(db,'rutinas',id));
  openSavedRoutinesModal();
};

/* ══════════════════════════════
   DIETA
══════════════════════════════ */
function renderDietNav() {
  document.getElementById('dietNav').innerHTML=DAYS.map(day=>{
    const n=meals.filter(m=>m.day===day).length;
    return `<button class="dpill${day===currentDietDay?' active':''}" onclick="selDietDay('${day}')">${day}${n?`<span class="dc">${n}</span>`:''}</button>`;
  }).join('');
  renderDietContent();
}
window.selDietDay=day=>{currentDietDay=day;document.getElementById('dietTitle').textContent=day.toUpperCase();renderDietNav();};

function renderDietContent(mealList,tUID) {
  const cont   =document.getElementById('dietContent');
  const isAdmin=USERNAME===ADMIN;
  const src    =(mealList||meals).filter(m=>m.day===currentDietDay);
  if(!src.length){
    cont.innerHTML=`<div class="empty"><p>No hay comidas para <strong>${currentDietDay}</strong>.</p>${isAdmin?`<button class="btn-sm" onclick="openMealModal('${currentDietDay}')">Agregar comida</button>`:''}</div>`;
    return;
  }
  let html='';
  MEALS.forEach(time=>{
    const tm=src.filter(m=>m.time===time);if(!tm.length) return;
    const tC=tm.reduce((s,m)=>s+(parseFloat(m.cal)||0),0);
    const tP=tm.reduce((s,m)=>s+(parseFloat(m.prot)||0),0);
    const tCa=tm.reduce((s,m)=>s+(parseFloat(m.carbs)||0),0);
    const tF=tm.reduce((s,m)=>s+(parseFloat(m.fat)||0),0);
    const tu=tUID?`,'${tUID}'`:'';
    html+=`<div class="ms"><div class="msh"><span class="mst">${time}</span><div class="mmr">${tC?`<span class="mtag cal">${Math.round(tC)} kcal</span>`:''}${tP?`<span class="mtag prot">P: ${Math.round(tP)}g</span>`:''}${tCa?`<span class="mtag carbs">C: ${Math.round(tCa)}g</span>`:''}${tF?`<span class="mtag fat">G: ${Math.round(tF)}g</span>`:''}</div></div>${tm.map(m=>`<div class="mi-row"><div class="mi-body"><div class="mi-name">${m.name}${m.qty?` <span class="mi-qty">${m.qty}</span>`:''}</div><div class="mi-mac">${m.cal?`<span class="mtag sm cal">${m.cal} kcal</span>`:''}${m.prot?`<span class="mtag sm prot">P:${m.prot}g</span>`:''}${m.carbs?`<span class="mtag sm carbs">C:${m.carbs}g</span>`:''}${m.fat?`<span class="mtag sm fat">G:${m.fat}g</span>`:''}</div>${m.notes?`<div class="cnotes">${m.notes}</div>`:''}</div>${isAdmin?`<div class="mi-act"><button class="bi" onclick="editMeal('${m.id}'${tu})">✎</button><button class="bi danger" onclick="deleteMeal('${m.id}'${tu})">✕</button></div>`:''}</div>`).join('')}</div>`;
  });
  cont.innerHTML=html;
}

window.openMealModal=(day,tUID)=>{document.getElementById('mealTitle').textContent='Nueva comida';document.getElementById('mDay').value=day||currentDietDay;document.getElementById('mEditId').value='';document.getElementById('mTargetUser').value=tUID||'';document.getElementById('ovMeal').classList.add('open');};
window.closeMealModal=()=>{document.getElementById('ovMeal').classList.remove('open');['mName','mQty','mCal','mProt','mCarbs','mFat','mNotes','mEditId','mTargetUser'].forEach(id=>document.getElementById(id).value='');};

window.editMeal=async(id,tUID)=>{
  const uid=tUID||UID;
  const snap=await getDoc(doc(db,'usuarios',uid));
  const m=(snap.data()?.meals||[]).find(m=>m.id===id);if(!m) return;
  document.getElementById('mealTitle').textContent='Editar comida';
  document.getElementById('mTime').value=m.time||'Desayuno';
  document.getElementById('mDay').value=m.day||currentDietDay;
  document.getElementById('mName').value=m.name||'';
  document.getElementById('mQty').value=m.qty||'';
  document.getElementById('mCal').value=m.cal||'';
  document.getElementById('mProt').value=m.prot||'';
  document.getElementById('mCarbs').value=m.carbs||'';
  document.getElementById('mFat').value=m.fat||'';
  document.getElementById('mNotes').value=m.notes||'';
  document.getElementById('mEditId').value=id;
  document.getElementById('mTargetUser').value=tUID||'';
  document.getElementById('ovMeal').classList.add('open');
};
window.deleteMeal=async(id,tUID)=>{
  if(!confirm('¿Eliminar esta comida?')) return;
  const uid=tUID||UID;
  const snap=await getDoc(doc(db,'usuarios',uid));
  const d=snap.data();
  d.meals=(d.meals||[]).filter(m=>m.id!==id);
  await saveUID(uid,d);
  if(uid===UID){meals=d.meals;renderDietNav();}else adminShowDiet(uid);
};
window.saveMeal=async()=>{
  const name=document.getElementById('mName').value.trim();
  const tUID=document.getElementById('mTargetUser').value||UID;
  if(!name){alert('Ingresa el nombre del alimento.');return;}
  const editId=document.getElementById('mEditId').value;
  const meal={id:editId||Date.now().toString(),time:document.getElementById('mTime').value,day:document.getElementById('mDay').value,name,qty:document.getElementById('mQty').value.trim(),cal:document.getElementById('mCal').value,prot:document.getElementById('mProt').value,carbs:document.getElementById('mCarbs').value,fat:document.getElementById('mFat').value,notes:document.getElementById('mNotes').value.trim()};
  const snap=await getDoc(doc(db,'usuarios',tUID));
  const d=snap.data()||{};const mls=d.meals||[];
  if(editId){const i=mls.findIndex(m=>m.id===editId);if(i>=0)mls[i]=meal;}else mls.push(meal);
  d.meals=mls;await saveUID(tUID,d);
  closeMealModal();
  if(tUID===UID){meals=mls;renderDietNav();}else adminShowDiet(tUID);
};

/* ══════════════════════════════
   PERFIL DE USUARIO
══════════════════════════════ */
function loadProfileFields(data) {
  document.getElementById('avatarUrlInput').value = data.avatarUrl||'';
  document.getElementById('pNombre').value   = data.nombre||'';
  document.getElementById('pApellido').value = data.apellido||'';
  document.getElementById('pFecha').value    = data.fechaNac||'';
  document.getElementById('pTel').value      = data.telefono||'';
  document.getElementById('pCiudad').value   = data.ciudad||'';
  document.getElementById('pObjetivo').value = data.objetivo||'';
  updateHeaderAvatar(data.avatarUrl||'', data.nombre||USERNAME);
  renderProfileCard(data);
}

function renderProfile() {
  getDoc(doc(db,'usuarios',UID)).then(snap=>{
    if(snap.exists()) loadProfileFields(snap.data());
  });
}

function renderProfileCard(data) {
  const card=document.getElementById('profileInfoCard');
  if(!card) return;
  const edad=data.fechaNac?calcAge(data.fechaNac):'—';
  card.innerHTML=`
    <div class="pcard">
      <div class="pcard-avatar">${avatarHtml(data.avatarUrl||'', data.nombre||USERNAME, 64)}</div>
      <div class="pcard-info">
        <div class="pcard-name">${data.nombre||''} ${data.apellido||''}</div>
        <div class="pcard-meta">${edad!=='—'?`${edad} años · `:''} ${data.ciudad||''}</div>
        ${data.gender?`<span class="utag">${data.gender}</span>`:''}
        ${data.level?`<span class="utag">${data.level}</span>`:''}
        ${(data.goals||[]).map(g=>`<span class="utag">${g}</span>`).join('')}
      </div>
    </div>`;
}

window.previewAvatar=()=>{
  const url=document.getElementById('avatarUrlInput').value.trim();
  updateHeaderAvatar(url, document.getElementById('pNombre').value||USERNAME);
};

window.saveProfile=async()=>{
  const data={
    avatarUrl: document.getElementById('avatarUrlInput').value.trim(),
    nombre:    document.getElementById('pNombre').value.trim(),
    apellido:  document.getElementById('pApellido').value.trim(),
    fechaNac:  document.getElementById('pFecha').value,
    telefono:  document.getElementById('pTel').value.trim(),
    ciudad:    document.getElementById('pCiudad').value.trim(),
    objetivo:  document.getElementById('pObjetivo').value.trim(),
  };
  await save(data);
  alert('Perfil guardado correctamente.');
};

function updateHeaderAvatar(url, name) {
  const el=document.getElementById('headerAvatar');
  if(!el) return;
  el.innerHTML=avatarHtml(url, name, 28);
}

function avatarHtml(url, name, size) {
  if(url) return `<img src="${url}" style="width:${size}px;height:${size}px;border-radius:50%;object-fit:cover" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'" alt="${name}"/><span style="display:none;width:${size}px;height:${size}px;border-radius:50%;background:var(--accent);color:white;align-items:center;justify-content:center;font-size:${Math.floor(size*0.4)}px;font-weight:700">${(name||'U').charAt(0).toUpperCase()}</span>`;
  return `<span style="display:flex;width:${size}px;height:${size}px;border-radius:50%;background:var(--accent);color:white;align-items:center;justify-content:center;font-size:${Math.floor(size*0.4)}px;font-weight:700">${(name||'U').charAt(0).toUpperCase()}</span>`;
}

function calcAge(fechaNac) {
  const dob=new Date(fechaNac);
  const now=new Date();
  let age=now.getFullYear()-dob.getFullYear();
  if(now.getMonth()<dob.getMonth()||(now.getMonth()===dob.getMonth()&&now.getDate()<dob.getDate())) age--;
  return age;
}

/* ══════════════════════════════
   COMPOSICIÓN CORPORAL
══════════════════════════════ */
const RANGES={
  grasa:   [[0,6,'Muy bajo','low'],[6,18,'Atlético','good'],[18,25,'Normal','ok'],[25,32,'Alto','warn'],[32,100,'Elevado','danger']],
  visceral:[[0,9,'Normal','good'],[9,15,'Alto','warn'],[15,100,'Peligroso','danger']],
  bmi:     [[0,18.5,'Bajo peso','low'],[18.5,25,'Normal','good'],[25,30,'Sobrepeso','warn'],[30,100,'Obesidad','danger']],
  agua:    [[0,45,'Bajo','warn'],[45,65,'Normal','good'],[65,100,'Alto','low']],
};
const semaforo=(key,val)=>{if(!val) return '';for(const[min,max,label,cls]of(RANGES[key]||[])){if(val>=min&&val<max)return `<span class="sema ${cls}">${label}</span>`;}return '';};

window.openBodyModal=()=>{document.getElementById('bDate').value=today();document.getElementById('ovBody').classList.add('open');};
window.closeBodyModal=()=>{document.getElementById('ovBody').classList.remove('open');['bEdad','bEstatura','bPeso','bAgua','bGrasa','bHueso','bVisceral','bMusculo','bBMI','bBMR','bEdadFisio'].forEach(id=>document.getElementById(id).value='');};
window.saveBody=async()=>{
  const date=document.getElementById('bDate').value;if(!date){alert('Selecciona una fecha.');return;}
  const peso=parseFloat(document.getElementById('bPeso').value)||null;
  const est=parseFloat(document.getElementById('bEstatura').value)||null;
  const edad=parseFloat(document.getElementById('bEdad').value)||null;
  let bmi=parseFloat(document.getElementById('bBMI').value)||null;
  let bmr=parseFloat(document.getElementById('bBMR').value)||null;
  if(!bmi&&peso&&est) bmi=+(peso/((est/100)**2)).toFixed(1);
  if(!bmr&&peso&&est&&edad) bmr=Math.round(10*peso+6.25*est-5*edad+5);
  bodyData.push({id:Date.now().toString(),date,edad,estatura:est,peso,agua:parseFloat(document.getElementById('bAgua').value)||null,grasa:parseFloat(document.getElementById('bGrasa').value)||null,hueso:parseFloat(document.getElementById('bHueso').value)||null,visceral:parseFloat(document.getElementById('bVisceral').value)||null,musculo:parseFloat(document.getElementById('bMusculo').value)||null,bmi,bmr,edadFisio:parseFloat(document.getElementById('bEdadFisio').value)||null});
  bodyData.sort((a,b)=>a.date.localeCompare(b.date));
  await save({bodyData});closeBodyModal();renderBodyData();
};
function renderBodyData(){
  const el=document.getElementById('bodyLatest'),hist=document.getElementById('bodyHist');
  if(!bodyData.length){el.innerHTML='<div class="empty"><p>Agrega tu primera medición de composición corporal.</p></div>';hist.innerHTML='';return;}
  const last=bodyData[bodyData.length-1];
  const fields=[{k:'peso',l:'Peso',u:'kg'},{k:'estatura',l:'Estatura',u:'cm'},{k:'grasa',l:'Grasa corporal',u:'%'},{k:'musculo',l:'Masa muscular',u:'%'},{k:'agua',l:'Agua corporal',u:'%'},{k:'bmi',l:'BMI',u:''},{k:'bmr',l:'BMR',u:'kcal'},{k:'visceral',l:'Grasa visceral',u:''},{k:'hueso',l:'Masa ósea',u:'kg'},{k:'edadFisio',l:'Edad fisiológica',u:'años'}];
  el.innerHTML=`<div class="stat-grid">${fields.filter(f=>last[f.k]!=null).map(f=>`<div class="scard"><div class="sv">${last[f.k]}<span>${f.u}</span></div><div class="sl">${f.l}</div>${semaforo(f.k,last[f.k])}</div>`).join('')}</div><p class="tmuted mt8">Última actualización: <strong>${formatDate(last.date)}</strong></p>`;
  hist.innerHTML=`<h3 class="ssub mt16">Historial</h3>`+[...bodyData].reverse().map((r,i)=>`<div class="hrow"><div class="hdate">${formatDate(r.date)}</div><div class="htags">${r.peso?`<span class="htag">${r.peso}kg</span>`:''}${r.grasa?`<span class="htag">${r.grasa}%gr</span>`:''}${r.musculo?`<span class="htag">${r.musculo}%mu</span>`:''}${r.bmi?`<span class="htag">BMI ${r.bmi}</span>`:''}</div><button class="bi danger" onclick="deleteBody(${bodyData.length-1-i})">✕</button></div>`).join('');
}
window.deleteBody=async i=>{if(!confirm('¿Eliminar?'))return;bodyData.splice(i,1);await save({bodyData});renderBodyData();};

/* ══════════════════════════════
   MEDIDAS CORPORALES
══════════════════════════════ */
window.openMedidasModal=()=>{document.getElementById('mDate').value=today();document.getElementById('ovMedidas').classList.add('open');};
window.closeMedidasModal=()=>{document.getElementById('ovMedidas').classList.remove('open');MK.forEach(k=>{const el=document.getElementById('m'+k);if(el)el.value='';});document.getElementById('mDate').value='';};
window.saveMedidas=async()=>{
  const date=document.getElementById('mDate').value;if(!date){alert('Selecciona una fecha.');return;}
  const record={id:Date.now().toString(),date};
  MK.forEach(k=>{const v=parseFloat(document.getElementById('m'+k)?.value)||null;if(v)record[k]=v;});
  if(Object.keys(record).length<=2){alert('Ingresa al menos una medida.');return;}
  medidasData.push(record);medidasData.sort((a,b)=>a.date.localeCompare(b.date));
  await save({medidasData});closeMedidasModal();renderMedidasData();
};
function renderMedidasData(){
  const el=document.getElementById('medidasLatest'),hist=document.getElementById('medidasHist');
  if(!medidasData.length){el.innerHTML='<div class="empty"><p>Agrega tu primera medición corporal.</p></div>';hist.innerHTML='';return;}
  const last=medidasData[medidasData.length-1],first=medidasData[0];
  el.innerHTML=`<div class="med-table"><div class="mtr header"><span>Medida</span><span>Actual</span><span>Cambio</span></div>${MK.filter(k=>last[k]!=null).map(k=>{const diff=first[k]&&last[k]?(last[k]-first[k]).toFixed(1):null;const clr=diff===null?'':parseFloat(diff)>0?'color:var(--success)':'color:#ef4444';return`<div class="mtr"><span>${ML[k]}</span><span><strong>${last[k]} cm</strong></span><span style="${clr}">${diff!==null?(parseFloat(diff)>0?'+':'')+diff+' cm':'—'}</span></div>`;}).join('')}</div><p class="tmuted mt8">Última actualización: <strong>${formatDate(last.date)}</strong></p>`;
  hist.innerHTML=`<h3 class="ssub mt16">Historial</h3>`+[...medidasData].reverse().map((r,i)=>`<div class="hrow"><div class="hdate">${formatDate(r.date)}</div><div class="htags">${MK.filter(k=>r[k]).slice(0,4).map(k=>`<span class="htag">${ML[k]}: ${r[k]}cm</span>`).join('')}</div><button class="bi danger" onclick="deleteMedida(${medidasData.length-1-i})">✕</button></div>`).join('');
}
window.deleteMedida=async i=>{if(!confirm('¿Eliminar?'))return;medidasData.splice(i,1);await save({medidasData});renderMedidasData();};

/* ══════════════════════════════
   GRÁFICAS
══════════════════════════════ */
function renderGraficas(){renderBodyChart(bodyChartType);renderMedChart(medChartKey);renderWCharts();}
window.switchBodyChart=type=>{bodyChartType=type;document.querySelectorAll('#bodyCtabs .ctab').forEach(b=>b.classList.toggle('active',b.textContent.toLowerCase()===type));renderBodyChart(type);};
function renderBodyChart(type){
  const cv=document.getElementById('bodyChart'),em=document.getElementById('bodyChartEmpty');
  const data=bodyData.filter(r=>r[type]!=null);
  if(data.length<2){cv.style.display='none';em.style.display='flex';return;}
  cv.style.display='block';em.style.display='none';
  if(chartInst)chartInst.destroy();
  const clrs={peso:'#b91c1c',grasa:'#dc2626',musculo:'#7f1d1d',agua:'#3b82f6'};
  const unts={peso:'kg',grasa:'%',musculo:'%',agua:'%'};
  chartInst=new Chart(cv,{type:'line',data:{labels:data.map(r=>formatDate(r.date)),datasets:[{label:`${type} (${unts[type]})`,data:data.map(r=>r[type]),borderColor:clrs[type],backgroundColor:clrs[type]+'20',borderWidth:2,pointBackgroundColor:clrs[type],pointRadius:4,tension:0.3,fill:true}]},options:{responsive:true,plugins:{legend:{labels:{color:'#f5f5f5',font:{family:'Inter'}}}},scales:{x:{ticks:{color:'#888'},grid:{color:'#2a2a2a'}},y:{ticks:{color:'#888'},grid:{color:'#2a2a2a'}}}}});
}
function renderMedChart(key){
  document.getElementById('medCtabs').innerHTML=MK.map(k=>`<button class="ctab${k===key?' active':''}" onclick="switchMedChart('${k}')" style="font-size:0.68rem;padding:3px 8px">${ML[k]}</button>`).join('');
  const cv=document.getElementById('medChart'),em=document.getElementById('medChartEmpty');
  const data=medidasData.filter(r=>r[key]!=null);
  if(data.length<2){cv.style.display='none';em.style.display='flex';return;}
  cv.style.display='block';em.style.display='none';
  if(medChartInst)medChartInst.destroy();
  medChartInst=new Chart(cv,{type:'line',data:{labels:data.map(r=>formatDate(r.date)),datasets:[{label:`${ML[key]} (cm)`,data:data.map(r=>r[key]),borderColor:'#b91c1c',backgroundColor:'#b91c1c20',borderWidth:2,pointBackgroundColor:'#b91c1c',pointRadius:4,tension:0.3,fill:true}]},options:{responsive:true,plugins:{legend:{labels:{color:'#f5f5f5',font:{family:'Inter'}}}},scales:{x:{ticks:{color:'#888'},grid:{color:'#2a2a2a'}},y:{ticks:{color:'#888'},grid:{color:'#2a2a2a'}}}}});
}
window.switchMedChart=key=>{medChartKey=key;renderMedChart(key);};
function renderWCharts(){
  const sec=document.getElementById('wCharts');
  const wh=exercises.filter(e=>(e.weightHistory||[]).length>=2);
  if(!wh.length){sec.innerHTML='<p class="tmuted">Agrega al menos 2 registros de peso en un ejercicio para ver su evolución.</p>';return;}
  sec.innerHTML=wh.map(ex=>`<div class="card mb16"><div class="card-title">${ex.name}</div><canvas id="wc-${ex.id}" height="80"></canvas></div>`).join('');
  wh.forEach(ex=>{new Chart(document.getElementById(`wc-${ex.id}`),{type:'line',data:{labels:ex.weightHistory.map(w=>formatDate(w.date)),datasets:[{label:'Peso (kg)',data:ex.weightHistory.map(w=>w.kg),borderColor:'#b91c1c',backgroundColor:'#b91c1c20',borderWidth:2,pointBackgroundColor:'#b91c1c',pointRadius:4,tension:0.3,fill:true}]},options:{responsive:true,plugins:{legend:{display:false}},scales:{x:{ticks:{color:'#888',font:{size:10}},grid:{color:'#2a2a2a'}},y:{ticks:{color:'#888'},grid:{color:'#2a2a2a'}}}}});});
}

/* ══════════════════════════════
   CICLO
══════════════════════════════ */
function renderCycle(){
  const hero=document.getElementById('cycleHero');
  const cfg=document.getElementById('cycleConfig');
  if(cfg)cfg.classList.toggle('hidden',USERNAME!==ADMIN);
  if(cycle?.start){document.getElementById('cyStart').value=cycle.start;document.getElementById('cyEnd').value=cycle.end;document.getElementById('cyName').value=cycle.name||'';}
  if(!cycle?.start||!cycle?.end){hero.innerHTML='<p class="tmuted">No hay ciclo configurado.</p>';return;}
  const t0=new Date();t0.setHours(0,0,0,0);
  const start=new Date(cycle.start+'T00:00:00'),end=new Date(cycle.end+'T00:00:00');
  const total=Math.round((end-start)/86400000),elapsed=Math.round((t0-start)/86400000),rem=Math.round((end-t0)/86400000);
  const pct=Math.min(100,Math.max(0,Math.round(elapsed/total*100)));
  let status='';
  if(t0<start)status=`<div class="cbadge pending">Comienza en ${Math.round((start-t0)/86400000)} días</div>`;
  else if(t0>end)status='<div class="cbadge done">Ciclo completado</div>';
  else{const w=Math.floor(rem/7),d=rem%7;const txt=[(w>0?`${w} sem`:''),(d>0?`${d} días`:'')].filter(Boolean).join(' y ');status=`<div class="cbadge ${rem<=7?'warn':'active'}">Quedan ${txt}</div>`;}
  hero.innerHTML=`${cycle.name?`<div class="cy-name">${cycle.name}</div>`:''}
    <div class="cy-dates">${formatDate(cycle.start)} <span>—</span> ${formatDate(cycle.end)}</div>
    ${status}
    <div class="cy-track"><div class="cy-fill" style="width:${pct}%"></div></div>
    <div class="cy-labels"><span>Inicio</span><span>${pct}% completado</span><span>Fin</span></div>
    <div class="cy-stats">
      <div class="cs"><span class="csv">${total}</span><span class="csl">días totales</span></div>
      <div class="cs"><span class="csv">${Math.max(0,elapsed)}</span><span class="csl">cursados</span></div>
      <div class="cs"><span class="csv">${Math.max(0,rem)}</span><span class="csl">restantes</span></div>
    </div>`;
}
window.saveCycle=async()=>{
  const s=document.getElementById('cyStart').value,e=document.getElementById('cyEnd').value,n=document.getElementById('cyName').value.trim();
  if(!s||!e){alert('Selecciona fechas.');return;}if(e<=s){alert('El fin debe ser posterior al inicio.');return;}
  await setDoc(doc(db,'config','ciclo'),{start:s,end:e,name:n});
};

/* ══════════════════════════════
   ADMIN
══════════════════════════════ */
async function getAdminUsers(){
  const snap=await getDocs(collection(db,'usuarios'));
  return snap.docs.map(d=>({uid:d.id,...d.data()})).filter(u=>u.username!==ADMIN);
}

async function renderAdmin(){
  allUsers=await getAdminUsers();
  filterUsers();
  const sel=document.getElementById('adminSel');
  sel.innerHTML='<option value="">— Seleccionar —</option>'+allUsers.map(u=>`<option value="${u.uid}">${u.username}</option>`).join('');
  const all=[{uid:UID,username:ADMIN},...allUsers];
  ['copyFrom','copyTo','moveUserSel','routineUserSel'].forEach(id=>{const el=document.getElementById(id);if(el)el.innerHTML=all.map(u=>`<option value="${u.uid}">${u.username}</option>`).join('');});
}

window.filterUsers=()=>{
  const q=(document.getElementById('userSearch')?.value||'').toLowerCase();
  const panel=document.getElementById('usersPanel');
  const filtered=allUsers.filter(u=>u.username.toLowerCase().includes(q));
  const masc=filtered.filter(u=>u.gender==='Masculino');
  const fem=filtered.filter(u=>u.gender==='Femenino');
  const otros=filtered.filter(u=>!u.gender);
  const grp=(title,users)=>users.length?`<div class="ugrp"><div class="ugt">${title} <span class="ugc">${users.length}</span></div>${users.map(u=>`<div class="urow"><div class="uri">${avatarHtml(u.avatarUrl||'',u.nombre||u.username,32)}<div><span class="urn">${u.username}</span>${u.nombre?`<span class="urnf">${u.nombre} ${u.apellido||''}</span>`:''}</div></div><div class="utags">${u.gender?`<span class="utag">${u.gender}</span>`:''}${u.level?`<span class="utag">${u.level}</span>`:''}</div></div>`).join('')}</div>`:''
  panel.innerHTML=grp('Masculino',masc)+grp('Femenino',fem)+grp('Sin clasificar',otros);
  if(!filtered.length)panel.innerHTML='<p class="tmuted">No se encontraron usuarios.</p>';
};

window.adminLoadUser=async()=>{
  const uid=document.getElementById('adminSel').value;
  const panel=document.getElementById('adminPanel');
  if(!uid){panel.innerHTML='';return;}
  const snap=await getDoc(doc(db,'usuarios',uid));
  if(!snap.exists()){panel.innerHTML='<p class="tmuted">Sin datos.</p>';return;}
  const d=snap.data(),uname=d.username||uid;
  panel.innerHTML=`
    <div class="auh">
      <div style="display:flex;align-items:center;gap:10px">${avatarHtml(d.avatarUrl||'',d.nombre||uname,40)}<div><div class="aun">${uname}</div>${d.nombre?`<div class="tmuted" style="font-size:0.8rem">${d.nombre} ${d.apellido||''}</div>`:''}</div></div>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        <button class="btn-sm" onclick="adminOpenEx('${uid}')">+ Ejercicio</button>
        <button class="btn-sm" onclick="openMealModal('${currentDietDay}','${uid}')">+ Comida</button>
        <button class="btn-sm" onclick="openSaveRoutineModal()">Guardar rutina</button>
      </div>
    </div>
    <div class="stabs" style="margin-bottom:12px">
      ${DAYS.map(day=>{const n=(d.exercises||[]).filter(e=>e.day===day).length;return`<button class="stab" onclick="adminShowDay('${day}','${uid}')">${day}${n?` (${n})`:''}</button>`;}).join('')}
      <button class="stab" onclick="adminShowDiet('${uid}')">Dieta</button>
    </div>
    <div id="adminContent"></div>`;
};

window.adminShowDay=(day,uid)=>{
  currentDay=day;
  getDoc(doc(db,'usuarios',uid)).then(snap=>{
    const exs=(snap.data()?.exercises||[]).filter(e=>e.day===day);
    const ac=document.getElementById('adminContent');
    if(!exs.length){ac.innerHTML=`<p class="tmuted">Sin ejercicios para ${day}.</p>`;return;}
    ac.innerHTML=`<div class="ex-grid">${exs.map((ex,i)=>buildCard(ex,i,exs.length,uid)).join('')}</div>`;
  });
};

window.adminShowDiet=async uid=>{
  const snap=await getDoc(doc(db,'usuarios',uid));
  const mls=snap.data()?.meals||[];
  const ac=document.getElementById('adminContent');
  ac.innerHTML=`<div class="stabs" style="margin-bottom:10px">${DAYS.map(d=>`<button class="stab${d===currentDietDay?' active':''}" onclick="currentDietDay='${d}';adminShowDiet('${uid}')">${d}</button>`).join('')}</div><div id="adminDietInner"></div>`;
  const inner=document.getElementById('adminDietInner');
  const dayM=mls.filter(m=>m.day===currentDietDay);
  if(!dayM.length){inner.innerHTML=`<p class="tmuted">Sin comidas para ${currentDietDay}.</p>`;return;}
  let html='';
  MEALS.forEach(time=>{const tm=dayM.filter(m=>m.time===time);if(!tm.length)return;html+=`<div class="ms"><div class="msh"><span class="mst">${time}</span></div>${tm.map(m=>`<div class="mi-row"><div class="mi-body"><div class="mi-name">${m.name}</div></div><div class="mi-act"><button class="bi" onclick="editMeal('${m.id}','${uid}')">✎</button><button class="bi danger" onclick="deleteMeal('${m.id}','${uid}')">✕</button></div></div>`).join('')}</div>`;});
  inner.innerHTML=html;
};

window.adminOpenEx=uid=>{document.getElementById('fTargetUser').value=uid;document.getElementById('fEditId').value='';document.getElementById('exModalTitle').textContent='Nuevo ejercicio';document.getElementById('ovExercise').classList.add('open');};

window.deleteSelectedUser=async()=>{
  const uid=document.getElementById('adminSel').value;
  if(!uid){alert('Selecciona un usuario primero.');return;}
  const snap=await getDoc(doc(db,'usuarios',uid));
  const uname=snap.data()?.username||uid;
  if(!confirm(`¿Eliminar al usuario "${uname}" y todos sus datos? Esta acción no se puede deshacer.`)) return;
  await deleteDoc(doc(db,'usuarios',uid));
  try{await deleteDoc(doc(db,'usernames',uname));}catch(e){}
  alert(`Usuario "${uname}" eliminado.`);
  document.getElementById('adminPanel').innerHTML='';
  await renderAdmin();
};

/* ══════════════════════════════
   COPIAR RUTINA
══════════════════════════════ */
window.openCopyRoutine=async()=>{await renderAdmin();document.getElementById('ovCopy').classList.add('open');};
window.closeCopyRoutine=()=>document.getElementById('ovCopy').classList.remove('open');
window.executeCopyRoutine=async()=>{
  const from=document.getElementById('copyFrom').value,to=document.getElementById('copyTo').value;
  if(!from||!to||from===to){alert('Selecciona usuarios distintos.');return;}
  const snapF=await getDoc(doc(db,'usuarios',from)),snapT=await getDoc(doc(db,'usuarios',to));
  if(!snapF.exists()){alert('Usuario origen no encontrado.');return;}
  const fromEx=(snapF.data().exercises||[]).map(e=>({...e,id:Date.now().toString()+Math.random().toString(36).slice(2)}));
  const toData=snapT.exists()?snapT.data():{exercises:[],doneSet:[],meals:[],bodyData:[],medidasData:[]};
  toData.exercises=[...(toData.exercises||[]),...fromEx];
  await saveUID(to,toData);
  closeCopyRoutine();alert('Rutina copiada correctamente.');
};

/* ══════════════════════════════
   OVERLAY HELPER
══════════════════════════════ */
window.handleOvClick=(e,ovId,closeFn)=>{if(e.target===document.getElementById(ovId))window[closeFn]();};

/* ══════════════════════════════
   WEEK BAR
══════════════════════════════ */
function updateWeekBar(){
  const total=exercises.length,done=exercises.filter(e=>doneSet.includes(e.id)).length;
  const pct=total===0?0:Math.round(done/total*100);
  document.getElementById('wbFill').style.width=pct+'%';
  document.getElementById('wbPct').textContent=pct+'%';
}

/* ══════════════════════════════
   UTILS
══════════════════════════════ */
const today=()=>new Date().toISOString().split('T')[0];
const cap=s=>s.charAt(0).toUpperCase()+s.slice(1);
const show=(el,msg)=>{el.textContent=msg;el.classList.remove('hidden');};
const hide=el=>el.classList.add('hidden');
const formatDate=d=>{if(!d)return'—';const[y,m,day]=d.split('-');return`${parseInt(day)} ${['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'][parseInt(m)-1]} ${y}`;};
const authMsg=code=>({'auth/email-already-in-use':'Ese correo ya está registrado.','auth/invalid-email':'Correo inválido.','auth/weak-password':'La contraseña debe tener al menos 6 caracteres.','auth/user-not-found':'No existe una cuenta con ese correo.','auth/wrong-password':'Correo o contraseña incorrectos.','auth/invalid-credential':'Correo o contraseña incorrectos.','auth/too-many-requests':'Demasiados intentos. Espera unos minutos.'}[code]||'Error inesperado. Intenta de nuevo.');

function initApp(){
  document.getElementById('dayTitle').textContent=currentDay.toUpperCase();
  renderDaysNav();renderExercises();updateWeekBar();
}

/* ══════════════════════════════
   STABS helper
══════════════════════════════ */
const stabs=document.querySelectorAll('.stab');
