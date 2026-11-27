import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { 
  Mic, MicOff, Plus, Play, Pause, Square, CheckCircle, Clock, 
  Calendar, Layers, Sparkles, Trash2, ArrowRight, TrendingUp, 
  AlertCircle, ChevronDown, ChevronRight, Home, Dog, Bus, 
  ShieldCheck, RefreshCw, BarChart2, Check, Moon, Sun, Circle, ListChecks, X, Briefcase, Dumbbell, Heart,
  CloudOff, CloudAlert, CloudCheck, LogOut, ChevronLeft, CalendarCheck, AlertTriangle
} from 'lucide-react';
import { useCloudSync } from './useCloudSync.js';
import CalendarView from './CalendarView.jsx';
import TaskScheduler from './TaskScheduler.jsx';
import {
  ALL_DAYS, BLOCKS, DEFAULT_LAYOUT, WEEKDAYS, addDays, buildDayPlan, formatDayLabel, formatRelativeDay,
  logRoutine, parseKey, todayKey, weekStart,
} from './dayPlan.js';

// Horario fijo: jornada laboral (y qué días se trabaja), hora de entrenar, sueño
// y hora de despertar los días sin gym ni trabajo. El resto de horas se calcula.
const DEFAULT_SCHEDULE = { workStart: '09:00', workEnd: '18:00', gymStart: '06:45', sleepHours: 8, workDays: [1, 2, 3, 4, 5], restWake: '08:00' };

// --- INITIAL DEFAULT DATA ---
// steps: actividades de la rutina; actualsSec guarda cuántos segundos tomó cada vez
const INITIAL_ROUTINES = [
  { id: 'r1', name: 'Rutina de Mañana & Higiene', category: 'Personal', estimatedMin: 45, actuals: [40, 50, 42], isNonNegotiable: true, type: 'daily', steps: [
    { id: 'r1s1', name: 'Ordenar la cama', actualsSec: [] },
    { id: 'r1s2', name: 'Lavarse la cara con exfoliador', actualsSec: [] },
    { id: 'r1s3', name: 'Bañarse', actualsSec: [] },
    { id: 'r1s4', name: 'Aplicar crema, ácido y bloqueador', actualsSec: [] },
    { id: 'r1s5', name: 'Tomar medicamento', actualsSec: [] },
    { id: 'r1s6', name: 'Vestirse', actualsSec: [] }
  ] },
  { id: 'r2', name: 'Desayuno & Preparación', category: 'Alimentos', estimatedMin: 30, actuals: [25, 30], isNonNegotiable: true, type: 'daily', steps: [] },
  { id: 'r3', name: 'Alimentación y Paseo de Mascotas', category: 'Mascotas', estimatedMin: 35, actuals: [35, 40], isNonNegotiable: false, type: 'daily', steps: [] },
  { id: 'r4', name: 'Traslado al Gym (Camión ida/vuelta)', category: 'Traslados', estimatedMin: 30, actuals: [], isNonNegotiable: false, type: 'daily', steps: [] },
  { id: 'r5', name: 'Limpieza Superficial Diario (Cocina/Baño)', category: 'Limpieza', estimatedMin: 20, actuals: [18, 22, 25], isNonNegotiable: false, type: 'daily', steps: [
    { id: 'r5s1', name: 'Limpiar cocina', actualsSec: [] },
    { id: 'r5s2', name: 'Limpiar sala', actualsSec: [] },
    { id: 'r5s3', name: 'Limpiar baños', actualsSec: [] },
    { id: 'r5s4', name: 'Limpiar cuarto', actualsSec: [] },
    { id: 'r5s5', name: 'Cerrar casa', actualsSec: [] }
  ] },
  { id: 'r6', name: 'Limpieza Profunda Fin de Semana', category: 'Limpieza', estimatedMin: 120, actuals: [110], isNonNegotiable: false, type: 'weekly', steps: [] },
  { id: 'r7', name: 'Rutina Nocturna y Preparación Dormir', category: 'Personal', estimatedMin: 30, actuals: [30, 28], isNonNegotiable: true, type: 'daily', steps: [
    { id: 'r7s1', name: 'Bañarse', actualsSec: [] },
    { id: 'r7s2', name: 'Skin care', actualsSec: [] },
    { id: 'r7s3', name: 'Preparar la ropa', actualsSec: [] }
  ] },
  { id: 'r8', name: 'Entrenamiento en el Gym', category: 'Ejercicio', estimatedMin: 45, actuals: [], isNonNegotiable: false, type: 'daily', steps: [] },
  { id: 'r9', name: 'Convivencia con esposa', category: 'Familia', estimatedMin: 30, actuals: [], isNonNegotiable: true, type: 'daily', steps: [] }
];

const INITIAL_INBOX_TASKS = [
  { id: 't1', title: 'Cambiar foco fundido de la cocina', category: 'Casa', estimatedMin: 15, createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), scheduledTime: null, completed: false },
  { id: 't2', title: 'Pagar servicio de internet y electricidad', category: 'Trámites', estimatedMin: 10, createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), scheduledTime: null, completed: false },
  { id: 't3', title: 'Mantenimiento y desinfección caja de arena mascota', category: 'Mascotas', estimatedMin: 25, createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), scheduledTime: '18:30', completed: false },
  { id: 't4', title: 'Comprar repuesto de tarjeta para el camión', category: 'Traslados', estimatedMin: 20, createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), scheduledTime: null, completed: false }
];

const CATEGORY_COLORS = {
  Personal: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30',
  Alimentos: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  Mascotas: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  Traslados: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
  Limpieza: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
  Casa: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
  Trámites: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30',
  Ejercicio: 'bg-orange-500/10 text-orange-400 border-orange-500/30',
  Familia: 'bg-pink-500/10 text-pink-400 border-pink-500/30'
};

const MEASURE_BUTTON_STYLES = {
  indigo: 'bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 border-indigo-500/30',
  amber: 'bg-amber-600/20 hover:bg-amber-600 text-amber-300 border-amber-500/30',
  orange: 'bg-orange-600/20 hover:bg-orange-600 text-orange-300 border-orange-500/30',
  purple: 'bg-purple-600/20 hover:bg-purple-600 text-purple-300 border-purple-500/30',
  pink: 'bg-pink-600/20 hover:bg-pink-600 text-pink-300 border-pink-500/30'
};

// Helper formatting seconds
const formatTime = (secs) => {
  const mins = Math.floor(secs / 60);
  const remainingSecs = secs % 60;
  return `${mins.toString().padStart(2, '0')}:${remainingSecs.toString().padStart(2, '0')}`;
};

const averageSecs = (arr) => arr?.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : null;

// 'HH:MM' <-> minutos desde medianoche
const toMinutes = (hhmm) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

const toHHMM = (mins) => {
  const m = ((mins % 1440) + 1440) % 1440;
  return `${Math.floor(m / 60).toString().padStart(2, '0')}:${(m % 60).toString().padStart(2, '0')}`;
};

const formatDuration = (mins) => `${Math.floor(mins / 60)} h${mins % 60 ? ` ${mins % 60} min` : ''}`;

// Completa rutinas guardadas (en este dispositivo o en la nube) con lo que se agregó después a los valores por defecto
const normalizeRoutines = (list) => {
  // Rutinas guardadas antes de que existieran los pasos: tomar los pasos por defecto
  const loaded = list.map(r => r.steps ? r : { ...r, steps: INITIAL_ROUTINES.find(i => i.id === r.id)?.steps || [] });
  // Rutinas nuevas por defecto (ej. el gym) que aún no estaban guardadas
  const all = [...loaded, ...INITIAL_ROUTINES.filter(i => !loaded.some(r => r.id === i.id))];
  // Rutinas guardadas antes de que existieran los días y bloques
  return all.map(r => ({ block: 'free', days: ALL_DAYS, ...DEFAULT_LAYOUT[r.id], ...r }));
};

const DEFAULT_ROUTINE_IDS = new Set(['r1', 'r2', 'r3', 'r4', 'r5', 'r6', 'r7', 'r8', 'r9']);

// Tareas programadas antes de que existieran las fechas: se quedan en el día en que se abren por primera vez
const normalizeTasks = (list) => list.map(t => t.scheduledTime && !t.scheduledDate ? { ...t, scheduledDate: todayKey() } : t);

const SYNC_BADGES = {
  loading: { Icon: RefreshCw, text: 'Conectando…', className: 'text-slate-400', spin: true },
  saving: { Icon: RefreshCw, text: 'Guardando…', className: 'text-indigo-300', spin: true },
  synced: { Icon: CloudCheck, text: 'En la nube', className: 'text-emerald-400' },
  offline: { Icon: CloudOff, text: 'Sin conexión (se guarda aquí)', className: 'text-amber-400' },
  error: { Icon: CloudAlert, text: 'Error al sincronizar', className: 'text-rose-400' },
};

