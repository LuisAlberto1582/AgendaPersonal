// Calendario de cumplimiento: qué tanto hiciste lo que tocaba cada día
import React, { useMemo, useState } from 'react';
import { CalendarCheck, CheckCircle, ChevronLeft, ChevronRight, Circle, Flame, ArrowRight } from 'lucide-react';
import {
  MONTH_NAMES, WEEKDAYS, addDays, currentStreak, dateKey, dayStats, formatDayLabel, parseKey, routineFidelity, trackingStart,
} from './dayPlan.js';

const pctClass = (pct) => pct === null ? '' : pct >= 80
  ? 'bg-emerald-500/25 border-emerald-500/50 text-emerald-300'
  : pct >= 50 ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
  : 'bg-rose-500/20 border-rose-500/40 text-rose-300';

export default function CalendarView({ routines, tasks, dayLog, today, onToggleRoutine, onToggleTask, onOpenDay }) {
  const [month, setMonth] = useState(() => today.slice(0, 7)); // 'YYYY-MM'
  const [selected, setSelected] = useState(today);
  const ctx = useMemo(() => ({ dayLog, routines, tasks, today }), [dayLog, routines, tasks, today]);

  // Celdas del mes empezando en lunes
  const first = `${month}-01`;
  const gridStart = addDays(first, -((parseKey(first).getDay() + 6) % 7));
  const cells = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  const weeks = cells.slice(35).some(k => k.startsWith(month)) ? 6 : 5;

  const monthStats = cells.filter(k => k.startsWith(month)).map(k => dayStats(k, ctx)).filter(s => s.pct !== null);
  const monthAvg = monthStats.length ? Math.round(monthStats.reduce((a, s) => a + s.pct, 0) / monthStats.length) : null;
  const streak = currentStreak(ctx);
  const fidelity = routineFidelity(ctx, 30);
  const start = trackingStart(dayLog);

  const moveMonth = (n) => {
    const d = parseKey(`${month}-01`);
    d.setMonth(d.getMonth() + n);
    setMonth(dateKey(d).slice(0, 7));
  };

  const sel = dayStats(selected, ctx);
  const byId = Object.fromEntries(routines.map(r => [r.id, r]));
  const completedThatDay = tasks.filter(t => t.completedAt === selected && t.scheduledDate !== selected);
  const canLog = selected <= today;

  return (
    <div className="space-y-6">
      <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <CalendarCheck className="w-5 h-5 text-indigo-400" />
            Calendario de Cumplimiento
          </h2>
          <p className="text-xs text-slate-400 mt-1 max-w-xl">
            Cada día compara lo que tocaba (rutinas de ese día y tareas programadas) contra lo que marcaste como hecho o mediste.
            {start ? ` Registro desde ${formatDayLabel(start)}.` : ' Empieza a contar el primer día que marques algo.'}
          </p>
        </div>
        <div className="flex gap-3 text-center">
          <div className="bg-slate-950 px-4 py-2 rounded-xl border border-slate-800">
            <span className="text-[10px] text-slate-500 block uppercase">Racha ≥80%</span>
            <span className="font-bold text-orange-400 flex items-center justify-center gap-1"><Flame className="w-4 h-4" />{streak} {streak === 1 ? 'día' : 'días'}</span>
          </div>
          <div className="bg-slate-950 px-4 py-2 rounded-xl border border-slate-800">
            <span className="text-[10px] text-slate-500 block uppercase">Promedio del mes</span>
            <span className="font-bold text-indigo-300">{monthAvg === null ? '—' : `${monthAvg}%`}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* MES */}
        <div className="lg:col-span-2 bg-slate-900 p-4 rounded-2xl border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <button onClick={() => moveMonth(-1)} className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400" title="Mes anterior"><ChevronLeft className="w-4 h-4" /></button>
            <span className="font-bold text-sm text-white">{MONTH_NAMES[Number(month.slice(5)) - 1]} {month.slice(0, 4)}</span>
            <button onClick={() => moveMonth(1)} className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400" title="Mes siguiente"><ChevronRight className="w-4 h-4" /></button>
          </div>
          <div className="grid grid-cols-7 gap-1.5 text-center">
            {WEEKDAYS.map(w => <span key={w.d} className="text-[10px] text-slate-500 font-semibold">{w.short}</span>)}
            {cells.slice(0, weeks * 7).map(k => {
              const s = dayStats(k, ctx);
              const inMonth = k.startsWith(month);
              return (
                <button
                  key={k}
                  onClick={() => setSelected(k)}
                  className={`aspect-square sm:aspect-auto sm:h-16 rounded-lg border flex flex-col items-center justify-center gap-0.5 transition ${
                    s.pct !== null ? pctClass(s.pct) : 'bg-slate-950/60 border-slate-800 text-slate-400'
                  } ${inMonth ? '' : 'opacity-30'} ${k === selected ? 'ring-2 ring-indigo-400' : ''}`}
                >
                  <span className={`text-xs ${k === today ? 'font-extrabold text-white' : 'font-semibold'}`}>{parseKey(k).getDate()}</span>
                  <span className="text-[9px] leading-none">
                    {s.pct !== null ? `${s.pct}%` : k > today ? `${s.total}` : ''}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-3 text-[10px] text-slate-500 pt-1">
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-emerald-500/50" /> 80% o más</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-amber-500/50" /> 50–79%</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-rose-500/50" /> menos de 50%</span>
            <span>Días futuros: número de cosas planeadas</span>
          </div>
        </div>

        {/* DETALLE DEL DÍA */}
        <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <span className="font-bold text-sm text-white block">{formatDayLabel(selected)}</span>
              <span className="text-[11px] text-slate-400">
                {sel.doneCount} de {sel.total} hechas{sel.pct !== null ? ` • ${sel.pct}%` : ''}
              </span>
            </div>
            <button onClick={() => onOpenDay(selected)} className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1">
              Ver día <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          {!canLog && <p className="text-[11px] text-slate-500">Día futuro: así se ve lo planeado.</p>}

          <div className="space-y-1.5">
            <span className="text-[10px] text-slate-500 uppercase font-semibold">Rutinas</span>
            {sel.planIds.length === 0 && <p className="text-xs text-slate-500">No tocaba ninguna rutina.</p>}
            {[...sel.planIds, ...sel.extraIds].map(id => {
              const r = byId[id];
              const isDone = id in sel.done;
              const extra = !sel.planIds.includes(id);
              return (
                <button
                  key={id}
                  disabled={!canLog}
                  onClick={() => onToggleRoutine(selected, id)}
                  className="w-full flex items-center justify-between gap-2 bg-slate-950 px-3 py-2 rounded-lg border border-slate-800 text-left disabled:cursor-default"
                >
                  <span className="flex items-center gap-2 text-xs text-slate-200">
                    {isDone ? <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" /> : <Circle className="w-4 h-4 text-slate-600 shrink-0" />}
                    {r?.name ?? 'Rutina eliminada'}{extra ? ' (extra)' : ''}
                  </span>
                  {isDone && sel.done[id] > 0 && <span className="text-[10px] text-indigo-300 shrink-0">{sel.done[id]} min</span>}
                </button>
              );
            })}
          </div>

          {(sel.dayTasks.length > 0 || completedThatDay.length > 0) && (
            <div className="space-y-1.5">
              <span className="text-[10px] text-slate-500 uppercase font-semibold">Tareas</span>
              {sel.dayTasks.map(t => (
                <button
                  key={t.id}
                  onClick={() => onToggleTask(t.id)}
                  className="w-full flex items-center gap-2 bg-slate-950 px-3 py-2 rounded-lg border border-slate-800 text-left text-xs text-slate-200"
                >
                  {t.completed ? <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" /> : <Circle className="w-4 h-4 text-slate-600 shrink-0" />}
                  <span className={t.completed ? 'line-through text-slate-500' : ''}>{t.title}</span>
                  {t.scheduledTime && <span className="ml-auto text-[10px] text-slate-500">{t.scheduledTime}</span>}
                </button>
              ))}
              {completedThatDay.map(t => (
                <div key={t.id} className="flex items-center gap-2 px-3 py-2 text-xs text-slate-400">
                  <CheckCircle className="w-4 h-4 text-emerald-400/60 shrink-0" />
                  <span>{t.title} <span className="text-slate-500">(sin programar, hecha este día)</span></span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* CONSTANCIA POR RUTINA */}
      <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 space-y-3">
        <span className="font-bold text-sm text-white block">Constancia por rutina (últimos 30 días)</span>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2">
          {routines.filter(r => fidelity[r.id]?.planned > 0).map(r => {
            const f = fidelity[r.id];
            const pct = Math.round((f.done / f.planned) * 100);
            return (
              <div key={r.id} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-300 truncate pr-2">{r.name}</span>
                  <span className="text-slate-400 shrink-0">{f.done}/{f.planned} • {pct}%</span>
                </div>
                <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${pct >= 80 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-500' : 'bg-rose-500'}`} style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
          {!routines.some(r => fidelity[r.id]?.planned > 0) && (
            <p className="text-xs text-slate-500">Aún no hay días registrados. Marca rutinas como hechas en "Mi Día".</p>
          )}
        </div>
      </div>
    </div>
  );
}
