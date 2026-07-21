/*
  Fuerza Pro — js/state.js
  Estado compartido entre módulos y constantes.
*/
export const DAYS  = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'];
export const MEALS = ['Desayuno','Almuerzo','Merienda','Cena'];
export const MK = ['Cuello','Hombros','Pecho','Cintura','Abdomen','Cadera',
  'BIzqR','BIzqC','BDerR','BDerC','AIzq','ADer','MIzq','MDer','PIzq','PDer'];
export const ML = {
  Cuello:'Cuello',Hombros:'Hombros',Pecho:'Pecho',Cintura:'Cintura',
  Abdomen:'Abdomen',Cadera:'Cadera/Glúteos',
  BIzqR:'Brazo Izq. Relajado',BIzqC:'Brazo Izq. Contraído',
  BDerR:'Brazo Der. Relajado',BDerC:'Brazo Der. Contraído',
  AIzq:'Antebrazo Izq.',ADer:'Antebrazo Der.',
  MIzq:'Muslo Izq.',MDer:'Muslo Der.',PIzq:'Pantorrilla Izq.',PDer:'Pantorrilla Der.'
};

export const SESSION_KEY = 'fp_uid';
export const RESET_KEY   = 'fp_last_reset';

/* Estado mutable de la sesión */
export const S = {
  UID: null,
  USERNAME: null,
  EMAIL: null,
  isAdmin: false,          // se calcula al iniciar sesión (role en Firestore u OWNER_EMAIL)
  currentDay: DAYS[0],
  currentDietDay: DAYS[0],
  exercises: [],
  doneSet: [],
  meals: [],
  bodyData: [],
  medidasData: [],
  cycle: null,
  allUsers: [],
  exLibrary: [],
  parsedRows: [],          // filas del parser de rutinas en texto
  chartInst: null,
  medChartInst: null,
  unsubUser: null,
  unsubCycle: null,
  editWeightId: null,
  editBodyId: null,
  editMedId: null,
  bodyChartType: 'peso',
  medChartKey: 'Cuello'
};
