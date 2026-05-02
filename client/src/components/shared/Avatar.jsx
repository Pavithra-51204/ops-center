import React from 'react';

const getInitials = (name = '') =>
  name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);

export const Avatar = ({ user, size = 'md', showName = false, className = '' }) => {
  const sizes = {
    xs: 'w-6 h-6 text-xs',
    sm: 'w-7 h-7 text-xs',
    md: 'w-8 h-8 text-sm',
    lg: 'w-10 h-10 text-sm',
    xl: 'w-12 h-12 text-base',
  };

  const circle = (
    <div
      className={`${sizes[size]} rounded-full flex items-center justify-center font-semibold flex-shrink-0 ${className}`}
      style={{ backgroundColor: user?.avatarColor || '#3b82f6' }}
      title={user?.name}
    >
      {getInitials(user?.name)}
    </div>
  );

  if (!showName) return circle;

  return (
    <div className="flex items-center gap-2">
      {circle}
      <span className="text-sm text-slate-200 font-medium">{user?.name}</span>
    </div>
  );
};

export const AvatarStack = ({ users = [], max = 4, size = 'sm' }) => {
  const visible = users.slice(0, max);
  const rest = users.length - max;

  const sizes = {
    xs: 'w-5 h-5 text-xs',
    sm: 'w-6 h-6 text-xs',
    md: 'w-7 h-7 text-xs',
  };

  return (
    <div className="flex -space-x-1.5">
      {visible.map((u, i) => (
        <div
          key={u._id || i}
          className={`${sizes[size]} rounded-full border-2 border-slate-900 flex items-center justify-center font-semibold flex-shrink-0`}
          style={{ backgroundColor: u.avatarColor || '#3b82f6' }}
          title={u.name}
        >
          {getInitials(u.name)}
        </div>
      ))}
      {rest > 0 && (
        <div
          className={`${sizes[size]} rounded-full border-2 border-slate-900 bg-slate-700 flex items-center justify-center text-slate-300 font-semibold`}
        >
          +{rest}
        </div>
      )}
    </div>
  );
};
