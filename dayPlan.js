// Lógica de fechas, plan de cada día y cumplimiento. Funciones puras (sin React) para poder probarlas.

export const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];
export const WORK_WEEK = [1, 2, 3, 4, 5];

// Orden de lunes a domingo (getDay(): 0 = domingo)
export const WEEKDAYS = [
  { d: 1, short: 'L', name: 'Lunes' },
  { d: 2, short: 'M', name: 'Martes' },
  { d: 3, short: 'M', name: 'Miércoles' },
  { d: 4, short: 'J', name: 'Jueves' },
  { d: 5, short: 'V', name: 'Viernes' },
  { d: 6, short: 'S', name: 'Sábado' },
  { d: 0, short: 'D', name: 'Domingo' },
];

// Bloques del día en los que se acomoda cada rutina
export const BLOCKS = {
  wake: 'Al despertar',
  gym: 'Gym',
  home: 'Mañana en casa',
  free: 'Tiempo libre',
  night: 'Limpieza diaria y noche',
  family: 'Convivencia con esposa',
};

// Bloque y días por defecto de las rutinas que trae la app
export const DEFAULT_LAYOUT = {
  r1: { block: 'wake', days: ALL_DAYS },
  r2: { block: 'home', days: ALL_DAYS },
  r3: { block: 'home', days: ALL_DAYS },
  r4: { block: 'gym', days: WORK_WEEK },
  r5: { block: 'night', days: ALL_DAYS },
  r6: { block: 'free', days: [6] },
  r7: { block: 'night', days: ALL_DAYS },
  r8: { block: 'gym', days: WORK_WEEK },
  r9: { block: 'family', days: ALL_DAYS },
};

const pad = (n) => String(n).padStart(2, '0');

// Fechas como 'YYYY-MM-DD' en hora local
export const dateKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parseKey = (key) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
};
export const todayKey = () => dateKey(new Date());
export const addDays = (key, n) => {
  const d = parseKey(key);
  d.setDate(d.getDate() + n);
  return dateKey(d);
};
export const weekdayOf = (key) => parseKey(key).getDay();
// Lunes de la semana que contiene la fecha
export const weekStart = (key) => addDays(key, -((weekdayOf(key) + 6) % 7));

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
export const MONTH_NAMES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
export const dayName = (key) => WEEKDAYS.find(w => w.d === weekdayOf(key)).name;
// 'Lunes 30 nov'
export const formatDayLabel = (key) => {
  const d = parseKey(key);
  return `${dayName(key)} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
};
// 'Hoy', 'Mañana', 'Ayer' o 'Lun 30 nov'
export const formatRelativeDay = (key, today) => {
  if (key === today) return 'Hoy';
  if (key === addDays(today, 1)) return 'Mañana';
  if (key === addDays(today, -1)) return 'Ayer';
  const d = parseKey(key);
  return `${dayName(key).slice(0, 3)} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
};

export const toMinutes = (hhmm) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

const sumMins = (list) => list.reduce((acc, r) => acc + (r.estimatedMin || 0), 0);

export const routinesForDay = (routines, key) => {
  const dow = weekdayOf(key);
  return routines.filter(r => (r.days ?? ALL_DAYS).includes(dow));
};

// Hora de despertar (minutos desde medianoche) según lo que toca ese día
export function wakeMinFor(key, routines, schedule) {
  const active = routinesForDay(routines, key);
  const inBlock = (b) => active.filter(r => r.block === b);
  const gym = inBlock('gym');
  if (gym.length) {
    const commute = sumMins(gym.filter(r => r.id === 'r4'));
    return toMinutes(schedule.gymStart) - Math.round(commute / 2) - sumMins(inBlock('wake'));
  }
  if ((schedule.workDays ?? WORK_WEEK).includes(weekdayOf(key))) {
    // Día de trabajo sin gym: lo justo para arreglarse y la mañana en casa
    return toMinutes(schedule.workStart) - sumMins(inBlock('wake')) - sumMins(inBlock('home'));
  }
  return toMinutes(schedule.restWake ?? '08:00');
}

/**
 * Plan completo de un día. Todos los tiempos en minutos desde la medianoche de ese día
 * (pueden pasar de 1440 si se duerme después de medianoche).
 */
