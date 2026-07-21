/*
  Fuerza Pro — js/ai.js
  Generar rutinas con IA (API de Gemini — capa gratuita).

  Cómo configurarla (solo el admin):
  1. Entra a https://aistudio.google.com/apikey y crea una clave gratuita.
  2. MUY IMPORTANTE: en Google Cloud Console → Credenciales → tu clave →
     "Restricciones de aplicación" → Sitios web → agrega SOLO el dominio de
     tu app (ej: tuusuario.github.io). Así, aunque la clave viaje al
     navegador, no sirve en ningún otro sitio.
  3. Pégala en el panel Admin → "Clave de IA" y guarda.

  La rutina generada pasa por la misma vista previa editable del parser,
  así que el usuario puede corregirla antes de aplicarla.
*/
import { S, DAYS } from './state.js';
import { $, esc } from './utils.js';
import { db, doc, getDoc, setDoc } from './db.js';

const MODEL = 'gemini-1.5-flash';

async function getAIKey() {
  try {
    const snap = await getDoc(doc(db,'config','ai'));
    return snap.exists() ? (snap.data().key||'') : '';
  } catch(e) { return ''; }
}

window.saveAIKey = async () => {
  if (!S.isAdmin) return;
  const key = $('aiKeyInput').value.trim();
  if (!key) { alert('Pega la clave de la API de Gemini.'); return; }
  await setDoc(doc(db,'config','ai'), { key }, { merge:true });
  alert('Clave guardada. Recuerda restringirla por dominio en Google Cloud.');
};

window.openAIModal = async () => {
  $('aiPrompt').value = '';
  $('aiStatus').textContent = '';
  const key = await getAIKey();
  $('aiNoKey').classList.toggle('hidden', !!key);
  $('aiForm').classList.toggle('hidden', !key);
  $('ovAI').classList.add('open');
};
window.closeAIModal = () => $('ovAI').classList.remove('open');

window.generateAIRoutine = async () => {
  const key = await getAIKey();
  if (!key) { alert('El administrador aún no configuró la IA.'); return; }
  const extra = $('aiPrompt').value.trim();
  const status = $('aiStatus');
  status.textContent = 'Generando rutina con IA... (10-20 segundos)';

  /* Usar el perfil y las respuestas del onboarding para personalizar */
  const snap = await getDoc(doc(db,'usuarios',S.UID));
  const u = snap.data()||{};
  const perfil = [
    u.gender && `Sexo: ${u.gender}`,
    u.edad && `Edad: ${u.edad} años`,
    u.level && `Nivel de actividad: ${u.level}`,
    u.experiencia && `Experiencia: ${u.experiencia}`,
    u.diasSemana && `Días disponibles por semana: ${u.diasSemana}`,
    u.lugarEntreno && `Entrena en: ${u.lugarEntreno}`,
    u.lesiones && u.lesiones!=='Ninguna' && `Lesiones: ${u.lesiones}`,
    (u.goals||[]).length && `Objetivos: ${u.goals.join(', ')}`
  ].filter(Boolean).join('. ');

  const prompt = `Eres un entrenador personal. Crea una rutina de gimnasio semanal para esta persona: ${perfil||'sin datos'}. ${extra?('Indicaciones adicionales: '+extra+'.'):''}
Responde SOLO con JSON válido, sin markdown ni texto extra, con este formato exacto:
[{"day":"Lunes","name":"Press banca","sets":"4","reps":"12","rest":"90s"}]
Usa únicamente estos días: ${DAYS.join(', ')}. Máximo 8 ejercicios por día. Incluye solo los días que la persona puede entrenar. Nombres de ejercicios en español.`;

  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${encodeURIComponent(key)}`, {
      method:'POST',
      headers:{ 'Content-Type':'application/json' },
      body: JSON.stringify({ contents:[{ parts:[{ text: prompt }] }] })
    });
    if (!res.ok) throw new Error('Respuesta '+res.status);
    const data = await res.json();
    let text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    text = text.replace(/```json|```/g,'').trim();
    const arr = JSON.parse(text);
    if (!Array.isArray(arr) || !arr.length) throw new Error('Formato inesperado');
    S.parsedRows = arr
      .filter(r => r.name && DAYS.includes(r.day))
      .map(r => ({ day:r.day, name:String(r.name).slice(0,60), sets:String(r.sets||''), reps:String(r.reps||''), rest:String(r.rest||''), weight:'' }));
    const rows = S.parsedRows; /* openPasteModal las limpia; restaurar después */
    window.closeAIModal();
    window.openPasteModal();
    S.parsedRows = rows;
    $('pasteText').value = '(rutina generada por IA — revisa la tabla de abajo, corrige lo que quieras y pulsa "Aplicar")';
    document.querySelector('#ovPaste .mt').textContent = 'Rutina generada por IA';
    window.renderParsedTable();
  } catch(e) {
    console.error(e);
    status.textContent = 'Error al generar. Verifica la clave de la API o inténtalo de nuevo.';
  }
};
