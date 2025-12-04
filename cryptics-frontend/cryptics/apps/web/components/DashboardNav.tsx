"use client";

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Activity, BarChart3, DollarSign, TrendingUp } from './icons';

const navItems = [
  { name: "Home", href: "/dashboard", icon: Activity },
  { name: "Market", href: "/dashboard/market", icon: BarChart3 },
  { name: "Watchlist", href: "/dashboard/watchlist", icon: DollarSign },
  { name: "Analytics", href: "/dashboard/analytics", icon: TrendingUp },
];

export const DashboardNav: React.FC = () => {
  const pathname = usePathname();

  return (
    <div className="w-64 bg-zinc-950 border-r border-zinc-900 p-6 flex flex-col fixed h-full">
      <h2 className="text-2xl font-bold mb-10 tracking-tight text-white">Cryptics</h2>

      <nav className="space-y-2 flex-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 group ${
                isActive 
                  ? 'bg-blue-600 text-white' 
                  : 'hover:bg-zinc-900 text-zinc-400 hover:text-white'
              }`}
            >
              <item.icon className={`w-5 h-5 transition-colors ${
                isActive ? 'text-white' : 'text-zinc-500 group-hover:text-white'
              }`} />
              <span className={`font-medium transition-colors ${
                isActive ? 'text-white' : 'text-zinc-400 group-hover:text-white'
              }`}>
                {item.name}
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
};