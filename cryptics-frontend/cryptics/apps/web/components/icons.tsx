import React from 'react';

// Lucide React Icon Components
export const TrendingUp: React.FC<{ className?: string }> = ({ className = "" }) => (
  <svg className={`w-4 h-4 ${className}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m3 17 6-6 4 4 8-8" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m14 5 4 4-4 4" />
  </svg>
);

export const TrendingDown: React.FC<{ className?: string }> = ({ className = "" }) => (
  <svg className={`w-4 h-4 ${className}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m3 7 6 6 4-4 8 8" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m14 19-4-4 4-4" />
  </svg>
);

export const Activity: React.FC<{ className?: string }> = ({ className = "" }) => (
  <svg className={`w-4 h-4 ${className}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M22 12h-4l-3 9L9 3l-3 9H2" />
  </svg>
);

export const DollarSign: React.FC<{ className?: string }> = ({ className = "" }) => (
  <svg className={`w-4 h-4 ${className}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 1v22" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
  </svg>
);

export const BarChart3: React.FC<{ className?: string }> = ({ className = "" }) => (
  <svg className={`w-4 h-4 ${className}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3v18h18" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.7 8l-5.1 5.2-2.8-2.7L7 14.3" />
  </svg>
);