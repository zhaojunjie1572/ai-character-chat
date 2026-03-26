'use client';

import { useState } from 'react';
import { stringToColor, getInitials } from '@/lib/avatarLibrary';

interface AvatarProps {
  src?: string;
  name: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  borderColor?: string;
  showStatus?: boolean;
  status?: 'online' | 'offline' | 'busy' | 'away';
  className?: string;
  fallback?: 'initial' | 'default';
}

const sizeClasses = {
  xs: 'w-6 h-6 text-xs',
  sm: 'w-8 h-8 text-sm',
  md: 'w-10 h-10 text-base',
  lg: 'w-14 h-14 text-lg',
  xl: 'w-20 h-20 text-2xl',
};

const statusColors = {
  online: 'bg-green-500',
  offline: 'bg-gray-400',
  busy: 'bg-red-500',
  away: 'bg-yellow-500',
};

const statusSizes = {
  xs: 'w-1.5 h-1.5',
  sm: 'w-2 h-2',
  md: 'w-2.5 h-2.5',
  lg: 'w-3 h-3',
  xl: 'w-4 h-4',
};

export function Avatar({
  src,
  name,
  size = 'md',
  borderColor,
  showStatus = false,
  status = 'online',
  className = '',
  fallback = 'initial',
}: AvatarProps) {
  const [imageError, setImageError] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  const sizeClass = sizeClasses[size];
  const bgColor = stringToColor(name);
  const initial = getInitials(name);

  // 如果有头像且加载成功，显示头像
  const showImage = src && !imageError;
  // 否则显示首字母
  const showInitial = fallback === 'initial' && (!src || imageError);

  return (
    <div className={`relative inline-block ${className}`}>
      <div
        className={`
          ${sizeClass}
          rounded-full
          flex items-center justify-center
          font-semibold
          transition-all duration-200
          ${showImage ? 'overflow-hidden' : ''}
          ${borderColor ? `ring-2 ring-offset-2 ${borderColor}` : ''}
          ${showInitial ? 'text-white shadow-md' : ''}
        `}
        style={showInitial ? { backgroundColor: bgColor } : undefined}
      >
        {showImage && (
          <img
            src={src}
            alt={name}
            className={`
              w-full h-full object-cover
              transition-opacity duration-300
              ${imageLoaded ? 'opacity-100' : 'opacity-0'}
            `}
            onLoad={() => setImageLoaded(true)}
            onError={() => setImageError(true)}
          />
        )}

        {showInitial && (
          <span className="select-none">{initial}</span>
        )}

        {/* 加载占位 */}
        {showImage && !imageLoaded && (
          <div
            className="absolute inset-0 rounded-full animate-pulse"
            style={{ backgroundColor: bgColor }}
          />
        )}
      </div>

      {/* 状态指示器 */}
      {showStatus && (
        <span
          className={`
            absolute bottom-0 right-0
            ${statusSizes[size]}
            ${statusColors[status]}
            rounded-full
            ring-2 ring-white
            transition-transform duration-200
            hover:scale-125
          `}
          title={status === 'online' ? '在线' : status === 'busy' ? '忙碌' : status === 'away' ? '离开' : '离线'}
        />
      )}
    </div>
  );
}

// 带悬停效果的头像
export function AvatarWithHover({
  src,
  name,
  size = 'md',
  onClick,
  className = '',
}: AvatarProps & { onClick?: () => void }) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`
        relative inline-block
        transition-transform duration-200
        ${onClick ? 'cursor-pointer' : ''}
        ${isHovered ? 'scale-110' : 'scale-100'}
        ${className}
      `}
    >
      <Avatar
        src={src}
        name={name}
        size={size}
      />
      {isHovered && onClick && (
        <div className="absolute inset-0 bg-black/20 rounded-full flex items-center justify-center">
          <span className="text-white text-xs">更换</span>
        </div>
      )}
    </button>
  );
}

// 分组头像（显示多个头像的堆叠效果）
interface AvatarGroupProps {
  avatars: { src?: string; name: string }[];
  max?: number;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}

export function AvatarGroup({
  avatars,
  max = 4,
  size = 'md',
  className = '',
}: AvatarGroupProps) {
  const displayAvatars = avatars.slice(0, max);
  const remaining = avatars.length - max;

  const overlapClasses = {
    xs: '-space-x-1',
    sm: '-space-x-2',
    md: '-space-x-3',
    lg: '-space-x-4',
  };

  return (
    <div className={`flex items-center ${overlapClasses[size]} ${className}`}>
      {displayAvatars.map((avatar, index) => (
        <div
          key={index}
          className="relative ring-2 ring-white rounded-full"
          style={{ zIndex: displayAvatars.length - index }}
        >
          <Avatar
            src={avatar.src}
            name={avatar.name}
            size={size}
          />
        </div>
      ))}
      {remaining > 0 && (
        <div
          className={`
            relative
            flex items-center justify-center
            rounded-full
            bg-gray-200 text-gray-600
            font-medium
            ring-2 ring-white
            ${size === 'xs' ? 'w-6 h-6 text-xs' : ''}
            ${size === 'sm' ? 'w-8 h-8 text-sm' : ''}
            ${size === 'md' ? 'w-10 h-10 text-base' : ''}
            ${size === 'lg' ? 'w-14 h-14 text-lg' : ''}
          `}
        >
          +{remaining}
        </div>
      )}
    </div>
  );
}
