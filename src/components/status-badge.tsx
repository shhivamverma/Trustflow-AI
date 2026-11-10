'use client';

import React from 'react';
import {
  FileEdit,
  Send,
  CheckCircle2,
  AlertCircle,
  Clock,
  Ban,
  RotateCcw,
  RefreshCw,
} from 'lucide-react';

export type InvoiceStatus =
  | 'DRAFT'
  | 'SENT'
  | 'UNPAID'
  | 'PAID'
  | 'PARTIALLY_PAID'
  | 'OVERDUE'
  | 'CANCELED'
  | 'REFUNDED'
  | 'NEEDS_SYNC';

interface StatusBadgeProps {
  status: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function StatusBadge({ status, size = 'md', className = '' }: StatusBadgeProps) {
  const normalized = status.toUpperCase().replace(/\s+/g, '_');

  let config = {
    label: 'Draft',
    bg: 'bg-slate-500/10 text-slate-300 border-slate-500/30',
    icon: FileEdit,
    description: 'Draft created locally; unsent',
  };

  switch (normalized) {
    case 'DRAFT':
      config = {
        label: 'Draft',
        bg: 'bg-slate-500/10 text-slate-300 border-slate-500/30',
        icon: FileEdit,
        description: 'Draft created locally; unsent',
      };
      break;
    case 'SENT':
    case 'UNPAID':
    case 'SENT_UNPAID':
      config = {
        label: 'Sent / Unpaid',
        bg: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
        icon: Send,
        description: 'Invoice sent through PayPal; awaiting payment',
      };
      break;
    case 'PAID':
      config = {
        label: 'Paid',
        bg: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
        icon: CheckCircle2,
        description: 'Fully paid and reconciled with PayPal',
      };
      break;
    case 'PARTIALLY_PAID':
    case 'PARTIAL':
      config = {
        label: 'Partially Paid',
        bg: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
        icon: Clock,
        description: 'Partial balance received',
      };
      break;
    case 'OVERDUE':
      config = {
        label: 'Overdue (Derived)',
        bg: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
        icon: AlertCircle,
        description: 'Due date has passed with unpaid balance',
      };
      break;
    case 'CANCELED':
    case 'CANCELLED':
      config = {
        label: 'Canceled',
        bg: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30',
        icon: Ban,
        description: 'Canceled on PayPal',
      };
      break;
    case 'REFUNDED':
      config = {
        label: 'Refunded',
        bg: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
        icon: RotateCcw,
        description: 'Payment refunded via PayPal',
      };
      break;
    case 'NEEDS_SYNC':
    case 'NEEDSSYNC':
      config = {
        label: 'Needs Sync',
        bg: 'bg-orange-500/15 text-orange-300 border-orange-500/30',
        icon: RefreshCw,
        description: 'Local status may be out of date with PayPal',
      };
      break;
    default:
      config = {
        label: status,
        bg: 'bg-slate-500/10 text-slate-300 border-slate-500/30',
        icon: FileEdit,
        description: status,
      };
  }

  const Icon = config.icon;
  const sizeClasses =
    size === 'sm'
      ? 'text-[11px] px-2 py-0.5 gap-1'
      : size === 'lg'
      ? 'text-sm px-3.5 py-1.5 gap-2'
      : 'text-xs px-2.5 py-1 gap-1.5';

  return (
    <span
      className={`inline-flex items-center font-medium rounded-full border ${config.bg} ${sizeClasses} ${className}`}
      title={config.description}
      aria-label={`Status: ${config.label}`}
    >
      <Icon className={size === 'sm' ? 'w-3 h-3' : size === 'lg' ? 'w-4 h-4' : 'w-3.5 h-3.5'} />
      <span>{config.label}</span>
    </span>
  );
}

