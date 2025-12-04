import React from "react";

export default function Logo({ size = 28 }: { size?: number }) {
  const s = size;
  return (
    <div className="flex items-center gap-2">
      {/* Prefer served logo if available, fallback to inline SVG */}
      <img src="/logo.png" alt="Cryptics" width={s} height={s} className="h-8 w-8 object-contain" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
      <svg viewBox="0 0 100 100" width={s} height={s} className="h-8 w-8 object-contain" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Cryptics logo">
        <defs>
          <linearGradient id="g" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="#6ee7b7" />
            <stop offset="100%" stopColor="#60a5fa" />
          </linearGradient>
        </defs>
        <rect x="6" y="6" width="88" height="88" rx="14" fill="#0f172a" />
        <path d="M20 60 L40 40 L60 60 L80 30" stroke="url(#g)" strokeWidth="6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="60" cy="28" r="6" fill="#60a5fa" />
      </svg>
    </div>
  );
}
