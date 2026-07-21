# Fuerza Pro — Guía de instalación y seguridad

## Estructura nueva del proyecto

```
fuerza-pro/
├── index.html            ← página única de la app
├── css/
│   └── styles.css        ← todos los estilos
├── js/
│   ├── firebase-config.js  ← conexión a Firebase (sin contraseñas)
│   ├── state.js            ← estado compartido y constantes
│   ├── utils.js            ← helpers (esc anti-XSS, fechas, compresor de imágenes)
│   ├── db.js               ← acceso a Firestore
│   ├── auth.js             ← login / registro / verificación de correo
│   ├── onboarding.js       ← cuestionario obligatorio (10 preguntas)
│   ├── exercises.js        ← rutina, tarjetas, biblioteca, buscador con GIF, pesos
│   ├── routine-parser.js   ← pegar rutina en texto → lunes a domingo
│   ├── routines.js         ← rutinas guardadas (ver por días arreglado)
│   ├── diet.js             ← plan de alimentación
│   ├── progress.js         ← composición, medidas, gráficas
│   ├── photos.js           ← fotos de avances PRIVADAS
│   ├── profile.js          ← perfil + subida real de foto de perfil
│   ├── cycle.js            ← ciclo de entrenamiento e historial
│   ├── groups.js           ← grupos manuales y automáticos
│   ├── ai.js               ← rutinas generadas con Gemini (IA)
│   ├── admin.js            ← panel admin, roles, migración, eliminación
│   └── main.js             ← punto de entrada (pestañas, listeners, reset semanal)
├── firestore.rules       ← ⚠️ PEGAR EN FIREBASE (paso obligatorio)
└── LEEME.md              ← este archivo
```

Funciona igual en GitHub Pages: sube toda la carpeta tal cual (los módulos ES
se cargan con rutas relativas, no necesitas compilar nada).

---

## ⚠️ PASOS OBLIGATORIOS DESPUÉS DE SUBIR EL CÓDIGO

### 1. Cambia tu contraseña YA
Tu contraseña real (`Sxxafunny28`) estaba escrita dentro de `app.js`. Cualquier
persona que haya abierto la app pudo verla con "Ver código fuente". Considérala
**comprometida**: cámbiala en Gmail y en cualquier otro sitio donde la uses.

### 2. Crea tu cuenta real y la de Karen
Los usuarios "jhoao" y "karen" ya no existen en el código. Ahora:
1. Regístrate en la app con `jhoaoxavier2365335@gmail.com` (ese correo es
   automáticamente administrador — está definido en `firestore.rules` y en
   `js/firebase-config.js`).
2. Verifica el correo (llega un enlace).
3. Karen se registra con su propio correo y lo verifica.
4. Entra como admin → pestaña **Admin** → tarjeta **"Migrar cuentas antiguas"**
   → migra los datos del documento antiguo `jhoao` a tu cuenta y `karen` a la
   suya. Sus rutinas, dietas, medidas y pesos se copian sin perder nada.

### 3. Publica las reglas de seguridad
Firebase Console → **Firestore Database → Reglas** → borra lo que haya →
pega el contenido de `firestore.rules` → **Publicar**.
Sin este paso, cualquier persona puede leer y borrar TODA tu base de datos
(esa es la vulnerabilidad más grave que tenía la app).

### 4. Activa la verificación (ya viene hecha en el código)
- Registro: se envía correo de verificación y **no se puede entrar sin
  verificar**. Las reglas del servidor también exigen `email_verified`.
- Contraseña olvidada: Firebase envía un **enlace de un solo uso que caduca**;
  ese enlace cumple la función del "código de verificación": solo quien tiene
  acceso al correo puede restablecerla. (Firebase no soporta códigos numéricos
  por SMS/correo en el plan gratuito sin servidores propios.)

### 5. (Opcional) IA con Gemini
1. Crea una clave gratis en https://aistudio.google.com/apikey
2. **Restríngela**: Google Cloud Console → APIs y servicios → Credenciales →
   tu clave → Restricciones de aplicación → *Sitios web* → agrega solo tu
   dominio (ej. `tuusuario.github.io/*`). Así la clave no sirve fuera de tu app.
3. En la app: Admin → tarjeta "Inteligencia Artificial" → pegar y guardar.
Todos los usuarios podrán generar rutinas con el botón **✨ Rutina con IA**
(usa sus respuestas del cuestionario: nivel, días, lesiones, objetivos) y
revisarlas/editarlas antes de aplicarlas.

