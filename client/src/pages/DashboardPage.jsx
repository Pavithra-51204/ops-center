import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Radio, CheckCircle2, AlertTriangle, Clock, TrendingUp,
  ArrowRight, Plus, Users,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { PriorityBadge, StatusBadge } from '../components/shared/Badge';
import { AvatarStack } from '../components/shared/Avatar';
import api from '../lib/api';
import { formatDistanceToNow } from 'date-fns';

const StatCard = ({ icon: Icon, label, value, color, sub }) => (
  <div className="card p-5 flex items-start gap-4">
    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
      <Icon size={18} />
    </div>
    <div>
      <p className="text-2xl font-display font-bold text-slate-100">{value}</p>
      <p className="text-sm text-slate-400 mt-0.5">{label}</p>
      {sub && <p className="text-xs text-slate-600 mt-1">{sub}</p>}
    </div>
  </div>
);

const RoomRow = ({ room }) => {
  const navigate = useNavigate();
  const participants = room.participants?.map((p) => p.user).filter(Boolean) || [];

  return (
    <div
      onClick={() => navigate(`/rooms/${room._id}`)}
      className="flex items-center gap-4 p-4 rounded-xl hover:bg-slate-800/50 cursor-pointer transition-all group border border-transparent hover:border-slate-700/50"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <p className="text-sm font-medium text-slate-100 truncate group-hover:text-blue-400 transition-colors">
            {room.title}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <PriorityBadge priority={room.priority} size="xs" />
          <StatusBadge status={room.status} size="xs" />
          <span className="text-xs text-slate-600 flex items-center gap-1">
            <Clock size={10} />
            {formatDistanceToNow(new Date(room.createdAt), { addSuffix: true })}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-3 flex-shrink-0">
        <AvatarStack users={participants} max={3} size="xs" />
        {room.onlineCount > 0 && (
          <span className="text-xs text-emerald-400 flex items-center gap-1">
            <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
            {room.onlineCount} live
          </span>
        )}
        <ArrowRight size={14} className="text-slate-600 group-hover:text-slate-400 transition-colors" />
      </div>
    </div>
  );
};

const DashboardPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRooms = async () => {
      try {
        const { data } = await api.get('/rooms');
        setRooms(data.rooms);
      } catch (err) {
        console.error('Failed to fetch rooms:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchRooms();
  }, []);

  const active = rooms.filter((r) => r.status === 'active');
  const monitoring = rooms.filter((r) => r.status === 'monitoring');
  const resolved = rooms.filter((r) => r.status === 'resolved');
  const myRooms = rooms.filter((r) =>
    r.participants?.some((p) => p.user?._id === user?._id || p.user === user?._id)
  );

  const stats = [
    { icon: Radio, label: 'Active Incidents', value: active.length, color: 'bg-red-500/15 text-red-400', sub: 'Requiring attention' },
    { icon: AlertTriangle, label: 'Monitoring', value: monitoring.length, color: 'bg-yellow-500/15 text-yellow-400', sub: 'Under observation' },
    { icon: CheckCircle2, label: 'Resolved Today', value: resolved.length, color: 'bg-emerald-500/15 text-emerald-400', sub: 'Closed out' },
    { icon: Users, label: 'My Rooms', value: myRooms.length, color: 'bg-blue-500/15 text-blue-400', sub: 'You\'re participating' },
  ];

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="font-display text-2xl font-bold text-slate-100">
            Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 18 ? 'afternoon' : 'evening'},{' '}
            <span className="text-blue-400">{user?.name?.split(' ')[0]}</span>
          </h2>
          <p className="text-slate-500 text-sm mt-1">
            {active.length > 0
              ? `${active.length} active incident${active.length > 1 ? 's' : ''} requiring attention.`
              : 'All systems nominal. No active incidents.'}
          </p>
        </div>
        <button onClick={() => navigate('/lobby')} className="btn-primary flex-shrink-0">
          <Plus size={16} />
          Launch War-Room
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => <StatCard key={s.label} {...s} />)}
      </div>

      {/* Main content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Active rooms */}
        <div className="lg:col-span-2 card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-semibold text-slate-100 flex items-center gap-2">
              <Radio size={16} className="text-red-400" />
              Active Incidents
            </h3>
            <button onClick={() => navigate('/lobby')} className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors">
              View all <ArrowRight size={12} />
            </button>
          </div>

          {loading ? (
            <div className="space-y-3">
              {[1,2,3].map(i => (
                <div key={i} className="h-16 bg-slate-800/50 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : active.length === 0 ? (
            <div className="py-12 text-center">
              <CheckCircle2 size={32} className="text-emerald-500/40 mx-auto mb-3" />
              <p className="text-slate-500 text-sm">No active incidents</p>
              <p className="text-slate-600 text-xs mt-1">All systems are operating normally</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-800/60">
              {active.slice(0, 5).map((r) => <RoomRow key={r._id} room={r} />)}
            </div>
          )}
        </div>

        {/* My rooms */}
        <div className="card p-5">
          <h3 className="font-display font-semibold text-slate-100 flex items-center gap-2 mb-4">
            <TrendingUp size={16} className="text-blue-400" />
            My Active Rooms
          </h3>
          {myRooms.filter(r => r.status !== 'resolved').length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-slate-500 text-sm">Not in any active rooms</p>
              <button onClick={() => navigate('/lobby')} className="text-xs text-blue-400 hover:text-blue-300 mt-2 flex items-center gap-1 mx-auto transition-colors">
                Browse lobby <ArrowRight size={11} />
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {myRooms.filter(r => r.status !== 'resolved').map((room) => (
                <button
                  key={room._id}
                  onClick={() => navigate(`/rooms/${room._id}`)}
                  className="w-full text-left p-3 rounded-lg hover:bg-slate-800 transition-all group"
                >
                  <p className="text-sm font-medium text-slate-300 group-hover:text-blue-400 transition-colors truncate">{room.title}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <PriorityBadge priority={room.priority} size="xs" />
                    <span className="text-xs text-slate-600">{formatDistanceToNow(new Date(room.createdAt), { addSuffix: true })}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
