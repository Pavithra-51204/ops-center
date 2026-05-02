import React, { useState, useRef, useEffect } from 'react';
import {
  CheckSquare, Square, Plus, Trash2, Loader2, ListChecks, UserCircle2, ChevronDown,
} from 'lucide-react';
import { Avatar } from '../shared/Avatar';
import { getSocket } from '../../lib/socket';
import api from '../../lib/api';
import { formatDistanceToNow } from 'date-fns';

// ── Assignee Picker Dropdown ──────────────────────────────────────────────────
const AssigneePicker = ({ participants, value, onChange }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selected = participants.find((p) => {
    const u = p.user || p;
    return u._id === value;
  });
  const selectedUser = selected ? (selected.user || selected) : null;

  return (
    <div className="relative flex-shrink-0" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        title="Assign to…"
        className={`flex items-center gap-1.5 h-9 px-2.5 rounded-lg border text-xs font-medium transition-all ${
          selectedUser
            ? 'border-violet-500/50 bg-violet-500/10 text-violet-300'
            : 'border-slate-700 bg-slate-800/50 text-slate-500 hover:border-slate-600 hover:text-slate-400'
        }`}
      >
        {selectedUser ? (
          <>
            <Avatar user={selectedUser} size="xs" />
            <span className="max-w-[80px] truncate">{selectedUser.name?.split(' ')[0]}</span>
          </>
        ) : (
          <>
            <UserCircle2 size={14} />
            <span className="hidden sm:inline">Assign</span>
          </>
        )}
        <ChevronDown size={11} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute bottom-full mb-1 right-0 w-52 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-50 overflow-hidden animate-slide-up">
          <div className="px-3 py-2 border-b border-slate-800">
            <p className="text-xs text-slate-500 font-medium">Assign to…</p>
          </div>
          {/* Unassign option */}
          <button
            type="button"
            onClick={() => { onChange(null); setOpen(false); }}
            className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-sm transition-all hover:bg-slate-800 ${
              !value ? 'text-slate-300 font-medium' : 'text-slate-500'
            }`}
          >
            <UserCircle2 size={14} className="text-slate-600" />
            Unassigned
            {!value && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-violet-400" />}
          </button>
          {/* Participant list */}
          {participants.map((p) => {
            const u = p.user || p;
            if (!u?._id) return null;
            const isSelected = value === u._id;
            return (
              <button
                key={u._id}
                type="button"
                onClick={() => { onChange(u._id); setOpen(false); }}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-sm transition-all hover:bg-slate-800 ${
                  isSelected ? 'text-slate-100' : 'text-slate-400'
                }`}
              >
                <Avatar user={u} size="xs" />
                <span className="flex-1 text-left truncate">{u.name}</span>
                {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-violet-400" />}
              </button>
            );
          })}
          {participants.length === 0 && (
            <p className="px-3 py-3 text-xs text-slate-600 text-center">No participants yet</p>
          )}
        </div>
      )}
    </div>
  );
};

