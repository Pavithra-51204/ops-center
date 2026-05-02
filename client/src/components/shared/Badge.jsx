import React from 'react';

const PRIORITY_MAP = {
  critical: 'badge-critical',
  high: 'badge-high',
  medium: 'badge-medium',
  low: 'badge-low',
};

const STATUS_MAP = {
  active: 'badge-active',
  monitoring: 'badge-monitoring',
  resolved: 'badge-resolved',
};

const PRIORITY_DOT = {
  critical: 'bg-red-400 animate-pulse',
  high: 'bg-orange-400',
  medium: 'bg-yellow-400',
  low: 'bg-blue-400',
};

const STATUS_DOT = {
  active: 'bg-red-400 animate-pulse',
  monitoring: 'bg-yellow-400',
  resolved: 'bg-emerald-400',
};

export const PriorityBadge = ({ priority, size = 'sm' }) => {
  const cls = PRIORITY_MAP[priority] || 'badge-low';
  const dot = PRIORITY_DOT[priority] || 'bg-slate-400';
  const sizeClass = size === 'xs' ? 'text-xs px-1.5 py-0.5' : 'text-xs px-2 py-1';
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-md ${cls} ${sizeClass}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
      {priority?.toUpperCase()}
    </span>
  );
};

export const StatusBadge = ({ status, size = 'sm' }) => {
  const cls = STATUS_MAP[status] || 'badge-low';
  const dot = STATUS_DOT[status] || 'bg-slate-400';
  const sizeClass = size === 'xs' ? 'text-xs px-1.5 py-0.5' : 'text-xs px-2 py-1';
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-md ${cls} ${sizeClass}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
      {status?.toUpperCase()}
    </span>
  );
};
