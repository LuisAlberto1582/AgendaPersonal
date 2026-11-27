// Programar una tarea para cualquier día (y opcionalmente una hora)
import React, { useState } from 'react';
import { CalendarPlus, X } from 'lucide-react';
import { addDays, formatRelativeDay, weekdayOf } from './dayPlan.js';

// Próximo sábado (o hoy si ya es sábado)
const nextSaturday = (today) => addDays(today, (6 - weekdayOf(today) + 7) % 7);

export default function TaskScheduler({ task, today, suggestedDate = today, suggestedTime = '', onSchedule, label = 'Programar', compact = false }) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(task.scheduledDate || suggestedDate || today);
  const [time, setTime] = useState(task.scheduledTime || '');

  const quick = [...new Set([today, addDays(today, 1), nextSaturday(today), suggestedDate].filter(Boolean))].sort();

  const save = (d = date) => {
    onSchedule(task.id, d, time || null);
    setOpen(false);
  };

  if (!open) {
    return (
      <button
        onClick={() => { setDate(task.scheduledDate || suggestedDate || today); setTime(task.scheduledTime || ''); setOpen(true); }}
        className={compact
          ? 'text-xs text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1'
          : 'px-3 py-1.5 bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white rounded-lg text-xs font-medium transition flex items-center gap-1.5'}
      >
        <CalendarPlus className="w-3.5 h-3.5" />
        <span>{label}</span>
      </button>
    );
  }

  return (
    <div className="w-full bg-slate-900 border border-indigo-500/40 rounded-xl p-2.5 space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        {quick.map(d => (
          <button
            key={d}
            onClick={() => save(d)}
            className="px-2 py-1 rounded-md text-[11px] bg-slate-800 hover:bg-indigo-600 text-slate-200 hover:text-white transition"
            title="Programar en este día"
          >
            {formatRelativeDay(d, today)}
          </button>
        ))}
        <button onClick={() => setOpen(false)} className="ml-auto p-1 text-slate-500 hover:text-slate-300" title="Cancelar">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="flex items-center gap-1.5">
        <input
          type="date"
          value={date}
          min={today}
          onChange={e => setDate(e.target.value)}
          className="flex-1 min-w-0 bg-slate-950 border border-slate-700 rounded-md px-2 py-1 text-[11px] text-slate-200 [color-scheme:dark]"
        />
        <input
          type="time"
          value={time}
          onChange={e => setTime(e.target.value)}
          placeholder={suggestedTime}
          className="w-24 bg-slate-950 border border-slate-700 rounded-md px-2 py-1 text-[11px] text-slate-200 [color-scheme:dark]"
          title="Hora (opcional)"
        />
        <button
          onClick={() => date && save()}
          className="px-2.5 py-1 rounded-md text-[11px] font-semibold bg-indigo-600 hover:bg-indigo-500 text-white"
        >
          Asignar
        </button>
      </div>
    </div>
  );
}
