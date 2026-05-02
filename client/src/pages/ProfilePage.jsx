import React, { useState } from 'react';
import { User, Mail, Shield, Save, Loader2, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Avatar } from '../components/shared/Avatar';

const ProfilePage = () => {
  const { user, updateProfile } = useAuth();
  const [form, setForm] = useState({ name: user?.name || '', role: user?.role || 'engineer' });
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await updateProfile(form);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error('Profile update failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h2 className="font-display text-2xl font-bold text-slate-100">Profile</h2>
        <p className="text-slate-500 text-sm mt-1">Manage your account information</p>
      </div>

      {/* Avatar card */}
      <div className="card p-6 flex items-center gap-6">
        <Avatar user={user} size="xl" />
        <div>
          <h3 className="font-display font-semibold text-slate-100 text-lg">{user?.name}</h3>
          <p className="text-slate-500 text-sm">{user?.email}</p>
          <p className="text-xs text-slate-600 mt-1 capitalize">
            Role: <span className="text-slate-400">{user?.role}</span>
          </p>
        </div>
      </div>

      {/* Edit form */}
      <div className="card p-6">
        <h3 className="font-display font-semibold text-slate-100 mb-5 flex items-center gap-2">
          <User size={16} className="text-blue-400" />
          Account Details
        </h3>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Full Name</label>
            <input
              type="text"
              value={form.name}
              onChange={set('name')}
              className="input-base"
              required
              maxLength={60}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Email Address</label>
            <div className="relative">
              <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="email"
                value={user?.email || ''}
                className="input-base pl-9 opacity-60 cursor-not-allowed"
                disabled
              />
            </div>
            <p className="text-xs text-slate-600 mt-1">Email cannot be changed</p>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Role</label>
            <select value={form.role} onChange={set('role')} className="input-base">
              <option value="engineer">Engineer</option>
              <option value="lead">Team Lead</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          <div className="pt-2 flex items-center gap-3">
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? (
                <Loader2 size={15} className="animate-spin" />
              ) : saved ? (
                <><CheckCircle2 size={15} className="text-emerald-400" /> Saved!</>
              ) : (
                <><Save size={15} /> Save Changes</>
              )}
            </button>
            {saved && (
              <span className="text-sm text-emerald-400 animate-fade-in">
                Profile updated successfully
              </span>
            )}
          </div>
        </form>
      </div>

      {/* Stats */}
      <div className="card p-6">
        <h3 className="font-display font-semibold text-slate-100 mb-4 flex items-center gap-2">
          <Shield size={16} className="text-blue-400" />
          Account Info
        </h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between py-2 border-b border-slate-800">
            <span className="text-sm text-slate-500">Member since</span>
            <span className="text-sm text-slate-300">
              {user?.createdAt ? new Date(user.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '—'}
            </span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-slate-800">
            <span className="text-sm text-slate-500">Active rooms</span>
            <span className="text-sm text-slate-300">{user?.activeRooms?.length || 0}</span>
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="text-sm text-slate-500">Avatar color</span>
            <div
              className="w-5 h-5 rounded-full"
              style={{ backgroundColor: user?.avatarColor || '#3b82f6' }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
