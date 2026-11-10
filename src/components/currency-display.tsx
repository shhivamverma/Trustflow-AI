'use client';

import React from 'react';

interface CurrencyDisplayProps {
  amount: string | number;
  currency?: string;
  showCode?: boolean;
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export function formatCurrencyAmount(amount: string | number): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(num)) return '0.00';
  return num.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function getCurrencySymbol(currency: string = 'USD'): string {
  switch (currency.toUpperCase()) {
    case 'USD':
      return '$';
    case 'EUR':
      return '€';
    case 'GBP':
      return '£';
    case 'CAD':
      return 'CA$';
    case 'AUD':
      return 'A$';
    case 'JPY':
      return '¥';
    case 'INR':
      return '₹';
    default:
      return `${currency} `;
  }
}

export function CurrencyDisplay({
  amount,
  currency = 'USD',
  showCode = true,
  className = '',
  size = 'md',
}: CurrencyDisplayProps) {
  const formatted = formatCurrencyAmount(amount);
  const symbol = getCurrencySymbol(currency);

  const sizeClasses = {
    sm: 'text-xs',
    md: 'text-sm font-semibold',
    lg: 'text-xl font-bold',
    xl: 'text-3xl font-extrabold tracking-tight',
  }[size];

  return (
    <span className={`inline-flex items-baseline gap-1 font-mono ${sizeClasses} ${className}`}>
      <span>{symbol}</span>
      <span>{formatted}</span>
      {showCode && (
        <span className="text-[0.75em] text-slate-400 font-sans uppercase font-normal ml-0.5">
          {currency}
        </span>
      )}
    </span>
  );
}

