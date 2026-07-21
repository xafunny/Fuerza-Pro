/*
  Fuerza Pro — js/db.js
  Capa de acceso a Firestore: helpers de lectura/escritura.
*/
import { doc, setDoc, getDoc, getDocs, deleteDoc, collection } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";
import { db } from './firebase-config.js';
import { S } from './state.js';

export { doc, setDoc, getDoc, getDocs, deleteDoc, collection, db };

/* Guardar (merge) en el documento del usuario actual */
export const save = data =>
  setDoc(doc(db,'usuarios',S.UID), data, { merge:true })
    .catch(e => { console.error(e); alert('Error al guardar. Revisa tu conexión.'); });

/* Guardar (merge) en el documento de cualquier usuario (uso admin) */
export const saveUID = (uid, data) =>
  setDoc(doc(db,'usuarios',uid), data, { merge:true })
    .catch(e => { console.error(e); alert('Error al guardar. ¿Tienes permisos?'); });

export const getUser = async uid => {
  const snap = await getDoc(doc(db,'usuarios',uid));
  return snap.exists() ? snap.data() : null;
};
