import React, { useState, useEffect, useRef } from 'react';
import { 
  Plus, Mic, MicOff, Play, Square, Check, Clock, Calendar, 
  Trash2, ShieldAlert, Sparkles, Download, Upload, AlertCircle, RefreshCw 
} from 'lucide-react';

// Datos iniciales de demostración
const initialData = {
  routines: [
    { id: 'r1', name: 'Rutina Mañana e Higiene', category: 'Personal', estimatedMin: 45, actualHistory: [40, 50, 45] },
    { id: 'r2', name: 'Desayuno y Preparación', category: 'Personal', estimatedMin: 30, actualHistory: [30, 35] },
    { id: 'r3', name: 'Atención Mascotas (Alimentación y Limpieza)', category: 'Mascotas', estimatedMin: 25, actualHistory: [25, 30] },
    { id: 'r4', name: 'Trayecto Gym en Camión (Ida y Vuelta)', category: 'Transporte', estimatedMin: 50, actualHistory: [60, 55] },
    { id: 'r5', name: 'Limpieza Superficial Diaria', category: 'Hogar', estimatedMin: 20, actualHistory: [20, 25] },
    { id: 'r6', name: 'Limpieza Profunda (Fin de Semana)', category: 'Hogar', estimatedMin: 120, actualHistory: [110, 130] }
  ],
  backlog: [
    { id: 'b1', title: 'Cambiar foco descompuesto', category: 'Mantenimiento', estimatedMin: 15, createdAt: new Date(Date.now() - 3 * 86400000).toISOString() },
    { id: 'b2', title: 'Pagar recibos y facturas de servicios', category: 'Finanzas', estimatedMin: 10, createdAt: new Date(Date.now() - 7 * 86400000).toISOString() },
    { id: 'b3', title: 'Comprar alimento y arena para mascotas', category: 'Mascotas', estimatedMin: 40, createdAt: new Date(Date.now() - 1 * 86400000).toISOString() }
  ],
  daySchedule: [
    { id: 's1', title: 'Rutina de Mañana & Higiene', start: '07:00', end: '08:30', isFixed: true },
    { id: 's2', title: 'Atención a Mascotas', start: '08:30', end: '09:00', isFixed: true },
    { id: 's3', title: 'Bloque de Trabajo / Productividad', start: '09:00', end: '13:30', isFixed: true },
    { id: 's4', title: 'Comida y Descanso', start: '13:30', end: '14:30', isFixed: true },
    { id: 's5', title: 'Bloque de Trabajo / Continuación', start: '14:30', end: '18:30', isFixed: true },
    { id: 's6', title: 'Limpieza Superficial Diaria', start: '18:30', end: '19:00', isFixed: false },
    { id: 's7', title: 'Ventana Libre (Ocio o Pendiente Suelto)', start: '19:00', end: '20:00', isFreeSlot: true },
    { id: 's8', title: 'Cena & Preparación Nocturna', start: '20:00', end: '21:00', isFixed: true },
    { id: 's9', title: 'Rutina para Dormir', start: '22:00', end: '23:00', isFixed: true }
  ]
};