export function buildDayPlan(key, routines, schedule) {
  const active = routinesForDay(routines, key);
  const inBlock = (b) => active.filter(r => r.block === b);
  const blocks = Object.fromEntries(Object.keys(BLOCKS).map(b => [b, inBlock(b)]));
  const isWorkDay = (schedule.workDays ?? WORK_WEEK).includes(weekdayOf(key));
  const workStartMin = toMinutes(schedule.workStart);
  const workEndMin = toMinutes(schedule.workEnd);
  const workMins = isWorkDay ? (workEndMin - workStartMin + 1440) % 1440 : 0;

  const wakeMin = wakeMinFor(key, routines, schedule);
  const hasGym = blocks.gym.length > 0;
  let leaveHomeMin = null, gymStartMin = null, gymEndMin = null, backHomeMin;
  if (hasGym) {
    const commute = sumMins(blocks.gym.filter(r => r.id === 'r4'));
    gymStartMin = toMinutes(schedule.gymStart);
    leaveHomeMin = gymStartMin - Math.round(commute / 2);
    gymEndMin = gymStartMin + sumMins(blocks.gym.filter(r => r.id !== 'r4'));
    backHomeMin = gymEndMin + (commute - Math.round(commute / 2));
  } else {
    backHomeMin = wakeMin + sumMins(blocks.wake);
  }
  const homeMins = sumMins(blocks.home);
  const homeEndMin = backHomeMin + homeMins;
  const homeAvailableMins = isWorkDay ? Math.max(0, workStartMin - backHomeMin) : null;

  // La hora de dormir depende de a qué hora toca despertar al día siguiente
  const nextWakeMin = wakeMinFor(addDays(key, 1), routines, schedule);
  const bedtimeMin = nextWakeMin + 1440 - Math.round(schedule.sleepHours * 60);
  const familyStartMin = bedtimeMin - sumMins(blocks.family);
  const nightStartMin = familyStartMin - sumMins(blocks.night);
  const freeStartMin = isWorkDay ? Math.max(workEndMin, homeEndMin) : homeEndMin;
  const freeWindowMins = Math.max(0, nightStartMin - freeStartMin);

  return {
    key, active, blocks, isWorkDay, hasGym, workMins, workStartMin, workEndMin,
    wakeMin, leaveHomeMin, gymStartMin, gymEndMin, backHomeMin, homeMins, homeEndMin, homeAvailableMins,
    freeStartMin, freeWindowMins, nightStartMin, familyStartMin, bedtimeMin, nextWakeMin,
    routineMins: sumMins(active),
  };
}

// --- Registro diario ---
// dayLog: { 'YYYY-MM-DD': { plan: [ids de rutinas que tocaban], done: { [routineId]: minutos medidos (0 = marcado a mano) } } }

export const planIdsFor = (key, routines) => routinesForDay(routines, key).map(r => r.id);

// Marca o desmarca una rutina en un día. minutes === null la desmarca.
// El plan de hoy se actualiza con la configuración actual; el de días pasados se conserva.
export function logRoutine(dayLog, key, routineId, minutes, routines, today) {
  const entry = dayLog[key];
  const plan = key === today || !entry?.plan ? planIdsFor(key, routines) : entry.plan;
  const done = { ...(entry?.done ?? {}) };
  if (minutes === null) delete done[routineId];
  else done[routineId] = minutes;
  return { ...dayLog, [key]: { plan, done } };
}

// Primer día con registro (desde ahí cuentan los días sin nada como 0%)
export const trackingStart = (dayLog) => Object.keys(dayLog).sort()[0] ?? null;

/**
 * Cumplimiento de un día: rutinas que tocaban + tareas programadas para ese día.
 * pct es null para días futuros o anteriores al inicio del registro.
 */
export function dayStats(key, { dayLog, routines, tasks, today }) {
  const entry = dayLog[key];
  const planIds = key === today || !entry?.plan ? planIdsFor(key, routines) : entry.plan;
  const done = entry?.done ?? {};
  const dayTasks = tasks.filter(t => t.scheduledDate === key);
  const routinesDone = planIds.filter(id => id in done).length;
  const tasksDone = dayTasks.filter(t => t.completed).length;
  const total = planIds.length + dayTasks.length;
  const doneCount = routinesDone + tasksDone;
  const start = trackingStart(dayLog);
  const tracked = key <= today && start !== null && key >= start;
  return {
    planIds, done, dayTasks, routinesDone, tasksDone, total, doneCount,
    extraIds: Object.keys(done).filter(id => !planIds.includes(id)),
    tracked,
    pct: tracked && total > 0 ? Math.round((doneCount / total) * 100) : null,
  };
}

// Días seguidos con al menos `threshold`% (si hoy aún no llega, se cuenta desde ayer)
export function currentStreak(ctx, threshold = 80) {
  let key = ctx.today;
  const todayPct = dayStats(key, ctx).pct;
  if (todayPct === null || todayPct < threshold) key = addDays(key, -1);
  let streak = 0;
  for (;;) {
    const { pct, tracked } = dayStats(key, ctx);
    if (!tracked || pct === null || pct < threshold) break;
    streak++;
    key = addDays(key, -1);
  }
  return streak;
}

// Por rutina: cuántas veces tocaba y cuántas se hizo en los últimos `days` días registrados
export function routineFidelity(ctx, days = 30) {
  const result = Object.fromEntries(ctx.routines.map(r => [r.id, { planned: 0, done: 0 }]));
  for (let i = 0; i < days; i++) {
    const key = addDays(ctx.today, -i);
    const stats = dayStats(key, ctx);
    if (!stats.tracked) continue;
    for (const id of stats.planIds) {
      if (!result[id]) continue;
      result[id].planned++;
      if (id in stats.done) result[id].done++;
    }
  }
  return result;
}
