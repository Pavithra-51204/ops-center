import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Radio, User, LogOut, Shield, ChevronRight,
  Menu, X, Bell, Zap,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Avatar } from '../shared/Avatar';

const NAV_ITEMS = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
  { label: 'War-Room Lobby', icon: Radio, path: '/lobby' },
  { label: 'Profile', icon: User, path: '/profile' },
];

const Sidebar = ({ collapsed, onToggle }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <aside
      className={`
        fixed top-0 left-0 h-full z-30 flex flex-col
        bg-slate-900 border-r border-slate-800
        transition-all duration-300 ease-in-out
        ${collapsed ? 'w-16' : 'w-[240px]'}
      `}
    >
      {/* Logo */}
      <div className="h-16 flex items-center px-4 border-b border-slate-800 flex-shrink-0">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center flex-shrink-0">
            <Shield size={16} className="text-white" />
          </div>
          {!collapsed && (
            <span className="font-display font-bold text-slate-100 text-lg tracking-tight whitespace-nowrap">
              Ops-Center
            </span>
          )}
        </div>
        <button
          onClick={onToggle}
          className="ml-auto text-slate-500 hover:text-slate-300 transition-colors p-1 rounded"
        >
          {collapsed ? <ChevronRight size={16} /> : <Menu size={16} />}
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-4 space-y-0.5 overflow-y-auto">
        {!collapsed && (
          <p className="text-xs font-semibold text-slate-600 uppercase tracking-widest px-3 mb-3">
            Navigation
          </p>
        )}
        {NAV_ITEMS.map(({ label, icon: Icon, path }) => {
          const isActive = location.pathname === path;
          return (
            <button
              key={path}
              onClick={() => navigate(path)}
              className={`nav-item w-full ${isActive ? 'nav-item-active' : ''} ${collapsed ? 'justify-center px-2' : ''}`}
              title={collapsed ? label : undefined}
            >
              <Icon size={17} className={isActive ? 'text-blue-400' : ''} />
              {!collapsed && <span>{label}</span>}
              {!collapsed && isActive && <ChevronRight size={14} className="ml-auto text-slate-600" />}
            </button>
          );
        })}
      </nav>

      {/* User footer */}
      <div className="border-t border-slate-800 p-3 flex-shrink-0">
        {collapsed ? (
          <div className="flex flex-col items-center gap-2">
            <Avatar user={user} size="sm" />
            <button
              onClick={handleLogout}
              className="text-slate-500 hover:text-red-400 transition-colors p-1"
              title="Logout"
            >
              <LogOut size={14} />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <Avatar user={user} size="md" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-200 truncate">{user?.name}</p>
              <p className="text-xs text-slate-500 truncate capitalize">{user?.role}</p>
            </div>
            <button
              onClick={handleLogout}
              className="text-slate-500 hover:text-red-400 transition-colors p-1.5 rounded-lg hover:bg-red-500/10 flex-shrink-0"
              title="Logout"
            >
              <LogOut size={15} />
            </button>
          </div>
        )}
      </div>
    </aside>
  );
};

const TopBar = ({ sidebarCollapsed }) => {
  const { user } = useAuth();
  const location = useLocation();

  const getTitle = () => {
    if (location.pathname === '/dashboard') return 'Dashboard';
    if (location.pathname === '/lobby') return 'War-Room Lobby';
    if (location.pathname.startsWith('/rooms/')) return 'War-Room';
    if (location.pathname === '/profile') return 'Profile';
    return 'Ops-Center';
  };

  return (
    <header
      className={`
        fixed top-0 right-0 h-16 z-20 flex items-center px-6
        bg-slate-950/80 backdrop-blur-md border-b border-slate-800/60
        transition-all duration-300
        ${sidebarCollapsed ? 'left-16' : 'left-[240px]'}
      `}
    >
      <div className="flex items-center gap-2">
        <Zap size={14} className="text-blue-400" />
        <h1 className="font-display font-semibold text-slate-100 text-lg">{getTitle()}</h1>
      </div>
      <div className="ml-auto flex items-center gap-3">
        <button className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-all relative">
          <Bell size={17} />
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-blue-500 rounded-full" />
        </button>
        <Avatar user={user} size="sm" />
      </div>
    </header>
  );
};

const AppShell = ({ children }) => {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="min-h-screen bg-slate-950">
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />
      <TopBar sidebarCollapsed={collapsed} />
      <main
        className={`pt-16 min-h-screen transition-all duration-300 ${collapsed ? 'pl-16' : 'pl-[240px]'}`}
      >
        <div className="p-6 max-w-7xl mx-auto animate-fade-in">{children}</div>
      </main>
    </div>
  );
};

export default AppShell;
