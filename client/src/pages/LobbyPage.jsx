import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Plus, Radio, Search, Filter, Clock, Users,
  ArrowRight, Loader2, AlertTriangle,
} from 'lucide-react';
import { PriorityBadge, StatusBadge } from '../components/shared/Badge';
import { Avatar, AvatarStack } from '../components/shared/Avatar';
import Modal from '../components/shared/Modal';
import api from '../lib/api';
import { formatDistanceToNow } from 'date-fns';

const STATUS_FILTERS = ['all', 'active', 'monitoring', 'resolved'];

const CreateRoomModal = ({ isOpen, onClose, onCreated }) => {
  const [form, setForm] = useState({ title: '', description: '', priority: 'high', tags: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const payload = {
        ...form,
        tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean),
      };
      const { data } = await api.post('/rooms', payload);
      onCreated(data.room);
      onClose();
      setForm({ title: '', description: '', priority: 'high', tags: '' });
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create room');
    } finally {
      setLoading(false);
    }
  };

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Launch War-Room" size="md">
      {error && (
        <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-lg px-4 py-3 mb-4">
          <AlertTriangle size={14} />
          {error}
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1.5">Incident Title *</label>
          <input
            type="text"
            placeholder="e.g. Payment API Degraded — EU Region"
            value={form.title}
            onChange={set('title')}
            className="input-base"
            required
            maxLength={120}
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1.5">Description</label>
          <textarea
            placeholder="Briefly describe the incident, impact, and initial findings…"
            value={form.description}
            onChange={set('description')}
            rows={3}
            className="input-base resize-none"
            maxLength={500}
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1.5">Priority</label>
          <div className="grid grid-cols-4 gap-2">
            {['critical', 'high', 'medium', 'low'].map((p) => {
              const colors = {
                critical: 'border-red-500/40 text-red-400 bg-red-500/10',
                high: 'border-orange-500/40 text-orange-400 bg-orange-500/10',
                medium: 'border-yellow-500/40 text-yellow-400 bg-yellow-500/10',
                low: 'border-blue-500/40 text-blue-400 bg-blue-500/10',
              };
              const isSelected = form.priority === p;
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => setForm({ ...form, priority: p })}
                  className={`py-2 rounded-lg border text-xs font-semibold uppercase tracking-wide transition-all ${
                    isSelected ? colors[p] : 'border-slate-700 text-slate-500 hover:border-slate-600'
                  }`}
                >
                  {p}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1.5">Tags <span className="text-slate-600">(comma-separated)</span></label>
          <input
            type="text"
            placeholder="payments, api, eu-region"
            value={form.tags}
            onChange={set('tags')}
            className="input-base"
          />
        </div>

        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary flex-1 justify-center">
            Cancel
          </button>
          <button type="submit" disabled={loading} className="btn-primary flex-1 justify-center">
            {loading ? <Loader2 size={15} className="animate-spin" /> : <><Radio size={15} /> Launch</>}
          </button>
        </div>
      </form>
    </Modal>
  );
};

const RoomCard = ({ room }) => {
  const navigate = useNavigate();
  const participants = room.participants?.map((p) => p.user).filter(Boolean) || [];
  const elapsed = room.timeElapsed || '—';

  const priorityBorder = {
    critical: 'border-l-red-500',
    high: 'border-l-orange-500',
    medium: 'border-l-yellow-500',
    low: 'border-l-blue-500',
  };

  return (
    <div
      onClick={() => navigate(`/rooms/${room._id}`)}
      className={`card border-l-2 ${priorityBorder[room.priority] || 'border-l-slate-700'} p-5 hover:bg-slate-800/50 cursor-pointer transition-all group hover:border-slate-700`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <h3 className="font-medium text-slate-100 group-hover:text-blue-400 transition-colors leading-snug line-clamp-2">
          {room.title}
        </h3>
        <ArrowRight size={15} className="text-slate-600 group-hover:text-slate-400 transition-colors flex-shrink-0 mt-0.5" />
      </div>

      {/* Description */}
      {room.description && (
        <p className="text-xs text-slate-500 mb-3 line-clamp-2 leading-relaxed">{room.description}</p>
      )}

      {/* Badges */}
      <div className="flex items-center gap-2 flex-wrap mb-4">
        <PriorityBadge priority={room.priority} />
        <StatusBadge status={room.status} />
        {room.tags?.map((tag) => (
          <span key={tag} className="text-xs px-2 py-0.5 bg-slate-800 text-slate-500 border border-slate-700 rounded-md">
            {tag}
          </span>
        ))}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <AvatarStack users={participants} max={4} size="xs" />
          <span className="text-xs text-slate-600 flex items-center gap-1">
            <Users size={11} />
            {participants.length}
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs text-slate-600">
          {room.onlineCount > 0 && (
            <span className="flex items-center gap-1 text-emerald-400">
              <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
              {room.onlineCount} live
            </span>
          )}
          <span className="flex items-center gap-1">
            <Clock size={11} />
            {elapsed}
          </span>
        </div>
      </div>
    </div>
  );
};

const LobbyPage = () => {
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showCreate, setShowCreate] = useState(false);
  const [accessError, setAccessError] = useState('');
  const location = useLocation();

  const fetchRooms = async () => {
    try {
      const { data } = await api.get('/rooms');
      setRooms(data.rooms);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchRooms(); }, []);

  // Show access-denied banner if redirected from a 403
  useEffect(() => {
    if (location.state?.error) {
      setAccessError(location.state.error);
      const t = setTimeout(() => setAccessError(''), 6000);
      return () => clearTimeout(t);
    }
  }, [location.state]);

  const filtered = rooms.filter((r) => {
    const matchStatus = statusFilter === 'all' || r.status === statusFilter;
    const matchSearch = !search || r.title.toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchSearch;
  });

  const handleCreated = (room) => {
    setRooms((prev) => [room, ...prev]);
  };

  return (
    <div className="space-y-6">
      {/* Access-denied banner */}
      {accessError && (
        <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-xl px-4 py-3 animate-slide-up">
          <AlertTriangle size={15} className="flex-shrink-0" />
          <span className="flex-1">{accessError}</span>
          <button onClick={() => setAccessError('')} className="text-red-400/60 hover:text-red-300 transition-colors">×</button>
        </div>
      )}
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-2xl font-bold text-slate-100">War-Room Lobby</h2>
          <p className="text-slate-500 text-sm mt-1">{rooms.length} total incident{rooms.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary">
          <Plus size={16} />
          Launch War-Room
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Search rooms…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-base pl-9 py-2"
          />
        </div>
        <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-lg p-1">
          {STATUS_FILTERS.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium capitalize transition-all ${
                statusFilter === s
                  ? 'bg-slate-700 text-slate-100'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1,2,3,4,5,6].map(i => (
            <div key={i} className="card p-5 h-44 animate-pulse bg-slate-800/50" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card py-20 text-center">
          <Radio size={36} className="text-slate-700 mx-auto mb-3" />
          <p className="text-slate-400 font-medium">No war-rooms found</p>
          <p className="text-slate-600 text-sm mt-1">
            {search ? 'Try a different search term' : 'Launch one to get started'}
          </p>
          {!search && (
            <button onClick={() => setShowCreate(true)} className="btn-primary mx-auto mt-4">
              <Plus size={15} /> Launch War-Room
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((room) => <RoomCard key={room._id} room={room} />)}
        </div>
      )}

      <CreateRoomModal
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={handleCreated}
      />
    </div>
  );
};

export default LobbyPage;
