import React, { useState, useEffect, useCallback } from 'react';
import { Clock, User2, Loader2, Radio } from 'lucide-react';
import { format } from 'date-fns';
import api from '../../lib/api';
import { getSocket } from '../../lib/socket';

const EVENT_CONFIG = {
  user_joined: {
    label: 'joined the room',
    color: 'bg-emerald-400',
    lineColor: 'border-emerald-500/30',
    textColor: 'text-emerald-400',
  },
  user_left: {
    label: 'left the room',
    color: 'bg-slate-500',
    lineColor: 'border-slate-600/30',
    textColor: 'text-slate-500',
  },
  status_changed: {
    label: 'changed status',
    color: 'bg-blue-400',
    lineColor: 'border-blue-500/30',
    textColor: 'text-blue-400',
  },
  severity_changed: {
    label: 'changed severity',
    color: 'bg-orange-400',
    lineColor: 'border-orange-500/30',
    textColor: 'text-orange-400',
  },
  room_created: {
    label: 'created this room',
    color: 'bg-violet-400',
    lineColor: 'border-violet-500/30',
    textColor: 'text-violet-400',
  },
};

const formatEventLabel = (entry) => {
  const cfg = EVENT_CONFIG[entry.event] || {};
  const actor = entry.actor?.name || 'System';
  let detail = '';

  if (entry.event === 'status_changed' && entry.meta?.status) {
    detail = `→ ${entry.meta.status}`;
  } else if (entry.event === 'severity_changed' && entry.meta?.severity) {
    detail = `→ ${entry.meta.severity}`;
  }

  return { actor, label: cfg.label || entry.event, detail };
};

const TimelineEntry = ({ entry, isLast }) => {
  const cfg = EVENT_CONFIG[entry.event] || {
    color: 'bg-slate-600',
    textColor: 'text-slate-400',
  };
  const { actor, label, detail } = formatEventLabel(entry);
  const ts = entry.timestamp ? format(new Date(entry.timestamp), 'HH:mm:ss') : '';

  return (
    <div className="flex gap-3 relative">
      {/* Vertical line */}
      {!isLast && (
        <div className="absolute left-[7px] top-4 bottom-0 w-px bg-slate-800" />
      )}

      {/* Dot */}
      <div className={`w-3.5 h-3.5 rounded-full flex-shrink-0 mt-1 z-10 ${cfg.color}`} />

      {/* Content */}
      <div className="flex-1 pb-4 min-w-0">
        <div className="flex items-baseline gap-1.5 flex-wrap">
          <span className="text-xs font-semibold text-slate-300 truncate">{actor}</span>
          <span className="text-xs text-slate-500">{label}</span>
          {detail && (
            <span className={`text-xs font-medium ${cfg.textColor}`}>{detail}</span>
          )}
        </div>
        <p className="text-[10px] text-slate-700 mt-0.5">{ts}</p>
      </div>
    </div>
  );
};

const TimelineSidebar = ({ roomId }) => {
  const [timeline, setTimeline] = useState([]);
  const [loading, setLoading] = useState(true);
  const socket = getSocket();

  const fetchTimeline = useCallback(async () => {
    try {
      const { data } = await api.get(`/rooms/${roomId}/timeline`);
      setTimeline(data.timeline || []);
    } catch (err) {
      console.error('Failed to load timeline:', err);
    } finally {
      setLoading(false);
    }
  }, [roomId]);

  useEffect(() => {
    fetchTimeline();
  }, [fetchTimeline]);

  useEffect(() => {
    socket.on('timeline_update', (entry) => {
      if (!entry) return;
      setTimeline((prev) => [...prev, entry]);
    });

    return () => {
      socket.off('timeline_update');
    };
  }, [socket]);

  const sorted = [...timeline].sort(
    (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
  );

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 pt-4 pb-2 border-b border-slate-800 flex-shrink-0">
        <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
          <Radio size={11} className="text-blue-400" />
          Incident Timeline
        </h4>
      </div>

      {/* Entries */}
      <div className="flex-1 overflow-y-auto px-4 pt-4">
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 size={18} className="animate-spin text-slate-600" />
          </div>
        ) : sorted.length === 0 ? (
          <p className="text-xs text-slate-700 text-center py-8">
            No events yet.
          </p>
        ) : (
          <div>
            {sorted.map((entry, idx) => (
              <TimelineEntry
                key={entry._id || idx}
                entry={entry}
                isLast={idx === sorted.length - 1}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default TimelineSidebar;