---

## Todo lo que se arregló / agregó

**Seguridad**
- Contraseñas eliminadas del código; admin por rol en Firestore protegido por reglas.
- Verificación de correo obligatoria (cliente + servidor).
- Reglas de Firestore completas (antes no había ninguna protección real).
- Escape anti-XSS (`esc()`) en todo texto de usuario: antes un usuario podía
  inyectar HTML/JavaScript que se ejecutaba en el navegador del admin.
- Usuarios eliminados quedan bloqueados por correo y no pueden volver a entrar.
  (Para borrar también su cuenta de acceso: Firebase Console → Authentication →
  usuario → Eliminar. Desde el navegador no es posible por diseño de Firebase.)
- Fotos de avances privadas a nivel de servidor: solo el dueño puede verlas.

**Funciones nuevas**
- Todos los usuarios pueden crear/editar/borrar **sus** ejercicios (GIF opcional).
- 📋 **Pegar rutina**: pegas texto y se convierte en ejercicios de lunes a
  domingo, con tabla de vista previa editable (agregar o reemplazar).
- ✨ **Rutina con IA** (Gemini gratis) personalizada con el cuestionario.
- Buscador en vivo al escribir el nombre del ejercicio: sugiere de la
  biblioteca con miniatura del GIF y autocompleta GIF + grupo muscular.
- Foto de perfil: se **sube el archivo directamente** (se comprime y guarda en
  Firestore; ya no hace falta imgur) y se ve en toda la app.
- Fotos de avances con nota y visor, 100% privadas.
- Cuestionario inicial de 10 preguntas (sexo, fecha de nacimiento → edad
  automática, **celular obligatorio**, ciudad, nivel, días/semana, experiencia,
  lugar de entrenamiento, lesiones, objetivos). También se pide a cuentas
  antiguas a las que les falten datos.
- Grupos: manuales y automáticos por ejercicios compartidos entre usuarios.
- Admin: ver datos personales y respuestas del cuestionario de cada usuario,
  dar/quitar rol de admin (solo el dueño), eliminar usuarios.
- Rutinas guardadas: botón **Ver** con el detalle por días antes de aplicar.

**Errores corregidos**
- El reset dominical intentaba resetear a TODOS los usuarios desde cualquier
  navegador abierto → ahora cada usuario resetea solo su semana al abrir la
  app en una semana nueva (los pesos nunca se tocan).
- El cambio de día en la dieta del panel admin no funcionaba (asignaba una
  variable global inexistente).
- El login anónimo "parche" del admin se eliminó (las reglas nuevas lo hacen
  innecesario y era un hueco de seguridad).
- Guardados parciales: ahora se escriben solo los campos que cambian (menos
  riesgo de pisar datos si dos pestañas están abiertas).

---

## ¿Migrar a MySQL? — Respuesta corta: no te conviene

MySQL es solo una base de datos: **no funciona sola desde GitHub Pages**.
Para usarla necesitarías además un servidor propio (Node/PHP/Python) que
esté encendido 24/7, con su hosting, su dominio, certificados, copias de
seguridad y su propio sistema de login. Es decir, pasarías de "subir archivos
a GitHub" a mantener un backend completo, y los hosting gratuitos de MySQL
(Railway, PlanetScale, etc.) han ido eliminando sus planes gratis o los
apagan por inactividad.

Firebase (plan Spark) te da gratis lo que ya usas: base de datos en tiempo
real, autenticación con verificación de correo, reglas de seguridad en el
servidor y hosting compatible con tu app estática. Para el tamaño de tu app
(decenas de usuarios), los límites gratuitos (50k lecturas/día, 20k
escrituras/día, 1 GiB) te sobran.

Mi recomendación: **quédate en Firebase** y, si algún día quieres respaldo,
exporta tus datos (Firebase Console → Firestore → o con un pequeño script)
a JSON. Si el proyecto creciera a cientos de usuarios de pago, ahí sí
valdría la pena un backend propio — y en ese momento migrar es sencillo
porque los datos ya están organizados por colecciones.

---

## Nota sobre las fotos y el plan gratuito

Firebase Storage ya no está disponible en el plan gratuito para proyectos
nuevos, así que las fotos (perfil y avances) se comprimen en el navegador y
se guardan en Firestore en formato base64:
- Foto de perfil: ~256 px (≈100 KB).
- Fotos de avances: ~900 px (≤700 KB, bajo el límite de 1 MB por documento).
Es más que suficiente para ver el progreso y no gasta nada extra.
