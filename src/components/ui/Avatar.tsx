import React from 'react';
import { hashIndex } from '@/utils/colorHash';

const PALETTE = ['bg-blue-100 text-blue-700', 'bg-amber-100 text-amber-700', 'bg-emerald-100 text-emerald-700', 'bg-violet-100 text-violet-700', 'bg-rose-100 text-rose-700'];

const SIZE_CLASSES = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-9 w-9 text-xs',
  lg: 'h-14 w-14 text-base',
};

function colorFor(seed: string): string {
  return PALETTE[hashIndex(seed, PALETTE.length)];
}

function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

interface AvatarProps {
  name: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const Avatar: React.FC<AvatarProps> = ({ name, size = 'md', className = '' }) => (
  <span
    className={`flex flex-shrink-0 items-center justify-center rounded-full font-semibold ${SIZE_CLASSES[size]} ${colorFor(name)} ${className}`}
  >
    {initialsFor(name)}
  </span>
);

export default Avatar;
