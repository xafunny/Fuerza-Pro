/*
  Fuerza Pro — js/firebase-config.js
  Inicialización de Firebase.
  NOTA: la configuración web de Firebase (apiKey, etc.) es PÚBLICA por diseño.
  La seguridad real vive en firestore.rules, NO aquí.
*/
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";

const app = initializeApp({
  apiKey:            "AIzaSyALUv_MuDpzol8ArgD9gOw8gIYruy1bRog",
  authDomain:        "fuerzapro-e9d6f.firebaseapp.com",
  projectId:         "fuerzapro-e9d6f",
  storageBucket:     "fuerzapro-e9d6f.firebasestorage.app",
  messagingSenderId: "589184423001",
  appId:             "1:589184423001:web:e3088e42caebea8d9bcd48"
});

export const auth = getAuth(app);
export const db   = getFirestore(app);

/*
  Correo del administrador principal ("dueño").
  Sirve solo como arranque: este correo SIEMPRE es admin.
  Los demás admins se otorgan desde el panel (campo role:'admin' en Firestore).
  NUNCA se guardan contraseñas en el código.
*/
export const OWNER_EMAIL = "jhoaoxavier2365335@gmail.com";
