/*
  Fuerza Pro — js/onboarding.js
  Cuestionario inicial (obligatorio para cuentas nuevas y para cuentas
  antiguas a las que les falten datos). Recoge:
  1. Sexo   2. Fecha de nacimiento (edad se calcula)   3. Teléfono (obligatorio)
  4. Ciudad 5. Nivel de actividad  6. Días por semana  7. Experiencia
  8. Lugar de entrenamiento / equipo  9. Lesiones      10. Objetivos
  El admin puede ver estas respuestas en su panel.
*/
import { S } from './state.js';
import { $, show, hide, calcAge } from './utils.js';
import { save } from './db.js';

let prefill = null;

document.addEventListener('fp:onboarding', e => {
  prefill = e.detail?.data || {};
  $('onboardScreen').classList.remove('hidden');
  ['ob1','ob2','ob3'].forEach((id,i) => $(id).classList.toggle('hidden', i !== 0));
  /* Precargar lo que ya exista */
  if (prefill.gender) {
    const r = document.querySelector(`input[name="obGender"][value="${prefill.gender}"]`);
    if (r) r.checked = true;
  }
  if (prefill.fechaNac) $('obFecha').value = prefill.fechaNac;
  if (prefill.telefono) $('obTel').value   = prefill.telefono;
  if (prefill.ciudad)   $('obCiudad').value = prefill.ciudad;
  if (prefill.level)    $('obLevel').value  = prefill.level;
});

window.obNext = step => {
  if (step === 2) {
    const gender = document.querySelector('input[name="obGender"]:checked')?.value;
    const fecha  = $('obFecha').value;
    const tel    = $('obTel').value.trim();
    const err    = $('ob1Err');
    hide(err);
    if (!gender) { show(err,'Selecciona tu sexo.'); return; }
    if (!fecha)  { show(err,'Ingresa tu fecha de nacimiento.'); return; }
    const edad = calcAge(fecha);
    if (edad === null || edad < 10 || edad > 100) { show(err,'Fecha de nacimiento inválida.'); return; }
    if (!/^[+]?[\d\s-]{7,16}$/.test(tel)) { show(err,'Ingresa un número de celular válido (obligatorio).'); return; }
  }
  if (step === 3) {
    const err = $('ob2Err');
    hide(err);
    if (!$('obLevel').value)  { show(err,'Selecciona tu nivel de actividad.'); return; }
    if (!$('obDias').value)   { show(err,'Selecciona cuántos días entrenarás.'); return; }
    if (!$('obExp').value)    { show(err,'Selecciona tu experiencia.'); return; }
    if (!$('obLugar').value)  { show(err,'Selecciona dónde entrenarás.'); return; }
  }
  ['ob1','ob2','ob3'].forEach((id,i) => $(id).classList.toggle('hidden', i !== step-1));
};
window.obPrev = step => ['ob1','ob2','ob3'].forEach((id,i) => $(id).classList.toggle('hidden', i !== step-1));

window.toggleGoal = btn => btn.classList.toggle('active');

window.obFinish = async () => {
  const goals = [...document.querySelectorAll('.goal-btn.active')].map(b => b.dataset.val);
  const err = $('obErr');
  hide(err);
  if (!goals.length) { show(err,'Selecciona al menos un objetivo.'); return; }
  const fecha = $('obFecha').value;
  await save({
    gender:   document.querySelector('input[name="obGender"]:checked')?.value || '',
    fechaNac: fecha,
    edad:     calcAge(fecha),
    telefono: $('obTel').value.trim(),
    ciudad:   $('obCiudad').value.trim(),
    level:    $('obLevel').value,
    diasSemana: $('obDias').value,
    experiencia: $('obExp').value,
    lugarEntreno: $('obLugar').value,
    lesiones: $('obLesiones').value.trim() || 'Ninguna',
    goals,
    needsOnboarding: false
  });
  $('onboardScreen').classList.add('hidden');
  document.dispatchEvent(new CustomEvent('fp:login'));
};