// cloud: null en modo solo local, o { email, signOut, onAuthLost } con sesión iniciada
export default function App({ cloud = null }) {
  // --- PERSISTENT STATES ---
  const [routines, setRoutines] = useState(() => {
    const saved = localStorage.getItem('mf_routines');
    return normalizeRoutines(saved ? JSON.parse(saved) : INITIAL_ROUTINES);
  });

  // Rutina paso a paso en curso: { routineId, startedAt, lapStartedAt, pausedAt, done: { [stepId]: segundos } }
  const [stepSession, setStepSession] = useState(() => {
    const saved = localStorage.getItem('mf_step_session');
    return saved ? JSON.parse(saved) : null;
  });
  const [selectedRoutineId, setSelectedRoutineId] = useState(null);
  const [now, setNow] = useState(Date.now());

  const [fixedSchedule, setFixedSchedule] = useState(() => {
    const saved = localStorage.getItem('mf_schedule');
    return saved ? { ...DEFAULT_SCHEDULE, ...JSON.parse(saved) } : DEFAULT_SCHEDULE;
  });

  const [inboxTasks, setInboxTasks] = useState(() => {
    const saved = localStorage.getItem('mf_inbox');
    return normalizeTasks(saved ? JSON.parse(saved) : INITIAL_INBOX_TASKS);
  });

  // Registro de lo hecho cada día: { 'YYYY-MM-DD': { plan: [ids], done: { [routineId]: minutos } } }
  const [dayLog, setDayLog] = useState(() => {
    const saved = localStorage.getItem('mf_daylog');
    return saved ? JSON.parse(saved) : {};
  });

  // Fecha de hoy (se actualiza si la app sigue abierta al pasar la medianoche) y día que se está viendo
  const [today, setToday] = useState(todayKey);
  const [selectedDate, setSelectedDate] = useState(todayKey);
  const todayRef = useRef(today);
  useEffect(() => {
    const id = setInterval(() => {
      const t = todayKey();
      if (t === todayRef.current) return;
      const prev = todayRef.current;
      todayRef.current = t;
      setToday(t);
      setSelectedDate(sel => sel === prev ? t : sel);
    }, 60 * 1000);
    return () => clearInterval(id);
  }, []);

  const [activeTab, setActiveTab] = useState('timeline'); // 'timeline' | 'inbox' | 'calendar' | 'analytics' | 'config'
  
  // --- SPEECH RECOGNITION STATES ---
  const [isListening, setIsListening] = useState(false);
  const [taskInput, setTaskInput] = useState('');
  const [taskCategory, setTaskCategory] = useState('Casa');
  const [taskEstMin, setTaskEstMin] = useState(15);
  const recognitionRef = useRef(null);

  // --- TIMER STATES ---
  const [activeTimerRoutineId, setActiveTimerRoutineId] = useState(null);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const timerIntervalRef = useRef(null);

  // Persistence Effects
  useEffect(() => {
    localStorage.setItem('mf_routines', JSON.stringify(routines));
  }, [routines]);

  useEffect(() => {
    localStorage.setItem('mf_inbox', JSON.stringify(inboxTasks));
  }, [inboxTasks]);

  useEffect(() => {
    localStorage.setItem('mf_schedule', JSON.stringify(fixedSchedule));
  }, [fixedSchedule]);

  useEffect(() => {
    localStorage.setItem('mf_daylog', JSON.stringify(dayLog));
  }, [dayLog]);

  useEffect(() => {
    if (stepSession) localStorage.setItem('mf_step_session', JSON.stringify(stepSession));
    else localStorage.removeItem('mf_step_session');
  }, [stepSession]);

  // Respaldo en la nube (rutinas, bandeja, horario y registro diario; la rutina en curso se queda en este dispositivo)
  const syncedState = useMemo(() => ({ routines, inboxTasks, fixedSchedule, dayLog }), [routines, inboxTasks, fixedSchedule, dayLog]);
  const applyRemoteState = useCallback((remote) => {
    if (Array.isArray(remote.routines)) setRoutines(normalizeRoutines(remote.routines));
    if (Array.isArray(remote.inboxTasks)) setInboxTasks(normalizeTasks(remote.inboxTasks));
    if (remote.fixedSchedule) setFixedSchedule({ ...DEFAULT_SCHEDULE, ...remote.fixedSchedule });
    if (remote.dayLog && typeof remote.dayLog === 'object') setDayLog(remote.dayLog);
  }, []);
  const syncStatus = useCloudSync({
    enabled: Boolean(cloud),
    state: syncedState,
    applyRemote: applyRemoteState,
    onAuthLost: cloud?.onAuthLost,
  });
  const syncBadge = SYNC_BADGES[syncStatus];

  // Reloj para la rutina paso a paso (se calcula con marcas de tiempo, sobrevive a recargas)
  useEffect(() => {
    if (!stepSession || stepSession.pausedAt) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [stepSession]);

  useEffect(() => {
    if (!selectedRoutineId) return;
    const onKey = (e) => { if (e.key === 'Escape') setSelectedRoutineId(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedRoutineId]);

  // Speech Recognition Setup
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'es-ES';

      recognition.onresult = (event) => {
        let currentText = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          currentText += event.results[i][0].transcript;
        }
        setTaskInput(currentText);
      };

      recognition.onerror = (err) => {
        console.error('Speech recognition error:', err);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    }
  }, []);

  const toggleVoiceInput = () => {
    if (!recognitionRef.current) {
      alert('Tu navegador no soporta entrada de voz por SpeechRecognition. Usa Chrome o Edge.');
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch (e) {
        console.error(e);
      }
    }
  };

  // Timer logic
  useEffect(() => {
    if (isTimerRunning) {
      timerIntervalRef.current = setInterval(() => {
        setTimerSeconds(prev => prev + 1);
      }, 1000);
    } else if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
    }
    return () => clearInterval(timerIntervalRef.current);
  }, [isTimerRunning]);

  const startRoutineTimer = (routineId) => {
    if (activeTimerRoutineId === routineId && isTimerRunning) return;
    setActiveTimerRoutineId(routineId);
    setTimerSeconds(0);
    setIsTimerRunning(true);
  };

  const pauseRoutineTimer = () => {
    setIsTimerRunning(false);
  };

  const resumeRoutineTimer = () => {
    setIsTimerRunning(true);
  };

  const finishRoutineTimer = () => {
    if (!activeTimerRoutineId) return;
    const actualMinutes = Math.max(1, Math.round(timerSeconds / 60));
    
    // Log efficiency history into routines
    setRoutines(prev => prev.map(r => {
      if (r.id === activeTimerRoutineId) {
        return { ...r, actuals: [...(r.actuals || []), actualMinutes] };
      }
      return r;
    }));
    markRoutine(today, activeTimerRoutineId, actualMinutes);

    setIsTimerRunning(false);
    setActiveTimerRoutineId(null);
    setTimerSeconds(0);
  };

  // Rutinas con pasos se miden desde su checklist; las demás con el cronómetro general
  const handleMeasure = (routineId) => {
    const routine = routines.find(r => r.id === routineId);
    if (routine?.steps?.length) setSelectedRoutineId(routineId);
    else startRoutineTimer(routineId);
  };

  // --- STEP-BY-STEP ROUTINE ---
  const startStepSession = (routineId) => {
    if (stepSession && stepSession.routineId !== routineId && !confirm('Hay otra rutina en curso. ¿Descartarla e iniciar esta?')) return;
    const t = Date.now();
    setNow(t);
    setStepSession({ routineId, startedAt: t, lapStartedAt: t, pausedAt: null, done: {} });
  };

  // Al marcar un paso se le asigna el tiempo transcurrido desde el último paso marcado
  const toggleStep = (stepId) => {
    setStepSession(prev => {
      if (!prev || prev.pausedAt) return prev;
      if (prev.done[stepId] !== undefined) {
        const { [stepId]: _, ...rest } = prev.done;
        return { ...prev, done: rest };
      }
      const t = Date.now();
      return { ...prev, lapStartedAt: t, done: { ...prev.done, [stepId]: Math.round((t - prev.lapStartedAt) / 1000) } };
    });
  };

  const pauseStepSession = () => {
    setStepSession(prev => prev && !prev.pausedAt ? { ...prev, pausedAt: Date.now() } : prev);
  };

  const resumeStepSession = () => {
    const t = Date.now();
    setNow(t);
    setStepSession(prev => {
      if (!prev?.pausedAt) return prev;
      const shift = t - prev.pausedAt;
      return { ...prev, startedAt: prev.startedAt + shift, lapStartedAt: prev.lapStartedAt + shift, pausedAt: null };
    });
  };

  const finishStepSession = () => {
    if (!stepSession) return;
    const { routineId, done } = stepSession;
    const routine = routines.find(r => r.id === routineId);
    if (routine?.steps.length && routine.steps.every(s => done[s.id] !== undefined)) {
      const totalSec = routine.steps.reduce((acc, s) => acc + done[s.id], 0);
      markRoutine(today, routineId, Math.max(1, Math.round(totalSec / 60)));
    }
    setRoutines(prev => prev.map(r => {
      if (r.id !== routineId) return r;
      const steps = r.steps.map(s => done[s.id] !== undefined ? { ...s, actualsSec: [...(s.actualsSec || []), done[s.id]] } : s);
      // El total de la rutina solo cuenta si se completaron todos los pasos
      const allDone = r.steps.length > 0 && r.steps.every(s => done[s.id] !== undefined);
      const totalSec = r.steps.reduce((acc, s) => acc + (done[s.id] || 0), 0);
      return { ...r, steps, actuals: allDone ? [...(r.actuals || []), Math.max(1, Math.round(totalSec / 60))] : r.actuals };
    }));
    setStepSession(null);
  };

  const cancelStepSession = () => {
    if (confirm('¿Descartar los tiempos de esta rutina?')) setStepSession(null);
  };

  const addStep = (routineId, name) => {
    setRoutines(prev => prev.map(r => r.id === routineId
      ? { ...r, steps: [...(r.steps || []), { id: `s${Date.now()}`, name, actualsSec: [] }] }
      : r));
  };

  const deleteStep = (routineId, stepId) => {
    setRoutines(prev => prev.map(r => r.id === routineId ? { ...r, steps: r.steps.filter(s => s.id !== stepId) } : r));
  };

  const selectedRoutine = routines.find(r => r.id === selectedRoutineId);
  const sessionRoutine = stepSession ? routines.find(r => r.id === stepSession.routineId) : null;

  // --- HANDLERS ---
  const handleAddInboxTask = (e) => {
    e?.preventDefault();
    if (!taskInput.trim()) return;

    const newTask = {
      id: Date.now().toString(),
      title: taskInput.trim(),
      category: taskCategory,
      estimatedMin: Number(taskEstMin) || 15,
      createdAt: new Date().toISOString(),
      scheduledTime: null,
      completed: false
    };

    setInboxTasks([newTask, ...inboxTasks]);
    setTaskInput('');
    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
  };

  const handleToggleTaskComplete = (id) => {
    setInboxTasks(prev => prev.map(t => t.id === id
      ? { ...t, completed: !t.completed, completedAt: t.completed ? null : today }
      : t));
  };

  const handleScheduleTask = (id, date, time) => {
    setInboxTasks(prev => prev.map(t => t.id === id ? { ...t, scheduledDate: date, scheduledTime: time || null } : t));
  };

  const handleUnscheduleTask = (id) => {
    setInboxTasks(prev => prev.map(t => t.id === id ? { ...t, scheduledDate: null, scheduledTime: null } : t));
  };

  const handleDeleteTask = (id) => {
    setInboxTasks(prev => prev.filter(t => t.id !== id));
  };

  // --- REGISTRO DIARIO ---
  // minutes: minutos medidos (0 = marcado a mano), null = desmarcar
  function markRoutine(key, routineId, minutes) {
    setDayLog(prev => logRoutine(prev, key, routineId, minutes, routines, today));
  }

  const isRoutineDone = (key, routineId) => routineId in (dayLog[key]?.done ?? {});
  const toggleRoutineDone = (key, routineId) => {
    if (key > today) return;
    markRoutine(key, routineId, isRoutineDone(key, routineId) ? null : 0);
  };

  // Tareas sin fecha o con fecha vencida (no hechas)
  const isOverdue = (t) => !t.completed && t.scheduledDate && t.scheduledDate < today;
  const pendingTasks = inboxTasks.filter(t => !t.completed && (!t.scheduledDate || t.scheduledDate < today));

  // Calculate Days Elapsed
  const getDaysElapsed = (isoDateStr) => {
    const created = new Date(isoDateStr);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - created.getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  // --- PLAN DEL DÍA SELECCIONADO: bloques y horas según las rutinas de ese día ---
  const day = buildDayPlan(selectedDate, routines, fixedSchedule);
  const isToday = selectedDate === today;
  const canLog = selectedDate <= today;
  const dayTasks = inboxTasks
    .filter(t => t.scheduledDate === selectedDate)
    .sort((x, y) => (x.scheduledTime || '99').localeCompare(y.scheduledTime || '99'));
  const dayTasksPendingMins = dayTasks.filter(t => !t.completed).reduce((acc, t) => acc + t.estimatedMin, 0);
  const freeRoutinesMins = day.blocks.free.reduce((acc, r) => acc + r.estimatedMin, 0);
  const freeWindowStart = toHHMM(day.freeStartMin);
  const workMins = day.workMins;
  const wakeMin = day.wakeMin;
  const bedtimeMin = day.bedtimeMin;

  // Ocupación del día seleccionado: trabajo + rutinas que tocan + tareas programadas
  const calculateCapacity = () => {
    const totalMinutesInDay = (24 - fixedSchedule.sleepHours) * 60; // waking hours
    const nonNegotiableMins = day.active.filter(r => r.isNonNegotiable).reduce((acc, r) => acc + r.estimatedMin, 0);
    const optionalRoutinesMins = day.routineMins - nonNegotiableMins;
    const scheduledPendingMins = dayTasksPendingMins;

    const totalCommitted = workMins + nonNegotiableMins + optionalRoutinesMins + scheduledPendingMins;
    const freeMinutes = Math.max(0, totalMinutesInDay - totalCommitted);
    const percentUsed = Math.min(100, Math.round((totalCommitted / totalMinutesInDay) * 100));

    return { totalCommitted, freeMinutes, percentUsed, workMins, nonNegotiableMins, optionalRoutinesMins, scheduledPendingMins };
  };

  const capacity = calculateCapacity();
  const dayDoneCount = day.active.filter(r => isRoutineDone(selectedDate, r.id)).length + dayTasks.filter(t => t.completed).length;
  const dayTotalCount = day.active.length + dayTasks.length;

  // Fila de rutina en el cronograma: marcar como hecha + nombre (abre el detalle) + medir (solo hoy)
  const renderRoutineRow = (r, color) => {
    const done = isRoutineDone(selectedDate, r.id);
    const loggedMins = dayLog[selectedDate]?.done?.[r.id];
    return (
      <div key={r.id} className={`flex items-center justify-between gap-2 bg-slate-950/70 p-3 rounded-xl border ${done ? 'border-emerald-500/40' : 'border-slate-800'}`}>
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => toggleRoutineDone(selectedDate, r.id)}
            disabled={!canLog}
            className="shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
            title={canLog ? (done ? 'Desmarcar' : 'Marcar como hecha') : 'Día futuro'}
          >
            {done ? <CheckCircle className="w-5 h-5 text-emerald-400" /> : <Circle className="w-5 h-5 text-slate-600 hover:text-slate-400" />}
          </button>
          <div className="min-w-0">
            <button
              onClick={() => setSelectedRoutineId(r.id)}
              className={`font-semibold text-sm hover:text-indigo-300 transition flex items-center gap-1 text-left ${done ? 'text-slate-400' : 'text-slate-200'}`}
              title="Ver actividades de la rutina"
            >
              {r.name}
              <ChevronRight className="w-4 h-4 text-slate-500 shrink-0" />
            </button>
            <div className="flex flex-wrap items-center gap-2 mt-0.5">
              <span className="text-xs text-slate-400">{r.estimatedMin} min est.</span>
              {done && loggedMins > 0 && <span className="text-xs text-emerald-400">Hecha en {loggedMins} min</span>}
              {r.steps?.length > 0 && (
                <span className="text-xs text-slate-500 flex items-center gap-1">
                  <ListChecks className="w-3 h-3" /> {r.steps.length} pasos
                </span>
              )}
              {r.isNonNegotiable ? (
                <span className="text-[10px] text-amber-400/90 bg-amber-400/10 px-1.5 py-0.5 rounded">No negociable</span>
              ) : (
                <span className={`text-[10px] px-2 py-0.5 rounded border ${CATEGORY_COLORS[r.category] || 'border-slate-700 text-slate-400'}`}>
                  {r.category}
                </span>
              )}
            </div>
          </div>
        </div>
        {isToday && (
          <button
            onClick={() => handleMeasure(r.id)}
            className={`shrink-0 px-3 py-1.5 hover:text-white rounded-lg text-xs font-medium transition flex items-center gap-1.5 border ${MEASURE_BUTTON_STYLES[color]}`}
          >
            <Play className="w-3.5 h-3.5" />
            <span>Medir</span>
          </button>
        )}
      </div>
    );
  };

  const sectionClass = 'bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4 space-y-3';
  const sectionHeader = 'flex items-center justify-between border-b border-slate-800 pb-2';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      {/* --- HEADER --- */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-40 px-4 py-3">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-tr from-indigo-600 to-purple-600 p-2.5 rounded-xl text-white shadow-lg shadow-indigo-500/20">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-bold text-lg leading-tight tracking-wide text-white">MindFlow Agenda</h1>
              <p className="text-xs text-slate-400">Descarga mental, rutinas reales y control de tiempo</p>
              {cloud && syncBadge && (
                <div className="flex items-center gap-2 mt-0.5 text-[11px]">
                  <span className={`flex items-center gap-1 ${syncBadge.className}`} title={cloud.email}>
                    <syncBadge.Icon className={`w-3.5 h-3.5 ${syncBadge.spin ? 'animate-spin' : ''}`} />
                    {syncBadge.text}
                  </span>
                  <button
                    onClick={cloud.signOut}
                    className="flex items-center gap-1 text-slate-500 hover:text-slate-300"
                    title={`Cerrar sesión de ${cloud.email}`}
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    Salir
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* CAPACITY SUMMARY BADGE */}
          <div className="flex items-center gap-3 bg-slate-800/80 px-3.5 py-1.5 rounded-xl border border-slate-700/60 text-xs w-full sm:w-auto justify-between sm:justify-start">
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">Ocupación {isToday ? 'de hoy' : formatRelativeDay(selectedDate, today).toLowerCase()}</span>
              <span className={`font-bold ${capacity.percentUsed > 85 ? 'text-rose-400' : 'text-indigo-400'}`}>
                {Math.floor(capacity.totalCommitted / 60)}h {capacity.totalCommitted % 60}m ({capacity.percentUsed}%)
              </span>
            </div>
            <div className="h-6 w-px bg-slate-700" />
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">Tiempo Libre</span>
              <span className="font-bold text-emerald-400">
                {Math.floor(capacity.freeMinutes / 60)}h {capacity.freeMinutes % 60}m libre
              </span>
            </div>
          </div>
        </div>

        {/* NAVIGATION TABS */}
        <div className="max-w-6xl mx-auto flex items-center gap-1 mt-3 overflow-x-auto no-scrollbar pt-1">
          <button
            onClick={() => setActiveTab('timeline')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium transition-all shrink-0 ${
              activeTab === 'timeline'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Mi Día & Cronograma</span>
          </button>

          <button
            onClick={() => setActiveTab('inbox')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium transition-all relative shrink-0 ${
              activeTab === 'inbox'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Bandeja & Pendientes</span>
            {pendingTasks.length > 0 && (
              <span className="bg-rose-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                {pendingTasks.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('calendar')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium transition-all shrink-0 ${
              activeTab === 'calendar'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <CalendarCheck className="w-4 h-4" />
            <span>Calendario</span>
          </button>

          <button
            onClick={() => setActiveTab('analytics')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium transition-all shrink-0 ${
              activeTab === 'analytics'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <BarChart2 className="w-4 h-4" />
            <span>Eficiencia & Medidor</span>
          </button>

          <button
            onClick={() => setActiveTab('config')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium transition-all shrink-0 ${
              activeTab === 'config'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Mis Rutinas Base</span>
          </button>
        </div>
      </header>

      {/* --- MAIN CONTENT AREA --- */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-4 md:p-6 space-y-6">

        {/* STEP-BY-STEP ROUTINE IN PROGRESS */}
        {stepSession && sessionRoutine && !selectedRoutineId && (
          <button
            onClick={() => setSelectedRoutineId(stepSession.routineId)}
            className="w-full bg-gradient-to-r from-indigo-900/90 to-purple-900/90 border border-indigo-500/40 hover:border-indigo-400 rounded-2xl p-4 flex items-center justify-between gap-4 shadow-xl text-left transition"
          >
            <div className="flex items-center gap-3">
              <div className={`p-3 bg-indigo-600/40 rounded-xl ${stepSession.pausedAt ? '' : 'animate-pulse'}`}>
                <ListChecks className="w-6 h-6 text-indigo-300" />
              </div>
              <div>
                <span className="text-xs uppercase tracking-wider text-indigo-300 font-semibold block">
                  {stepSession.pausedAt ? 'Rutina en pausa' : 'Rutina en curso'} • {Object.keys(stepSession.done).length}/{sessionRoutine.steps.length} pasos
                </span>
                <h4 className="font-bold text-white text-base">{sessionRoutine.name}</h4>
              </div>
            </div>
            <span className="text-xs text-indigo-200 font-medium flex items-center gap-1 shrink-0">
              Abrir checklist <ChevronRight className="w-4 h-4" />
            </span>
          </button>
        )}

        {/* ACTIVE TIMER OVERLAY BAR IF RUNNING */}
        {activeTimerRoutineId && (
          <div className="bg-gradient-to-r from-indigo-900/90 to-purple-900/90 border border-indigo-500/40 rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-4 shadow-xl">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-indigo-600/40 rounded-xl animate-pulse">
                <Clock className="w-6 h-6 text-indigo-300" />
              </div>
              <div>
                <span className="text-xs uppercase tracking-wider text-indigo-300 font-semibold block">Cronómetro Activo</span>
                <h4 className="font-bold text-white text-base">
                  {routines.find(r => r.id === activeTimerRoutineId)?.name}
                </h4>
              </div>
            </div>

            <div className="flex items-center gap-6">
              <div className="font-mono text-3xl font-extrabold text-white tracking-widest bg-slate-950/60 px-4 py-1.5 rounded-xl border border-indigo-500/30">
                {formatTime(timerSeconds)}
              </div>

              <div className="flex items-center gap-2">
                {isTimerRunning ? (
                  <button
                    onClick={pauseRoutineTimer}
                    className="p-2.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 rounded-xl border border-amber-500/40 transition"
                    title="Pausar"
                  >
                    <Pause className="w-5 h-5" />
                  </button>
                ) : (
                  <button
                    onClick={resumeRoutineTimer}
                    className="p-2.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 rounded-xl border border-emerald-500/40 transition"
                    title="Continuar"
                  >
                    <Play className="w-5 h-5" />
                  </button>
                )}
                <button
                  onClick={finishRoutineTimer}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-xl text-xs flex items-center gap-2 transition shadow-lg shadow-emerald-600/20"
                >
                  <Square className="w-4 h-4" />
                  <span>Guardar Tiempo Real</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 1: CRONOGRAMA & DÍA A DÍA */}
        {activeTab === 'timeline' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* LEFT COLUMN: VISUAL DAY SCHEDULE (2 COLS) */}
            <div className="lg:col-span-2 space-y-4">
              {/* SELECTOR DE DÍA */}
              <div className="bg-slate-900 p-3 rounded-2xl border border-slate-800 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <button onClick={() => setSelectedDate(addDays(selectedDate, -7))} className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400" title="Semana anterior">
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <div className="text-center">
                    <h2 className="font-bold text-base text-white flex items-center justify-center gap-2">
                      <Calendar className="w-5 h-5 text-indigo-400" />
                      {formatDayLabel(selectedDate)}{isToday ? ' (hoy)' : ''}
                    </h2>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {day.isWorkDay ? 'Día de trabajo' : 'Día libre'}{day.hasGym ? ' • con gym' : ''} • {dayDoneCount} de {dayTotalCount} hechas
                      {' • '}<span className={capacity.percentUsed > 85 ? 'text-rose-400' : 'text-emerald-400'}>{capacity.percentUsed > 85 ? 'Saturado' : 'Equilibrado'}</span>
                    </p>
                  </div>
                  <button onClick={() => setSelectedDate(addDays(selectedDate, 7))} className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400" title="Semana siguiente">
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {Array.from({ length: 7 }, (_, i) => addDays(weekStart(selectedDate), i)).map(k => (
                    <button
                      key={k}
                      onClick={() => setSelectedDate(k)}
                      className={`py-1.5 rounded-lg text-center transition ${
                        k === selectedDate ? 'bg-indigo-600 text-white' : 'bg-slate-950 text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      <span className="block text-[10px] opacity-80">{WEEKDAYS.find(w => w.d === parseKey(k).getDay()).short}</span>
                      <span className={`block text-xs ${k === today ? 'font-extrabold underline underline-offset-2' : 'font-semibold'}`}>{parseKey(k).getDate()}</span>
                    </button>
                  ))}
                </div>
                {!isToday && (
                  <button onClick={() => setSelectedDate(today)} className="w-full text-xs text-indigo-400 hover:text-indigo-300">
                    Volver a hoy
                  </button>
                )}
              </div>

              {/* TIMELINE LIST */}
              <div className="space-y-3">
                {/* 1. AL DESPERTAR */}
                {day.blocks.wake.length > 0 && (
                  <div className={sectionClass}>
                    <div className={sectionHeader}>
                      <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                        <Sun className="w-4 h-4" /> {toHHMM(day.wakeMin)} - {toHHMM(day.hasGym ? day.leaveHomeMin : day.backHomeMin)} | AL DESPERTAR
                      </span>
                    </div>
                    {day.blocks.wake.map(r => renderRoutineRow(r, 'amber'))}
                  </div>
                )}

                {/* 2. GYM: TRASLADO + ENTRENAMIENTO */}
                {day.hasGym && (
                  <div className={sectionClass}>
                    <div className={sectionHeader}>
                      <span className="text-xs font-bold text-orange-400 flex items-center gap-1.5">
                        <Dumbbell className="w-4 h-4" /> {toHHMM(day.leaveHomeMin)} - {toHHMM(day.backHomeMin)} | GYM
                      </span>
                      <span className="text-[10px] bg-orange-500/20 text-orange-300 border border-orange-500/30 px-2 py-0.5 rounded-full font-medium">
                        Entrenas {fixedSchedule.gymStart} - {toHHMM(day.gymEndMin)}
                      </span>
                    </div>
                    {day.blocks.gym.map(r => renderRoutineRow(r, 'orange'))}
                  </div>
                )}

                {/* 3. MAÑANA EN CASA / ANTES DEL TRABAJO */}
                {day.blocks.home.length > 0 && (
                  <div className={sectionClass}>
                    <div className={sectionHeader}>
                      <span className="text-xs font-bold text-indigo-400 flex items-center gap-1.5">
                        <Clock className="w-4 h-4" /> {toHHMM(day.backHomeMin)} - {day.isWorkDay ? fixedSchedule.workStart : toHHMM(day.homeEndMin)} | {day.isWorkDay ? 'ANTES DEL TRABAJO' : 'MAÑANA EN CASA'}
                      </span>
                      {day.isWorkDay && (
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium border ${
                          day.homeMins > day.homeAvailableMins
                            ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                            : 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30'
                        }`}>
                          {day.homeMins} / {day.homeAvailableMins} min
                        </span>
                      )}
                    </div>
                    {day.blocks.home.map(r => renderRoutineRow(r, 'indigo'))}
                  </div>
                )}

                {/* 4. TRABAJO */}
                {day.isWorkDay && (
                  <div className="bg-sky-950/30 border border-sky-500/30 rounded-2xl p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-sky-400 flex items-center gap-1.5">
                        <Briefcase className="w-4 h-4" /> {fixedSchedule.workStart} - {fixedSchedule.workEnd} | TRABAJO
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-400">{formatDuration(workMins)}</span>
                        <span className="text-[10px] text-amber-400/90 bg-amber-400/10 px-1.5 py-0.5 rounded">No negociable</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* 5. TIEMPO LIBRE: rutinas de tiempo libre + tareas programadas para este día */}
                <div className="bg-gradient-to-r from-emerald-950/40 via-slate-900 to-slate-900 border border-dashed border-emerald-500/40 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold">
                      <Sparkles className="w-4 h-4" />
                      <span>{day.isWorkDay ? 'VENTANA LIBRE' : 'DÍA LIBRE'} ({freeWindowStart} - {toHHMM(day.nightStartMin)})</span>
                    </div>
                    <span className={`text-xs ${freeRoutinesMins + dayTasksPendingMins > day.freeWindowMins ? 'text-rose-400' : 'text-slate-400'}`}>
                      {Math.max(0, day.freeWindowMins - freeRoutinesMins - dayTasksPendingMins)} de {day.freeWindowMins} min disponibles
                    </span>
                  </div>

                  {day.blocks.free.map(r => renderRoutineRow(r, 'indigo'))}

                  {dayTasks.length === 0 ? (
                    <div className="text-center py-3 bg-slate-950/40 rounded-xl border border-slate-800/80 text-xs text-slate-500">
                      No hay pendientes programados para este día. Asígnale uno desde "Pendientes por programar".
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {dayTasks.map(task => (
                        <div key={task.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-950 p-3 rounded-xl border border-slate-800">
                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => handleToggleTaskComplete(task.id)}
                              className={`transition ${task.completed ? 'text-emerald-400' : 'text-slate-500 hover:text-emerald-400'}`}
                              title={task.completed ? 'Marcar como no hecha' : 'Marcar como hecha'}
                            >
                              {task.completed ? <CheckCircle className="w-5 h-5" /> : <Circle className="w-5 h-5" />}
                            </button>
                            <div>
                              <span className={`text-sm font-medium block ${task.completed ? 'line-through text-slate-500' : 'text-slate-200'}`}>{task.title}</span>
                              <div className="flex items-center gap-2 text-[11px] text-slate-400">
                                <span>{task.scheduledTime ? `${task.scheduledTime} hrs` : 'Sin hora'}</span>
                                <span>•</span>
                                <span>{task.estimatedMin} min</span>
                              </div>
                            </div>
                          </div>
                          {!task.completed && (
                            <div className="flex items-center gap-3 pl-8 sm:pl-0">
                              <TaskScheduler task={task} today={today} suggestedDate={selectedDate} onSchedule={handleScheduleTask} label="Mover" compact />
                              <button onClick={() => handleUnscheduleTask(task.id)} className="text-xs text-rose-400 hover:underline">
                                Quitar
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 6. LIMPIEZA DIARIA Y NOCHE */}
                {day.blocks.night.length > 0 && (
                  <div className={sectionClass}>
                    <div className={sectionHeader}>
                      <span className="text-xs font-bold text-purple-400 flex items-center gap-1.5">
                        <Home className="w-4 h-4" /> {toHHMM(day.nightStartMin)} - {toHHMM(day.familyStartMin)} | LIMPIEZA DIARIA Y NOCHE
                      </span>
                    </div>
                    {day.blocks.night.map(r => renderRoutineRow(r, 'purple'))}
                  </div>
                )}

                {/* 7. CONVIVENCIA */}
                {day.blocks.family.length > 0 && (
                  <div className="bg-pink-950/20 border border-pink-500/30 rounded-2xl p-4 space-y-3">
                    <div className={sectionHeader}>
                      <span className="text-xs font-bold text-pink-400 flex items-center gap-1.5">
                        <Heart className="w-4 h-4" /> {toHHMM(day.familyStartMin)} - {toHHMM(day.bedtimeMin)} | CONVIVENCIA CON ESPOSA
                      </span>
                    </div>
                    {day.blocks.family.map(r => renderRoutineRow(r, 'pink'))}
                  </div>
                )}

                {/* 8. DORMIR (según la hora de despertar del día siguiente) */}
                <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                      <Moon className="w-4 h-4" /> {toHHMM(day.bedtimeMin)} - {toHHMM(day.nextWakeMin)} | DORMIR
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-400">{formatDuration(fixedSchedule.sleepHours * 60)} de descanso</span>
                      <span className="text-[10px] text-amber-400/90 bg-amber-400/10 px-1.5 py-0.5 rounded">No negociable</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN: QUICK CAPTURE + SCHEDULE UNASSIGNED TASKS */}
            <div className="space-y-4">
              
              {/* VOICE / TEXT BRAIN DUMP WIDGET */}
              <div className="bg-gradient-to-b from-indigo-950/40 to-slate-900 p-4 rounded-2xl border border-indigo-500/30 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-sm text-white flex items-center gap-2">
                    <Mic className="w-4 h-4 text-indigo-400" />
                    Descarga Mental Rápida
                  </h3>
                  <span className="text-[10px] text-indigo-300 bg-indigo-500/20 px-2 py-0.5 rounded-full">Sin pensar fechas</span>
                </div>

                <form onSubmit={handleAddInboxTask} className="space-y-3">
                  <div className="relative">
                    <textarea
                      value={taskInput}
                      onChange={(e) => setTaskInput(e.target.value)}
                      placeholder={isListening ? "Escuchando... habla claramente..." : "Escribe o presiona el micrófono para hablar..."}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 resize-none h-20"
                    />
                    <button
                      type="button"
                      onClick={toggleVoiceInput}
                      className={`absolute right-3 bottom-3 p-2 rounded-xl transition ${
                        isListening
                          ? 'bg-rose-600 text-white animate-bounce'
                          : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                      }`}
                      title="Grabación por voz continua"
                    >
                      {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-slate-400 block mb-1">Categoría</label>
                      <select
                        value={taskCategory}
                        onChange={(e) => setTaskCategory(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                      >
                        <option value="Casa">Casa</option>
                        <option value="Mascotas">Mascotas</option>
                        <option value="Traslados">Traslados</option>
                        <option value="Trámites">Trámites</option>
                        <option value="Personal">Personal</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] text-slate-400 block mb-1">Duración Est.</label>
                      <select
                        value={taskEstMin}
                        onChange={(e) => setTaskEstMin(Number(e.target.value))}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                      >
                        <option value="10">10 min</option>
                        <option value="15">15 min</option>
                        <option value="20">20 min</option>
                        <option value="30">30 min</option>
                        <option value="45">45 min</option>
                        <option value="60">60 min</option>
                      </select>
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-xl text-xs flex items-center justify-center gap-2 transition shadow-lg shadow-indigo-600/20"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Guardar en Bandeja de Entrada</span>
                  </button>
                </form>
              </div>

              {/* PENDIENTES SIN FECHA O ATRASADOS */}
              <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-xs text-slate-300 uppercase tracking-wider">
                    Pendientes por programar ({pendingTasks.length})
                  </h3>
                  <span className="text-[10px] text-slate-500">Elige día y hora</span>
                </div>

                <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
                  {pendingTasks.length === 0 ? (
                    <p className="text-xs text-slate-500 text-center py-6">
                      ¡Tu mente está libre! No tienes pendientes sin fecha.
                    </p>
                  ) : (
                    pendingTasks.map(task => {
                      const daysOld = getDaysElapsed(task.createdAt);
                      return (
                        <div key={task.id} className={`bg-slate-950 p-3 rounded-xl border space-y-2 ${isOverdue(task) ? 'border-rose-500/40' : 'border-slate-800/80'}`}>
                          <div className="flex items-start justify-between gap-2">
                            <span className="text-xs text-slate-200 font-medium leading-snug">{task.title}</span>
                            <span className={`text-[9px] px-1.5 py-0.5 rounded border shrink-0 ${CATEGORY_COLORS[task.category]}`}>
                              {task.category}
                            </span>
                          </div>
                          {isOverdue(task) && (
                            <span className="text-[10px] text-rose-300 flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3" /> Atrasada: era para {formatRelativeDay(task.scheduledDate, today).toLowerCase()}
                            </span>
                          )}

                          <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] text-slate-400 pt-1 border-t border-slate-800/60">
                            <span className={daysOld > 3 ? 'text-amber-400 font-medium' : ''}>
                              {daysOld === 0 ? 'Creada hoy' : `Hace ${daysOld} d`} • {task.estimatedMin} min
                            </span>
                            <TaskScheduler
                              task={task}
                              today={today}
                              suggestedDate={selectedDate}
                              suggestedTime={freeWindowStart}
                              onSchedule={handleScheduleTask}
                              label={isOverdue(task) ? 'Reprogramar' : 'Programar'}
                              compact
                            />
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

            </div>

          </div>
        )}

        {/* TAB 2: BANDEJA DE ENTRADA & DESCARGA MENTAL */}
        {activeTab === 'inbox' && (
          <div className="space-y-6">
            
            <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Layers className="w-5 h-5 text-indigo-400" />
                  Bandeja de Entrada Integral
                </h2>
                <p className="text-xs text-slate-400 mt-1 max-w-xl">
                  Descarga todo lo que se rompa, trámites que surjan o ideas sin estresarte por cuándo lo harás. Controla el tiempo transcurrido desde que nació cada tarea.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={toggleVoiceInput}
                  className={`px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition ${
                    isListening
                      ? 'bg-rose-600 text-white animate-pulse'
                      : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                  }`}
                >
                  <Mic className="w-4 h-4" />
                  <span>{isListening ? 'Grabando Audio...' : 'Dictar por Voz'}</span>
                </button>
              </div>
            </div>

            {/* FULL INBOX LIST TABLE / CARDS */}
            <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
              <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                <h3 className="font-bold text-sm text-slate-200">
                  Todas las Tareas Registradas ({inboxTasks.length})
                </h3>
              </div>

              <div className="divide-y divide-slate-800">
                {inboxTasks.length === 0 ? (
                  <div className="p-8 text-center text-slate-500 text-sm">
                    No hay tareas en tu bandeja de entrada.
                  </div>
                ) : (
                  inboxTasks.map(task => {
                    const daysOld = getDaysElapsed(task.createdAt);
                    return (
                      <div key={task.id} className={`p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 transition ${task.completed ? 'opacity-50 bg-slate-950/40' : 'hover:bg-slate-850/50'}`}>
                        
                        <div className="flex items-start gap-3 flex-1">
                          <button
                            onClick={() => handleToggleTaskComplete(task.id)}
                            className={`mt-0.5 transition ${task.completed ? 'text-emerald-400' : 'text-slate-600 hover:text-slate-400'}`}
                          >
                            <CheckCircle className="w-5 h-5" />
                          </button>
                          <div>
                            <span className={`text-sm font-medium text-slate-200 block ${task.completed ? 'line-through text-slate-500' : ''}`}>
                              {task.title}
                            </span>
                            <div className="flex items-center gap-2 mt-1">
                              <span className={`text-[10px] px-2 py-0.5 rounded border ${CATEGORY_COLORS[task.category]}`}>
                                {task.category}
                              </span>
                              <span className="text-xs text-slate-400">
                                Est: {task.estimatedMin} min
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* ELAPSED TIME & ACTIONS */}
                        <div className="flex items-center gap-4 justify-between md:justify-end text-xs">
                          <div className="text-left md:text-right">
                            <span className="text-[10px] text-slate-500 block uppercase">Antigüedad</span>
                            <span className={`font-semibold ${daysOld > 4 ? 'text-amber-400' : 'text-slate-300'}`}>
                              {daysOld === 0 ? 'Creada hoy' : `${daysOld} días transcurridos`}
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            {task.completed ? (
                              task.completedAt && (
                                <span className="text-xs text-emerald-400/80">Hecha: {formatRelativeDay(task.completedAt, today).toLowerCase()}</span>
                              )
                            ) : task.scheduledDate ? (
                              <>
                                <button
                                  onClick={() => { setSelectedDate(task.scheduledDate); setActiveTab('timeline'); }}
                                  className={`px-2.5 py-1 rounded-lg text-xs font-medium border ${isOverdue(task)
                                    ? 'bg-rose-500/10 text-rose-300 border-rose-500/30'
                                    : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'}`}
                                  title="Ver ese día"
                                >
                                  {isOverdue(task) ? 'Atrasada: ' : 'Agenda: '}
                                  {formatRelativeDay(task.scheduledDate, today)}{task.scheduledTime ? ` ${task.scheduledTime}` : ''}
                                </button>
                                <TaskScheduler task={task} today={today} suggestedDate={selectedDate} onSchedule={handleScheduleTask} label="Mover" compact />
                              </>
                            ) : (
                              <TaskScheduler task={task} today={today} suggestedDate={selectedDate} suggestedTime={freeWindowStart} onSchedule={handleScheduleTask} />
                            )}

                            <button
                              onClick={() => handleDeleteTask(task.id)}
                              className="p-1.5 text-slate-500 hover:text-rose-400 transition rounded-lg hover:bg-slate-800"
                              title="Eliminar"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                      </div>
                    );
                  })
                )}
              </div>
            </div>

          </div>
        )}

        {/* TAB: CALENDARIO DE CUMPLIMIENTO */}
        {activeTab === 'calendar' && (
          <CalendarView
            routines={routines}
            tasks={inboxTasks}
            dayLog={dayLog}
            today={today}
            onToggleRoutine={toggleRoutineDone}
            onToggleTask={handleToggleTaskComplete}
            onOpenDay={(key) => { setSelectedDate(key); setActiveTab('timeline'); }}
          />
        )}

        {/* TAB 3: ANALÍTICA Y EFICIENCIA DE TIEMPO REAL */}
        {activeTab === 'analytics' && (
          <div className="space-y-6">
            
            <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <BarChart2 className="w-5 h-5 text-indigo-400" />
                Análisis de Tiempos Reales vs Estimados
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Ajusta tus bloques de tiempo comparando cuánto crees que tardas versus cuánto te toma realmente medir la rutina con el cronómetro.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {routines.map(routine => {
                const actuals = routine.actuals || [];
                const avgActual = actuals.length > 0
                  ? Math.round(actuals.reduce((a, b) => a + b, 0) / actuals.length)
                  : routine.estimatedMin;

                const diff = avgActual - routine.estimatedMin;

                return (
                  <div key={routine.id} className="bg-slate-900 p-5 rounded-2xl border border-slate-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm text-slate-200">{routine.name}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded border ${CATEGORY_COLORS[routine.category]}`}>
                        {routine.category}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 bg-slate-950 p-3 rounded-xl text-center border border-slate-800/80">
                      <div>
                        <span className="text-[10px] text-slate-500 block uppercase">Estimado</span>
                        <span className="font-bold text-slate-300 text-sm">{routine.estimatedMin} min</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 block uppercase">Promedio Real</span>
                        <span className="font-bold text-indigo-400 text-sm">{avgActual} min</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 block uppercase">Diferencia</span>
                        <span className={`font-bold text-sm ${diff > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                          {diff > 0 ? `+${diff} min` : `${diff} min`}
                        </span>
                      </div>
                    </div>

                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      {diff > 5
                        ? '💡 Sugerencia: Estás subestimando esta rutina. Aumenta el bloque en tu cronograma para no saturar tu día.'
                        : diff < -5
                        ? '✨ Excelente: Completas esta actividad más rápido de lo pensado. Puedes liberar tiempo.'
                        : '🎯 Tiempo muy preciso. Tu estimación refleja la realidad.'}
                    </p>

                    {routine.steps?.some(s => s.actualsSec?.length) && (
                      <div className="border-t border-slate-800 pt-3 space-y-1.5">
                        <span className="text-[10px] text-slate-500 block uppercase">Promedio por actividad</span>
                        {routine.steps.map(s => (
                          <div key={s.id} className="flex items-center justify-between text-xs">
                            <span className="text-slate-300">{s.name}</span>
                            <span className="font-mono text-indigo-300">
                              {s.actualsSec?.length ? formatTime(averageSecs(s.actualsSec)) : '—'}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

          </div>
        )}

        {/* TAB 4: CONFIGURACIÓN DE RUTINAS BASE */}
        {activeTab === 'config' && (
          <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 space-y-6">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-indigo-400" />
                Rutinas Base Configurables
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Ajusta las actividades fijas de tu día a día (Higiene, Mascotas, Comida, Limpieza Superficial vs Profunda).
              </p>
            </div>

            {/* FIXED SCHEDULE: WORK & SLEEP */}
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-sky-400" />
                Horario fijo: trabajo y sueño
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                {[
                  ['workStart', 'Entrada al trabajo'],
                  ['workEnd', 'Salida del trabajo'],
                  ['gymStart', 'Empiezo a entrenar'],
                  ['restWake', 'Despertar en días libres']
                ].map(([key, label]) => (
                  <label key={key} className="text-[10px] text-slate-400 block">
                    {label}
                    <input
                      type="time"
                      value={fixedSchedule[key]}
                      onChange={(e) => e.target.value && setFixedSchedule(prev => ({ ...prev, [key]: e.target.value }))}
                      className="mt-1 w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 [color-scheme:dark]"
                    />
                  </label>
                ))}
                <label className="text-[10px] text-slate-400 block">
                  Horas de sueño
                  <select
                    value={fixedSchedule.sleepHours}
                    onChange={(e) => setFixedSchedule(prev => ({ ...prev, sleepHours: Number(e.target.value) }))}
                    className="mt-1 w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                  >
                    {[6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10].map(h => (
                      <option key={h} value={h}>{formatDuration(h * 60)}</option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] text-slate-400">Días de trabajo:</span>
                <DayToggles
                  days={fixedSchedule.workDays}
                  onChange={(workDays) => setFixedSchedule(prev => ({ ...prev, workDays }))}
                />
              </div>
              <p className="text-[11px] text-slate-500">
                {formatDayLabel(selectedDate)}: te despiertas a las {toHHMM(wakeMin)} y te duermes a las {toHHMM(bedtimeMin)}.
                Los días con gym la hora de despertar sale de la hora de entrenar; los días de trabajo sin gym, de la entrada al trabajo;
                los días libres, de "Despertar en días libres". La hora de dormir depende de a qué hora toca despertar al día siguiente.
              </p>
            </div>

            <div className="space-y-3">
              {routines.map(routine => (
                <div key={routine.id} className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div>
                      <span className="font-semibold text-sm text-slate-200 block">{routine.name}</span>
                      <span className="text-xs text-slate-500">Categoría: {routine.category}</span>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
                      <button
                        onClick={() => setSelectedRoutineId(routine.id)}
                        className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-lg text-xs text-indigo-300 font-medium flex items-center gap-1.5 transition"
                      >
                        <ListChecks className="w-3.5 h-3.5" />
                        <span>Pasos ({routine.steps?.length || 0})</span>
                      </button>

                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-slate-400">Minutos:</span>
                        <input
                          type="number"
                          value={routine.estimatedMin}
                          onChange={(e) => {
                            const val = parseInt(e.target.value, 10) || 0;
                            setRoutines(prev => prev.map(r => r.id === routine.id ? { ...r, estimatedMin: val } : r));
                          }}
                          className="w-16 bg-slate-900 border border-slate-700 rounded-lg p-1.5 text-xs text-center font-bold text-indigo-300"
                        />
                      </div>

                      <label className="flex items-center gap-1.5 text-xs text-slate-400 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={routine.isNonNegotiable}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            setRoutines(prev => prev.map(r => r.id === routine.id ? { ...r, isNonNegotiable: checked } : r));
                          }}
                          className="rounded border-slate-700 text-indigo-600 focus:ring-0"
                        />
                        <span>No negociable</span>
                      </label>

                      {!DEFAULT_ROUTINE_IDS.has(routine.id) && (
                        <button
                          onClick={() => window.confirm(`¿Eliminar "${routine.name}"? Su historial en el calendario se conserva.`)
                            && setRoutines(prev => prev.filter(r => r.id !== routine.id))}
                          className="p-1.5 text-slate-500 hover:text-rose-400 transition rounded-lg hover:bg-slate-800"
                          title="Eliminar rutina"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-2 border-t border-slate-800/70">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-slate-400">Días:</span>
                      <DayToggles
                        days={routine.days}
                        onChange={(days) => setRoutines(prev => prev.map(r => r.id === routine.id ? { ...r, days } : r))}
                      />
                    </div>
                    <label className="flex items-center gap-2 text-[10px] text-slate-400">
                      Bloque:
                      <select
                        value={routine.block}
                        onChange={(e) => {
                          const block = e.target.value;
                          setRoutines(prev => prev.map(r => r.id === routine.id ? { ...r, block } : r));
                        }}
                        className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-slate-200"
                      >
                        {Object.entries(BLOCKS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                      </select>
                    </label>
                    {routine.days.length === 0 && <span className="text-[10px] text-amber-400">Sin días: no aparece en ningún día</span>}
                  </div>
                </div>
              ))}
            </div>

            <AddRoutineForm
              categories={Object.keys(CATEGORY_COLORS)}
              onAdd={(routine) => setRoutines(prev => [...prev, routine])}
            />
          </div>
        )}

      </main>

      {selectedRoutine && (
        <RoutineDetail
          routine={selectedRoutine}
          session={stepSession?.routineId === selectedRoutine.id ? stepSession : null}
          now={now}
          isOtherSessionActive={!!stepSession && stepSession.routineId !== selectedRoutine.id}
          onClose={() => setSelectedRoutineId(null)}
          onStart={() => startStepSession(selectedRoutine.id)}
          onToggleStep={toggleStep}
          onPause={pauseStepSession}
          onResume={resumeStepSession}
          onFinish={finishStepSession}
          onCancel={cancelStepSession}
          onAddStep={(name) => addStep(selectedRoutine.id, name)}
          onDeleteStep={(stepId) => deleteStep(selectedRoutine.id, stepId)}
        />
      )}
    </div>
  );
}

// --- DETALLE DE RUTINA: CHECKLIST DE ACTIVIDADES CON TIEMPO POR PASO ---
function RoutineDetail({ routine, session, now, isOtherSessionActive, onClose, onStart, onToggleStep, onPause, onResume, onFinish, onCancel, onAddStep, onDeleteStep }) {
  const [newStepName, setNewStepName] = useState('');

  const steps = routine.steps || [];
  const done = session?.done || {};
  const doneCount = steps.filter(s => done[s.id] !== undefined).length;
  const allDone = steps.length > 0 && doneCount === steps.length;
  const currentStep = session ? steps.find(s => done[s.id] === undefined) : null;
  const clock = session?.pausedAt || now;
  const lapSecs = session ? Math.max(0, Math.floor((clock - session.lapStartedAt) / 1000)) : 0;
  const totalSecs = session ? Math.max(0, Math.floor((clock - session.startedAt) / 1000)) : 0;
  const doneSecs = steps.reduce((acc, s) => acc + (done[s.id] || 0), 0);
  const avgTotalSecs = steps.reduce((acc, s) => acc + (averageSecs(s.actualsSec) || 0), 0);

  const handleAdd = (e) => {
    e.preventDefault();
    if (!newStepName.trim()) return;
    onAddStep(newStepName.trim());
    setNewStepName('');
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* HEADER */}
        <div className="p-5 border-b border-slate-800 flex items-start justify-between gap-3">
          <div>
            <h2 className="font-bold text-base text-white flex items-center gap-2">
              <ListChecks className="w-5 h-5 text-indigo-400" />
              {routine.name}
            </h2>
            <div className="flex flex-wrap items-center gap-2 mt-1.5 text-xs text-slate-400">
              <span className={`text-[10px] px-2 py-0.5 rounded border ${CATEGORY_COLORS[routine.category]}`}>
                {routine.category}
              </span>
              <span>{steps.length} pasos</span>
              <span>•</span>
              <span>{routine.estimatedMin} min est.</span>
              {avgTotalSecs > 0 && (
                <>
                  <span>•</span>
                  <span className="text-indigo-300">Real por pasos: {formatTime(avgTotalSecs)}</span>
                </>
              )}
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition" title="Cerrar">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* SESSION CONTROLS */}
          {session ? (
            <div className="bg-gradient-to-r from-indigo-900/80 to-purple-900/80 border border-indigo-500/40 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <span className="text-[10px] uppercase tracking-wider text-indigo-300 font-semibold block">
                    {allDone ? 'Rutina completa' : session.pausedAt ? 'En pausa' : 'Actividad actual'}
                  </span>
                  <span className="font-semibold text-sm text-white block truncate">
                    {currentStep ? currentStep.name : '¡Terminaste todas las actividades!'}
                  </span>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-mono text-2xl font-extrabold text-white tracking-wider">
                    {formatTime(allDone ? doneSecs : lapSecs)}
                  </div>
                  <span className="text-[10px] text-indigo-300">
                    {allDone ? 'Tiempo total' : `Total ${formatTime(totalSecs)}`}
                  </span>
                </div>
              </div>

              <div className="h-1.5 bg-slate-950/60 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-400 transition-all" style={{ width: `${steps.length ? (doneCount / steps.length) * 100 : 0}%` }} />
              </div>

              <div className="flex items-center gap-2">
                {!allDone && (session.pausedAt ? (
                  <button onClick={onResume} className="p-2.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 rounded-xl border border-emerald-500/40 transition" title="Continuar">
                    <Play className="w-4 h-4" />
                  </button>
                ) : (
                  <button onClick={onPause} className="p-2.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 rounded-xl border border-amber-500/40 transition" title="Pausar">
                    <Pause className="w-4 h-4" />
                  </button>
                ))}
                <button
                  onClick={onFinish}
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-xl text-xs flex items-center justify-center gap-2 transition shadow-lg shadow-emerald-600/20"
                >
                  <Square className="w-4 h-4" />
                  <span>{allDone ? 'Guardar tiempos' : `Terminar y guardar (${doneCount}/${steps.length})`}</span>
                </button>
                <button onClick={onCancel} className="px-3 py-2.5 text-xs text-rose-300 hover:bg-rose-500/10 rounded-xl transition">
                  Descartar
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <button
                onClick={onStart}
                disabled={steps.length === 0}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold rounded-xl text-sm flex items-center justify-center gap-2 transition shadow-lg shadow-indigo-600/20"
              >
                <Play className="w-4 h-4" />
                <span>Iniciar rutina</span>
              </button>
              {isOtherSessionActive && (
                <p className="text-[11px] text-amber-400">Hay otra rutina en curso; si inicias esta, se descartará.</p>
              )}
              <p className="text-[11px] text-slate-500">
                Al iniciar corre el cronómetro. Cada vez que marcas una actividad se guarda lo que tardaste desde la anterior.
              </p>
            </div>
          )}

          {/* STEP CHECKLIST */}
          {steps.length === 0 ? (
            <div className="text-center py-6 bg-slate-950/40 rounded-xl border border-dashed border-slate-800 text-xs text-slate-500">
              Esta rutina aún no tiene actividades. Agrega la primera abajo.
            </div>
          ) : (
            <ol className="space-y-2">
              {steps.map((step, i) => {
                const isDone = done[step.id] !== undefined;
                const isCurrent = currentStep?.id === step.id;
                const avg = averageSecs(step.actualsSec);
                return (
                  <li
                    key={step.id}
                    className={`flex items-center gap-3 p-3 rounded-xl border transition ${
                      isDone
                        ? 'bg-emerald-950/30 border-emerald-500/30'
                        : isCurrent
                        ? 'bg-indigo-950/50 border-indigo-500/50'
                        : 'bg-slate-950/70 border-slate-800'
                    }`}
                  >
                    <button
                      onClick={() => onToggleStep(step.id)}
                      disabled={!session || !!session.pausedAt}
                      className={`shrink-0 transition disabled:cursor-not-allowed ${
                        isDone ? 'text-emerald-400' : session && !session.pausedAt ? 'text-slate-500 hover:text-emerald-400' : 'text-slate-700'
                      }`}
                      title={session ? 'Marcar actividad' : 'Inicia la rutina para marcar actividades'}
                    >
                      {isDone ? <CheckCircle className="w-6 h-6" /> : <Circle className="w-6 h-6" />}
                    </button>

                    <div className="flex-1 min-w-0">
                      <span className={`text-sm font-medium block ${isDone ? 'text-slate-400 line-through' : 'text-slate-200'}`}>
                        {i + 1}. {step.name}
                      </span>
                      <span className="text-[11px] text-slate-500">
                        {avg !== null ? `Promedio ${formatTime(avg)} • ${step.actualsSec.length} ${step.actualsSec.length === 1 ? 'vez' : 'veces'}` : 'Sin mediciones aún'}
                      </span>
                    </div>

                    {isDone ? (
                      <span className="font-mono text-sm font-bold text-emerald-400">{formatTime(done[step.id])}</span>
                    ) : isCurrent ? (
                      <span className={`font-mono text-sm font-bold text-indigo-300 ${session.pausedAt ? '' : 'animate-pulse'}`}>
                        {formatTime(lapSecs)}
                      </span>
                    ) : !session && (
                      <button
                        onClick={() => onDeleteStep(step.id)}
                        className="p-1.5 text-slate-600 hover:text-rose-400 rounded-lg hover:bg-slate-800 transition"
                        title="Eliminar actividad"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </li>
                );
              })}
            </ol>
          )}

          {/* ADD STEP */}
          {session ? (
            <p className="text-[11px] text-slate-500">
              Si terminas sin marcar todas, solo se guardan los tiempos de las actividades marcadas.
            </p>
          ) : (
            <form onSubmit={handleAdd} className="flex gap-2">
              <input
                value={newStepName}
                onChange={(e) => setNewStepName(e.target.value)}
                placeholder="Agregar actividad (ej. Cepillarse los dientes)"
                className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
              <button type="submit" className="px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl transition" title="Agregar actividad">
                <Plus className="w-4 h-4" />
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

// --- SELECTOR DE DÍAS DE LA SEMANA (L M M J V S D) ---
function DayToggles({ days, onChange }) {
  const toggle = (d) => onChange(days.includes(d) ? days.filter(x => x !== d) : [...days, d].sort());
  return (
    <div className="flex gap-1">
      {WEEKDAYS.map(w => (
        <button
          key={w.d}
          type="button"
          onClick={() => toggle(w.d)}
          title={w.name}
          className={`w-6 h-6 rounded-md text-[10px] font-bold transition ${
            days.includes(w.d) ? 'bg-indigo-600 text-white' : 'bg-slate-900 text-slate-500 border border-slate-700 hover:text-slate-300'
          }`}
        >
          {w.short}
        </button>
      ))}
    </div>
  );
}

// --- NUEVA RUTINA PROPIA (por ejemplo, actividades del fin de semana) ---
function AddRoutineForm({ categories, onAdd }) {
  const [name, setName] = useState('');
  const [minutes, setMinutes] = useState(30);
  const [category, setCategory] = useState(categories[0]);
  const [block, setBlock] = useState('free');
  const [days, setDays] = useState([6, 0]);

  const submit = (e) => {
    e.preventDefault();
    if (!name.trim() || days.length === 0) return;
    onAdd({
      id: `c${Date.now()}`, name: name.trim(), category, estimatedMin: Number(minutes) || 15,
      actuals: [], isNonNegotiable: false, type: 'custom', steps: [], block, days,
    });
    setName('');
  };

  const field = 'bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-200';
  return (
    <form onSubmit={submit} className="bg-slate-950 p-4 rounded-xl border border-dashed border-indigo-500/40 space-y-3">
      <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
        <Plus className="w-4 h-4 text-indigo-400" /> Nueva rutina
      </span>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Ej. Súper y comidas de la semana" className={`${field} col-span-2`} />
        <select value={category} onChange={e => setCategory(e.target.value)} className={field}>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <label className="flex items-center gap-1.5 text-xs text-slate-400">
          <input type="number" min={5} value={minutes} onChange={e => setMinutes(Number(e.target.value))} className={`${field} w-16 text-center`} /> min
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-slate-400">Días:</span>
          <DayToggles days={days} onChange={setDays} />
        </div>
        <label className="flex items-center gap-2 text-[10px] text-slate-400">
          Bloque:
          <select value={block} onChange={e => setBlock(e.target.value)} className={field}>
            {Object.entries(BLOCKS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </select>
        </label>
        <button type="submit" disabled={!name.trim() || days.length === 0}
          className="ml-auto px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg text-xs font-semibold">
          Agregar rutina
        </button>
      </div>
    </form>
  );
}