// ── Individual Action Item Row ─────────────────────────────────────────────────
const ActionItem = ({ item, roomId, onToggle, onDelete }) => {
  const [toggling, setToggling] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleToggle = async () => {
    setToggling(true);
    try {
      const { data } = await api.patch(`/rooms/${roomId}/actions/${item._id}`);
      onToggle(data.actionItem);
      const socket = getSocket();
      socket.emit('action_toggled', { roomId, actionItem: data.actionItem });
    } finally {
      setToggling(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await api.delete(`/rooms/${roomId}/actions/${item._id}`);
      onDelete(item._id);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className={`flex items-start gap-3 p-3 rounded-lg group transition-all ${
      item.completed ? 'bg-emerald-500/5 border border-emerald-500/10' : 'hover:bg-slate-800/50'
    }`}>
      <button
        onClick={handleToggle}
        disabled={toggling}
        className="mt-0.5 flex-shrink-0 transition-colors"
      >
        {toggling ? (
          <Loader2 size={18} className="animate-spin text-slate-500" />
        ) : item.completed ? (
          <CheckSquare size={18} className="text-emerald-400" />
        ) : (
          <Square size={18} className="text-slate-600 hover:text-slate-400" />
        )}
      </button>

      <div className="flex-1 min-w-0">
        <p className={`text-sm leading-relaxed ${item.completed ? 'line-through text-slate-600' : 'text-slate-200'}`}>
          {item.text}
        </p>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          {item.assignedTo && (
            <span className="flex items-center gap-1 text-xs text-slate-500">
              <Avatar user={item.assignedTo} size="xs" showName />
            </span>
          )}
          {item.completed && item.completedAt && (
            <span className="text-xs text-slate-600">
              Done {formatDistanceToNow(new Date(item.completedAt), { addSuffix: true })}
            </span>
          )}
        </div>
      </div>

      <button
        onClick={handleDelete}
        disabled={deleting}
        className="opacity-0 group-hover:opacity-100 text-slate-600 hover:text-red-400 transition-all p-1 rounded flex-shrink-0"
      >
        {deleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
      </button>
    </div>
  );
};

// ── ActionTracker ─────────────────────────────────────────────────────────────
// participants: array of { user: { _id, name, avatarColor } } objects from the room
const ActionTracker = ({ roomId, initialItems = [], participants = [] }) => {
  const [items, setItems] = useState(initialItems);
  const [newText, setNewText] = useState('');
  const [assignedTo, setAssignedTo] = useState(null); // userId string or null
  const [adding, setAdding] = useState(false);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!newText.trim()) return;
    setAdding(true);
    try {
      const { data } = await api.post(`/rooms/${roomId}/actions`, {
        text: newText.trim(),
        assignedTo: assignedTo || undefined,
      });
      setItems(data.actionItems);
      setNewText('');
      setAssignedTo(null);
    } finally {
      setAdding(false);
    }
  };

  const handleToggle = (updatedItem) => {
    setItems((prev) =>
      prev.map((item) => (item._id === updatedItem._id ? { ...item, ...updatedItem } : item))
    );
  };

  const handleDelete = (deletedId) => {
    setItems((prev) => prev.filter((item) => item._id !== deletedId));
  };

  const done = items.filter((i) => i.completed).length;
  const pct = items.length ? Math.round((done / items.length) * 100) : 0;

  return (
    <div className="flex flex-col h-full">
      {/* Progress */}
      {items.length > 0 && (
        <div className="px-4 pt-4 pb-3 border-b border-slate-800">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-400 flex items-center gap-1.5">
              <ListChecks size={13} />
              {done}/{items.length} completed
            </span>
            <span className="text-xs font-semibold text-slate-300">{pct}%</span>
          </div>
          <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}

      {/* Items */}
      <div className="flex-1 overflow-y-auto p-4 space-y-1">
        {items.length === 0 && (
          <div className="text-center py-8">
            <ListChecks size={28} className="text-slate-700 mx-auto mb-2" />
            <p className="text-slate-600 text-sm">No action items yet</p>
            <p className="text-slate-700 text-xs mt-1">Add remediation steps below</p>
          </div>
        )}
        {items.map((item) => (
          <ActionItem
            key={item._id}
            item={item}
            roomId={roomId}
            onToggle={handleToggle}
            onDelete={handleDelete}
          />
        ))}
      </div>

      {/* Add form — text input + assignee picker + submit */}
      <div className="p-4 border-t border-slate-800">
        <form onSubmit={handleAdd} className="flex gap-2">
          <input
            type="text"
            placeholder="Add an action item…"
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            className="input-base flex-1"
          />
          <AssigneePicker
            participants={participants}
            value={assignedTo}
            onChange={setAssignedTo}
          />
          <button
            type="submit"
            disabled={!newText.trim() || adding}
            className="btn-primary px-3 flex-shrink-0"
          >
            {adding ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
          </button>
        </form>
        {assignedTo && (
          <p className="text-xs text-violet-400/70 mt-1.5 pl-0.5">
            Will notify assignee via email
          </p>
        )}
      </div>
    </div>
  );
};

export default ActionTracker;