export default function App() {
  const [data, setData] = useState(() => {
    const saved = localStorage.getItem('mindflow_data');
    return saved ? JSON.parse(saved) : initialData;
  });

  const [activeTab, setActiveTab] = useState('inbox'); // inbox | routines | schedule
  const [isRecording, setIsRecording] = useState(false);
  const [taskText, setTaskText] = useState('');
  const [taskCategory, setTaskCategory] = useState('General');
  const [taskEst, setTaskEst] = useState(15);

  // Estado para el Cronómetro de Eficiencia
  const [activeTimerId, setActiveTimerId] = useState(null);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const timerRef = useRef(null);

  // Guardar en localStorage
  useEffect(() => {
    localStorage.setItem('mindflow_data', JSON.stringify(data));
  }, [data]);

  // Manejador de Reconocimiento de Voz (Web Speech API)
  const toggleSpeechRecognition = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert('Tu navegador no soporta el reconocimiento de voz nativo. Prueba con Google Chrome.');
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();

    recognition.lang = 'es-MX';
    recognition.continuous = false;
    recognition.interimResults = false;

    if (!isRecording) {
      setIsRecording(true);
      recognition.start();

      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        setTaskText((prev) => (prev ? `${prev} ${transcript}` : transcript));
        setIsRecording(false);
      };

      recognition.onerror = () => setIsRecording(false);
      recognition.onend = () => setIsRecording(false);
    } else {
      setIsRecording(false);
    }
  };

  // Agregar nuevo pendiente al Backlog
  const handleAddBacklogItem = (e) => {
    e?.preventDefault();
    if (!taskText.trim()) return;

    const newItem = {
      id: `b_${Date.now()}`,
      title: taskText,
      category: taskCategory,
      estimatedMin: Number(taskEst) || 15,
      createdAt: new Date().toISOString()
    };

    setData((prev) => ({
      ...prev,
      backlog: [newItem, ...prev.backlog]
    }));

    setTaskText('');
  };

  // Eliminar pendiente
  const handleDeleteBacklog = (id) => {
    setData((prev) => ({
      ...prev,
      backlog: prev.backlog.filter((item) => item.id !== id)
    }));
  };

  // Cronómetro
  const startTimer = (routineId) => {
    setActiveTimerId(routineId);
    setTimerSeconds(0);
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimerSeconds((prev) => prev + 1);
    }, 1000);
  };

  const stopTimerAndSave = (routineId) => {
    clearInterval(timerRef.current);
    const recordedMin = Math.max(1, Math.round(timerSeconds / 60));

    setData((prev) => ({
      ...prev,
      routines: prev.routines.map((r) => {
        if (r.id === routineId) {
          return { ...r, actualHistory: [...(r.actualHistory || []), recordedMin] };
        }
        return r;
      })
    }));

    setActiveTimerId(null);
    setTimerSeconds(0);
  };

  // Calcular Días Transcurridos
  const getDaysElapsed = (isoString) => {
    const diffTime = Math.abs(new Date() - new Date(isoString));
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  // Calcular Promedio Real de Rutina
  const getAverageTime = (history) => {
    if (!history || history.length === 0) return 0;
    const sum = history.reduce((acc, curr) => acc + curr, 0);
    return Math.round(sum / history.length);
  };

  // Exportar JSON
  const handleExportJSON = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(data, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `mindflow_backup_${new Date().toISOString().slice(0,10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Importar JSON
  const handleImportJSON = (e) => {
    const fileReader = new FileReader();
    fileReader.readAsText(e.target.files[0], "UTF-8");
    fileReader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target.result);
        if (parsed.routines && parsed.backlog && parsed.daySchedule) {
          setData(parsed);
          alert('¡Rutinas y pendientes cargados exitosamente!');
        } else {
          alert('El archivo JSON no tiene la estructura correcta.');
        }
      } catch (err) {
        alert('Error al leer el archivo JSON.');
      }
    };
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans p-4 md:p-8">
      {/* Encabezado */}
      <header className="max-w-5xl mx-auto mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-teal-300 bg-clip-text text-transparent flex items-center gap-2">
            <Sparkles className="text-teal-400" /> MindFlow Agenda
          </h1>
          <p className="text-slate-400 text-sm mt-1">Libera tu mente, afina tiempos reales y controla tus días.</p>
        </div>

        {/* Acciones para JSON */}
        <div className="flex items-center gap-3">
          <button 
            onClick={handleExportJSON}
            className="flex items-center gap-2 text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-2 rounded-lg border border-slate-700 transition"
            title="Exportar copia de seguridad en JSON"
          >
            <Download size={14} /> Respaldar JSON
          </button>
          <label className="flex items-center gap-2 text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-2 rounded-lg border border-slate-700 cursor-pointer transition">
            <Upload size={14} /> Cargar JSON
            <input type="file" accept=".json" onChange={handleImportJSON} className="hidden" />
          </label>
        </div>
      </header>

      {/* Navegación por pestañas */}
      <div className="max-w-5xl mx-auto mb-6 flex border-b border-slate-800">
        <button
          onClick={() => setActiveTab('inbox')}
          className={`px-4 py-3 text-sm font-medium border-b-2 flex items-center gap-2 transition ${
            activeTab === 'inbox' 
              ? 'border-teal-400 text-teal-400' 
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          Descarga Mental (Pendientes)
          <span className="bg-slate-800 text-teal-300 text-xs px-2 py-0.5 rounded-full">{data.backlog.length}</span>
        </button>

        <button
          onClick={() => setActiveTab('routines')}
          className={`px-4 py-3 text-sm font-medium border-b-2 flex items-center gap-2 transition ${
            activeTab === 'routines' 
              ? 'border-teal-400 text-teal-400' 
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          Eficiencia de Rutinas
        </button>

        <button
          onClick={() => setActiveTab('schedule')}
          className={`px-4 py-3 text-sm font-medium border-b-2 flex items-center gap-2 transition ${
            activeTab === 'schedule' 
              ? 'border-teal-400 text-teal-400' 
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          Estructura del Día
        </button>
      </div>

      {/* CONTENIDO PRINCIPAL */}
      <main className="max-w-5xl mx-auto">
        {/* PESTAÑA 1: DESCARGA MENTAL */}
        {activeTab === 'inbox' && (
          <div className="grid md:grid-cols-3 gap-6">
            {/* Formulario de Captura Rápida */}
            <div className="md:col-span-1 bg-slate-800/60 rounded-xl p-5 border border-slate-700/60 h-fit sticky top-6">
              <h2 className="text-lg font-semibold mb-4 text-teal-300 flex items-center gap-2">
                <Plus size={18} /> Nueva Descarga Mental
              </h2>
              <form onSubmit={handleAddBacklogItem} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">¿Qué surgió o tienes pendiente?</label>
                  <div className="relative">
                    <textarea
                      rows={3}
                      value={taskText}
                      onChange={(e) => setTaskText(e.target.value)}
                      placeholder="Ej. Limpiar filtro de clima, cambiar foco..."
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-teal-400 pr-10 resize-none"
                    />
                    <button
                      type="button"
                      onClick={toggleSpeechRecognition}
                      className={`absolute right-2 bottom-3 p-2 rounded-full transition ${
                        isRecording ? 'bg-red-500 text-white animate-pulse' : 'bg-slate-800 text-slate-400 hover:text-teal-300'
                      }`}
                      title={isRecording ? 'Escuchando...' : 'Dictar por voz'}
                    >
                      {isRecording ? <MicOff size={16} /> : <Mic size={16} />}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Categoría</label>
                    <select
                      value={taskCategory}
                      onChange={(e) => setTaskCategory(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-200 focus:outline-none focus:border-teal-400"
                    >
                      <option value="General">General</option>
                      <option value="Mantenimiento">Mantenimiento</option>
                      <option value="Mascotas">Mascotas</option>
                      <option value="Finanzas">Finanzas</option>
                      <option value="Hogar">Hogar</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Min. Est.</label>
                    <input
                      type="number"
                      value={taskEst}
                      onChange={(e) => setTaskEst(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-200 focus:outline-none focus:border-teal-400"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full bg-teal-500 hover:bg-teal-600 text-slate-950 font-semibold py-2.5 rounded-lg text-sm transition flex items-center justify-center gap-2"
                >
                  <Plus size={16} /> Liberar de mi Mente
                </button>
              </form>
            </div>

            {/* Lista de Pendientes (Bandeja) */}
            <div className="md:col-span-2 space-y-3">
              <div className="flex justify-between items-center mb-2">
                <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">
                  Bandeja sin Fecha Ni Horario Programado
                </h2>
              </div>

              {data.backlog.length === 0 ? (
                <div className="text-center py-12 bg-slate-800/30 rounded-xl border border-dashed border-slate-800">
                  <p className="text-slate-500 text-sm">Tu mente está completamente despejada.</p>
                </div>
              ) : (
                data.backlog.map((item) => {
                  const days = getDaysElapsed(item.createdAt);
                  return (
                    <div 
                      key={item.id} 
                      className="bg-slate-800/50 border border-slate-700/50 hover:border-slate-600 rounded-xl p-4 flex items-center justify-between gap-4 transition"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-slate-100 text-sm font-medium">{item.title}</span>
                          <span className="text-[10px] bg-slate-700 text-slate-300 px-2 py-0.5 rounded-full">
                            {item.category}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-slate-400">
                          <span className="flex items-center gap-1">
                            <Clock size={12} /> ~{item.estimatedMin} min
                          </span>
                          <span className={`flex items-center gap-1 ${days > 5 ? 'text-amber-400' : 'text-slate-400'}`}>
                            <Calendar size={12} /> Creado hace {days === 0 ? 'hoy' : `${days} día(s)`}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleDeleteBacklog(item.id)}
                          className="p-2 text-slate-500 hover:text-red-400 hover:bg-slate-700/50 rounded-lg transition"
                          title="Marcar como resuelto / Eliminar"
                        >
                          <Check size={18} />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* PESTAÑA 2: EFICIENCIA DE RUTINAS */}
        {activeTab === 'routines' && (
          <div className="space-y-6">
            <div className="bg-slate-800/40 p-4 rounded-xl border border-slate-700/40 text-xs text-slate-300 flex items-start gap-3">
              <AlertCircle size={18} className="text-teal-400 shrink-0 mt-0.5" />
              <p>
                Utiliza el cronómetro para registrar cuánto tardas en completar tus actividades (aseo, alimentos, viajes en camión, cuidado de mascotas). Al medir los tiempos reales podrás ajustar tus bloques diarios sin sobreestimar ni quedarte corto.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              {data.routines.map((routine) => {
                const isRunning = activeTimerId === routine.id;
                const avgMin = getAverageTime(routine.actualHistory);
                const diff = avgMin ? avgMin - routine.estimatedMin : 0;

                return (
                  <div key={routine.id} className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-5 flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="font-semibold text-slate-100">{routine.name}</h3>
                        <span className="text-[10px] bg-slate-700 text-slate-300 px-2 py-0.5 rounded-full">
                          {routine.category}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 my-4 bg-slate-900/60 p-3 rounded-lg text-xs">
                        <div>
                          <span className="text-slate-400 block">Tiempo Estimado</span>
                          <span className="text-slate-200 font-semibold">{routine.estimatedMin} min</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block">Promedio Real</span>
                          <span className="text-teal-300 font-semibold">
                            {avgMin ? `${avgMin} min` : 'Sin datos'} 
                            {diff !== 0 && avgMin > 0 && (
                              <span className={`ml-1 text-[10px] ${diff > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                                ({diff > 0 ? `+${diff}` : diff}m)
                              </span>
                            )}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Timer Controls */}
                    <div className="flex items-center justify-between border-t border-slate-700/50 pt-3 mt-2">
                      {isRunning ? (
                        <div className="flex items-center justify-between w-full">
                          <span className="text-teal-300 font-mono text-sm font-bold animate-pulse">
                            {Math.floor(timerSeconds / 60)}m {timerSeconds % 60}s
                          </span>
                          <button
                            onClick={() => stopTimerAndSave(routine.id)}
                            className="bg-red-500 hover:bg-red-600 text-white px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition"
                          >
                            <Square size={14} /> Detener y Guardar
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => startTimer(routine.id)}
                          className="w-full bg-slate-700 hover:bg-slate-600 text-slate-200 py-2 rounded-lg text-xs font-medium flex items-center justify-center gap-2 transition"
                        >
                          <Play size={14} className="text-teal-400" /> Iniciar Medición
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* PESTAÑA 3: ESTRUCTURA DEL DÍA */}
        {activeTab === 'schedule' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center mb-2">
              <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">
                Distribución Tipo Visual del Día
              </h2>
            </div>

            <div className="bg-slate-800/40 rounded-xl border border-slate-700/50 divide-y divide-slate-800">
              {data.daySchedule.map((slot) => (
                <div 
                  key={slot.id} 
                  className={`p-4 flex items-center justify-between transition ${
                    slot.isFreeSlot 
                      ? 'bg-teal-950/20 hover:bg-teal-950/30 border-l-4 border-l-teal-400' 
                      : 'hover:bg-slate-800/60'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <span className="text-xs font-mono text-slate-400 w-24">
                      {slot.start} - {slot.end}
                    </span>
                    <div>
                      <p className={`text-sm font-medium ${slot.isFreeSlot ? 'text-teal-300' : 'text-slate-200'}`}>
                        {slot.title}
                      </p>
                      {slot.isFreeSlot && (
                        <span className="text-[11px] text-teal-400/80">
                          Espacio disponible para asignar un pendiente o descansar.
                        </span>
                      )}
                    </div>
                  </div>

                  <div>
                    {slot.isFixed ? (
                      <span className="text-[10px] bg-slate-700/60 text-slate-400 px-2 py-1 rounded">
                        No Negociable
                      </span>
                    ) : slot.isFreeSlot ? (
                      <span className="text-[10px] bg-teal-900/50 text-teal-300 px-2 py-1 rounded border border-teal-700/50">
                        Ventana Libre
                      </span>
                    ) : (
                      <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-1 rounded">
                        Flexible
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}