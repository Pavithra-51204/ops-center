import React, { useState, useEffect, useCallback } from 'react';
import { Users, Wifi, UserPlus, Search, Loader2, CheckCircle2, AlertTriangle, X } from 'lucide-react';
import { Avatar } from '../shared/Avatar';
import { getSocket } from '../../lib/socket';
import api from '../../lib/api';

// ── Invite Modal ──────────────────────────────────────────────────────────────
const InviteModal = ({ roomId, onClose }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [inviting, setInviting] = useState(null); // userId being invited
  const [invited, setInvited] = useState(new Set()); // already-invited userIds
  const [error, setError] = useState('');

  // Debounced search
  useEffect(() => {
    if (query.trim().length < 2) { setResults([]); return; }
    const timer = setTimeout(async () => {
      setSearching(true);
      setError('');
      try {
        const { data } = await api.get(`/auth/users/search?email=${encodeURIComponent(query.trim())}`);
        setResults(data.users || []);
      } catch (err) {
        setError(err.response?.data?.message || 'Search failed');
      } finally {
        setSearching(false);
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [query]);

  const handleInvite = async (userId, userName) => {
    setInviting(userId);
    setError('');
    try {
      const { data } = await api.post(`/rooms/${roomId}/invite`, { userId });
      setInvited((prev) => new Set([...prev, userId]));
    } catch (err) {
      setError(err.response?.data?.message || `Failed to invite ${userName}`);
    } finally {
      setInviting(null);
    }
  };

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      <div className="relative w-full max-w-md bg-slate-900 border border-slate-700/60 rounded-2xl shadow-2xl animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-violet-500/20 border border-violet-500/30 flex items-center justify-center">
              <UserPlus size={14} className="text-violet-400" />
            </div>
            <div>
              <h2 className="font-semibold text-slate-100 text-base leading-tight">Invite to War-Room</h2>
              <p className="text-xs text-slate-500">Search by email address</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-all"
          >
            <X size={15} />
          </button>
        </div>

        {/* Search */}
        <div className="px-5 pt-4 pb-3">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              autoFocus
              type="email"
              placeholder="engineer@company.com"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="input-base pl-9 py-2.5"
            />
            {searching && (
              <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 animate-spin" />
            )}
          </div>

          {error && (
            <div className="flex items-center gap-2 mt-2 text-xs text-red-400">
              <AlertTriangle size={12} />
              {error}
            </div>
          )}
        </div>

        {/* Results */}
        <div className="px-5 pb-5 space-y-1 max-h-64 overflow-y-auto">
          {results.length === 0 && query.trim().length >= 2 && !searching && (
            <p className="text-center text-sm text-slate-600 py-4">No users found for that email</p>
          )}

          {results.map((user) => {
            const isInvited = invited.has(user._id);
            const isInviting = inviting === user._id;
            return (
              <div
                key={user._id}
                className="flex items-center gap-3 p-3 rounded-xl bg-slate-800/40 border border-slate-800 hover:border-slate-700 transition-all"
              >
                <Avatar user={user} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-200 truncate">{user.name}</p>
                  <p className="text-xs text-slate-500 truncate">{user.email}</p>
                </div>
                <span className="text-xs text-slate-600 capitalize px-2 py-0.5 bg-slate-800 rounded-md border border-slate-700 mr-1">
                  {user.role}
                </span>
                <button
                  onClick={() => handleInvite(user._id, user.name)}
                  disabled={isInvited || isInviting}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex-shrink-0 ${
                    isInvited
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 cursor-default'
                      : 'bg-violet-500/20 hover:bg-violet-500/30 text-violet-300 border border-violet-500/30'
                  }`}
                >
                  {isInviting ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : isInvited ? (
                    <><CheckCircle2 size={12} /> Invited</>
                  ) : (
                    <><UserPlus size={12} /> Invite</>
                  )}
                </button>
              </div>
            );
          })}
        </div>

        {/* Hint */}
        <div className="px-5 py-3 border-t border-slate-800">
          <p className="text-xs text-slate-600">
            Invited users will receive an email and can join this War-Room.
          </p>
        </div>
      </div>
    </div>
  );
};

// ── PresencePanel ─────────────────────────────────────────────────────────────
const PresencePanel = ({ roomId, participants = [] }) => {
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [showInvite, setShowInvite] = useState(false);
  const socket = getSocket();

  useEffect(() => {
    socket.on('presence_update', (users) => {
      setOnlineUsers(users);
    });

    socket.on('user_joined', ({ user }) => {
      // Handled by presence_update
    });

    socket.on('user_left', ({ user }) => {
      // Handled by presence_update
    });

    return () => {
      socket.off('presence_update');
      socket.off('user_joined');
      socket.off('user_left');
    };
  }, [socket]);

  // Heartbeat to keep presence alive
  useEffect(() => {
    const interval = setInterval(() => {
      socket.emit('heartbeat', { roomId });
    }, 20000);
    return () => clearInterval(interval);
  }, [roomId, socket]);

  const onlineIds = new Set(onlineUsers.map((u) => u._id));

  return (
    <>
      <div className="p-4 space-y-4">
        {/* Online now */}
        {onlineUsers.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-1.5">
              <Wifi size={11} className="text-emerald-400" />
              Live ({onlineUsers.length})
            </h4>
            <div className="space-y-2">
              {onlineUsers.map((u) => (
                <div key={u._id} className="flex items-center gap-2.5">
                  <div className="relative">
                    <Avatar user={u} size="sm" />
                    <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-400 rounded-full border-2 border-slate-900" />
                  </div>
                  <span className="text-sm text-slate-300 font-medium">{u.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* All participants */}
        <div>
          <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-1.5">
            <Users size={11} />
            Participants ({participants.length})
          </h4>
          <div className="space-y-2">
            {participants.map((p) => {
              const u = p.user || p;
              const isOnline = onlineIds.has(u?._id);
              return (
                <div key={u?._id} className="flex items-center gap-2.5">
                  <div className="relative">
                    <Avatar user={u} size="sm" />
                    {isOnline && (
                      <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-400 rounded-full border-2 border-slate-900" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium truncate ${isOnline ? 'text-slate-200' : 'text-slate-500'}`}>
                      {u?.name}
                    </p>
                  </div>
                  {!isOnline && (
                    <span className="text-xs text-slate-700">away</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Invite button */}
        <div className="pt-1 border-t border-slate-800/60">
          <button
            onClick={() => setShowInvite(true)}
            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border border-dashed border-slate-700 text-slate-500 hover:border-violet-500/50 hover:text-violet-400 hover:bg-violet-500/5 text-xs font-medium transition-all group"
          >
            <UserPlus size={13} className="group-hover:scale-110 transition-transform" />
            Invite User
          </button>
        </div>
      </div>

      {/* Invite modal — rendered outside the panel div to escape overflow:hidden */}
      {showInvite && (
        <InviteModal roomId={roomId} onClose={() => setShowInvite(false)} />
      )}
    </>
  );
};

export default PresencePanel;
