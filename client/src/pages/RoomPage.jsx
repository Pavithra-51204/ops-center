import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, MessageSquare, ListChecks, Users, Settings,
  Clock, CheckCircle2, AlertTriangle, Loader2, Radio,
  ChevronDown, AlertOctagon, ClipboardCopy, Download, FileBarChart2,
} from 'lucide-react';
import { PriorityBadge, StatusBadge } from '../components/shared/Badge';
import Chat from '../components/rooms/Chat';
import ActionTracker from '../components/rooms/ActionTracker';
import PresencePanel from '../components/rooms/PresencePanel';
import TimelineSidebar from '../components/rooms/TimelineSidebar';
import Modal from '../components/shared/Modal';
import api from '../lib/api';
import { getSocket } from '../lib/socket';
import { formatDistanceToNow, format, differenceInMinutes, differenceInHours } from 'date-fns';

// ── Constants ─────────────────────────────────────────────────────────────────
const TABS = [
  { id: 'chat', label: 'Chat', icon: MessageSquare },
  { id: 'actions', label: 'Actions', icon: ListChecks },
];

const SEVERITY_LEVELS = [
  { id: 'LOW',      label: 'LOW',      color: 'text-blue-400',   bg: 'bg-blue-500/10 border-blue-500/30' },
  { id: 'MEDIUM',   label: 'MEDIUM',   color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/30' },
  { id: 'HIGH',     label: 'HIGH',     color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/30' },
  { id: 'CRITICAL', label: 'CRITICAL', color: 'text-red-400',    bg: 'bg-red-500/10 border-red-500/30' },
];

const severityColor = (s) => {
  const m = { LOW: 'text-blue-400', MEDIUM: 'text-yellow-400', HIGH: 'text-orange-400', CRITICAL: 'text-red-400' };
  return m[s] || 'text-slate-400';
};

const formatDuration = (start, end) => {
  const s = new Date(start);
  const e = end ? new Date(end) : new Date();
  const mins = differenceInMinutes(e, s);
  if (mins < 60) return `${mins}m`;
  const hrs = differenceInHours(e, s);
  return `${hrs}h ${mins % 60}m`;
};

// ── Status Change Modal ───────────────────────────────────────────────────────
const StatusChangeModal = ({ isOpen, onClose, room, onUpdated }) => {
  const [status, setStatus] = useState(room?.status || 'active');
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    setLoading(true);
    try {
      const { data } = await api.patch(`/rooms/${room._id}`, { status });
      onUpdated(data.room);
      const socket = getSocket();
      socket.emit('room_status_changed', { roomId: room._id, status });
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const statuses = [
    { id: 'active',     label: 'Active',     desc: 'Incident is ongoing and critical',         color: 'text-red-400 border-red-500/30 bg-red-500/10' },
    { id: 'monitoring', label: 'Monitoring', desc: 'Situation stabilized, under observation',   color: 'text-yellow-400 border-yellow-500/30 bg-yellow-500/10' },
    { id: 'resolved',   label: 'Resolved',   desc: 'Incident fully resolved and closed',        color: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10' },
  ];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Update Room Status" size="sm">
      <div className="space-y-2 mb-5">
        {statuses.map((s) => (
          <button
            key={s.id}
            onClick={() => setStatus(s.id)}
            className={`w-full text-left p-3.5 rounded-xl border transition-all ${
              status === s.id ? s.color : 'border-slate-700 hover:border-slate-600 text-slate-400'
            }`}
          >
            <p className="font-medium text-sm">{s.label}</p>
            <p className="text-xs mt-0.5 opacity-70">{s.desc}</p>
          </button>
        ))}
      </div>
      <div className="flex gap-3">
        <button onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
        <button onClick={handleSave} disabled={loading || status === room?.status} className="btn-primary flex-1 justify-center">
          {loading ? <Loader2 size={14} className="animate-spin" /> : 'Update Status'}
        </button>
      </div>
    </Modal>
  );
};

// ── Severity Dropdown ─────────────────────────────────────────────────────────
const SeverityDropdown = ({ current, onChange }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className={`btn-ghost flex-shrink-0 gap-1.5 ${current === 'CRITICAL' ? 'text-red-400' : ''}`}
      >
        <AlertOctagon size={15} />
        <span className={`hidden sm:inline font-medium ${severityColor(current)}`}>{current || 'Severity'}</span>
        <ChevronDown size={12} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-44 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-50 overflow-hidden animate-slide-up">
          {SEVERITY_LEVELS.map((s) => (
            <button
              key={s.id}
              onClick={() => { onChange(s.id); setOpen(false); }}
              className={`w-full text-left px-3.5 py-2.5 text-sm flex items-center justify-between transition-all hover:bg-slate-800 ${
                current === s.id ? s.color + ' font-semibold' : 'text-slate-400'
              }`}
            >
              {s.label}
              {current === s.id && <span className="w-1.5 h-1.5 rounded-full bg-current" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// ── Generate Summary Modal ────────────────────────────────────────────────────
const SummaryModal = ({ isOpen, onClose, room, timeline }) => {
  const [copied, setCopied] = useState(false);

  if (!room) return null;

  const duration = formatDuration(room.createdAt, room.resolvedAt);

  const timelineText = (timeline || [])
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
    .map((e) => {
      const actor = e.actor?.name || 'System';
      const ts = e.timestamp ? format(new Date(e.timestamp), 'HH:mm:ss') : '';
      const detail = e.meta?.status ? ` → ${e.meta.status}` : e.meta?.severity ? ` → ${e.meta.severity}` : '';
      return `[${ts}] ${actor} · ${e.event.replace('_', ' ')}${detail}`;
    })
    .join('\n');

  const report = `INCIDENT REPORT
================
Title:       ${room.title}
Status:      ${room.status.toUpperCase()}
Severity:    ${room.severity || 'N/A'}
Duration:    ${duration}
Created:     ${room.createdAt ? format(new Date(room.createdAt), 'yyyy-MM-dd HH:mm') : 'N/A'}
Resolved:    ${room.resolvedAt ? format(new Date(room.resolvedAt), 'yyyy-MM-dd HH:mm') : 'N/A'}
Participants:${room.participants?.length || 0}

${room.description ? `Description:\n${room.description}\n\n` : ''}INCIDENT TIMELINE
-----------------
${timelineText || '(no events recorded)'}
`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(report);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {/* noop */}
  };

  const handleDownload = () => {
    const blob = new Blob([report], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `incident-report-${room._id}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Incident Summary" size="lg">
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-slate-800 rounded-lg p-3">
            <p className="text-xs text-slate-500 mb-1">Duration</p>
            <p className="text-sm font-semibold text-slate-200">{duration}</p>
          </div>
          <div className="bg-slate-800 rounded-lg p-3">
            <p className="text-xs text-slate-500 mb-1">Participants</p>
            <p className="text-sm font-semibold text-slate-200">{room.participants?.length || 0}</p>
          </div>
          <div className="bg-slate-800 rounded-lg p-3">
            <p className="text-xs text-slate-500 mb-1">Severity</p>
            <p className={`text-sm font-semibold ${severityColor(room.severity)}`}>{room.severity || '—'}</p>
          </div>
        </div>

        <div>
          <label className="text-xs text-slate-500 mb-1 block">Report Preview</label>
          <pre className="bg-slate-800 border border-slate-700 rounded-lg p-3 text-xs text-slate-300 font-mono overflow-y-auto max-h-64 leading-relaxed whitespace-pre-wrap">
            {report}
          </pre>
        </div>

        <div className="flex gap-3">
          <button onClick={handleCopy} className="btn-secondary flex-1 justify-center gap-2">
            <ClipboardCopy size={14} />
            {copied ? 'Copied!' : 'Copy'}
          </button>
          <button onClick={handleDownload} className="btn-primary flex-1 justify-center gap-2">
            <Download size={14} />
            Download .txt
          </button>
        </div>
      </div>
    </Modal>
  );
};

// ── RoomPage ──────────────────────────────────────────────────────────────────
const RoomPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [room, setRoom] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('chat');
  const [showSettings, setShowSettings] = useState(false);
  const [showPresence, setShowPresence] = useState(true);
  const [showTimeline, setShowTimeline] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [timeline, setTimeline] = useState([]);
  const socket = getSocket();

  useEffect(() => {
    const fetchRoom = async () => {
      try {
        const { data } = await api.get(`/rooms/${id}`);
        setRoom(data.room);
        await api.post(`/rooms/${id}/join`);
      } catch (err) {
        const status = err.response?.status;
        if (status === 403) {
          // Invite-only: redirect to lobby with a state message
          navigate('/lobby', {
            state: { error: err.response?.data?.message || 'Access denied — invitation required.' },
          });
        } else {
          console.error('Failed to load room:', err);
          navigate('/lobby');
        }
      } finally {
        setLoading(false);
      }
    };
    fetchRoom();
  }, [id, navigate]);

  // Socket room events
  useEffect(() => {
    if (!room) return;
    socket.emit('join_room', id);

    socket.on('status_updated', ({ status }) => {
      setRoom((prev) => prev ? { ...prev, status } : prev);
    });

    socket.on('severity_updated', ({ severity }) => {
      setRoom((prev) => prev ? { ...prev, severity } : prev);
    });

    socket.on('timeline_update', (entry) => {
      if (entry) setTimeline((prev) => [...prev, entry]);
    });

    return () => {
      socket.off('status_updated');
      socket.off('severity_updated');
      socket.off('timeline_update');
    };
  }, [room, id, socket]);

  // Fetch timeline for summary modal
  useEffect(() => {
    if (!room) return;
    api.get(`/rooms/${id}/timeline`)
      .then(({ data }) => setTimeline(data.timeline || []))
      .catch(() => {});
  }, [room, id]);

  const handleSeverityChange = (severity) => {
    socket.emit('severity_change', { roomId: id, severity });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 size={24} className="animate-spin text-slate-500" />
      </div>
    );
  }

  if (!room) return null;

  const elapsed = room.timeElapsed || '—';
  const isCritical = room.severity === 'CRITICAL';

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 64px)' }}>
      {/* Room header */}
      <div className={`bg-slate-900 border-b px-6 py-4 flex-shrink-0 transition-all duration-300 ${
        isCritical
          ? 'border-red-500/50 critical-pulse'
          : 'border-slate-800'
      }`}>
        <div className="flex items-start gap-4">
          <button onClick={() => navigate('/lobby')} className="btn-ghost p-2 mt-0.5 flex-shrink-0">
            <ArrowLeft size={16} />
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h1 className={`font-display font-bold text-xl leading-tight truncate ${isCritical ? 'text-red-400' : 'text-slate-100'}`}>
                  {isCritical && <AlertOctagon size={16} className="inline mr-2 text-red-400 animate-pulse" />}
                  {room.title}
                </h1>
                {room.description && (
                  <p className="text-sm text-slate-500 mt-1 line-clamp-1">{room.description}</p>
                )}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <SeverityDropdown current={room.severity || 'HIGH'} onChange={handleSeverityChange} />
                <button onClick={() => setShowSettings(true)} className="btn-ghost flex-shrink-0 gap-1.5">
                  <Settings size={15} />
                  <span className="hidden sm:inline">Status</span>
                </button>
              </div>
            </div>

            {/* Meta row */}
            <div className="flex items-center gap-3 mt-3 flex-wrap">
              <PriorityBadge priority={room.priority} />
              <StatusBadge status={room.status} />
              <span className="text-xs text-slate-600 flex items-center gap-1">
                <Clock size={11} /> {elapsed} elapsed
              </span>
              <span className="text-xs text-slate-600 flex items-center gap-1">
                <Users size={11} /> {room.participants?.length || 0} participants
              </span>
              {room.tags?.map((tag) => (
                <span key={tag} className="text-xs px-2 py-0.5 bg-slate-800 text-slate-500 border border-slate-700 rounded-md">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 mt-4 ml-12">
          {TABS.map(({ id: tabId, label, icon: Icon }) => (
            <button
              key={tabId}
              onClick={() => setActiveTab(tabId)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === tabId
                  ? 'bg-slate-800 text-slate-100 border border-slate-700'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <Icon size={15} />
              {label}
            </button>
          ))}

          <div className="ml-auto flex items-center gap-1">
            {/* Timeline toggle */}
            <button
              onClick={() => { setShowTimeline((t) => !t); if (!showTimeline) setShowPresence(false); }}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                showTimeline
                  ? 'bg-slate-800 text-slate-100 border border-slate-700'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <Radio size={15} />
              Timeline
            </button>
            {/* Presence toggle */}
            <button
              onClick={() => { setShowPresence((p) => !p); if (!showPresence) setShowTimeline(false); }}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                showPresence
                  ? 'bg-slate-800 text-slate-100 border border-slate-700'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <Users size={15} />
              Team
            </button>
          </div>
        </div>
      </div>

      {/* Workspace */}
      <div className="flex flex-1 overflow-hidden">
        {/* Main panel */}
        <div className="flex-1 overflow-hidden">
          {activeTab === 'chat' && <Chat roomId={id} />}
          {activeTab === 'actions' && (
            <ActionTracker
              roomId={id}
              initialItems={room.actionItems || []}
              participants={room.participants || []}
            />
          )}
        </div>

        {/* Timeline or Presence sidebar */}
        {showTimeline && (
          <div className="w-64 border-l border-slate-800 overflow-hidden flex-shrink-0 bg-slate-900/50 flex flex-col">
            <TimelineSidebar roomId={id} />
          </div>
        )}
        {showPresence && !showTimeline && (
          <div className="w-56 border-l border-slate-800 overflow-y-auto flex-shrink-0 bg-slate-900/50">
            <PresencePanel roomId={id} participants={room.participants || []} />
          </div>
        )}
      </div>

      {/* Resolved banner */}
      {room.status === 'resolved' && (
        <div className="bg-emerald-500/10 border-t border-emerald-500/20 px-6 py-3 flex items-center gap-3 flex-shrink-0">
          <CheckCircle2 size={16} className="text-emerald-400 flex-shrink-0" />
          <p className="text-sm text-emerald-400 font-medium flex-1">
            Incident resolved.{' '}
            {room.resolvedAt && (
              <span className="font-normal text-emerald-500/70">
                Closed {formatDistanceToNow(new Date(room.resolvedAt), { addSuffix: true })}.
              </span>
            )}
          </p>
          <button
            onClick={() => setShowSummary(true)}
            className="flex items-center gap-2 px-3.5 py-1.5 text-sm font-medium rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 transition-all"
          >
            <FileBarChart2 size={14} />
            Generate Summary
          </button>
        </div>
      )}

      {/* Modals */}
      <StatusChangeModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        room={room}
        onUpdated={(updated) => setRoom(updated)}
      />
      <SummaryModal
        isOpen={showSummary}
        onClose={() => setShowSummary(false)}
        room={room}
        timeline={timeline}
      />
    </div>
  );
};

export default RoomPage;
