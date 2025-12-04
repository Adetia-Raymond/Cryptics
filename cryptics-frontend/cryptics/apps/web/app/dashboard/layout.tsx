"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/providers/AuthProvider";
import { useRouter } from "next/navigation";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { authData, initialized, logout } = useAuth();
  const router = useRouter();

  const displayName = (() => {
    const u = authData?.user as any;
    if (!u) return "User";
    if (typeof u === "string") return u;
    return (
      u.name ?? u.full_name ?? u.fullName ?? u.username ?? u.email ?? "User"
    );
  })();

  useEffect(() => {
    if (!initialized) return;
    if (!authData?.access_token) {
      router.replace("/login");
    }
  }, [authData, router, initialized]);

  // Start collapsed by default for a compact sidebar
  const [collapsed, setCollapsed] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-black text-white flex">
      {/* Sidebar - desktop */}
      <aside className={`hidden md:flex flex-col fixed h-full transition-all duration-200 z-40 overflow-hidden ${collapsed ? 'w-24' : 'w-64'}`} aria-hidden={mobileOpen ? true : false}>
        <div className={`h-full bg-zinc-950 border-r border-zinc-900 ${collapsed ? 'p-2' : 'p-4'} flex flex-col ${collapsed ? 'items-center' : 'items-start'} overflow-hidden`}>
          <div className="w-full flex items-center justify-between mb-6 overflow-hidden">
            <div className="flex items-center gap-3">
              {/* Logo component - show compact logo when collapsed */}
              {/* eslint-disable-next-line @typescript-eslint/no-var-requires */}
              <div className="flex items-center">
                {/* Import lazily to avoid breaking server rendering */}
                {/* When collapsed we show only the logo, otherwise logo + label */}
                <div className="flex items-center gap-2">
                  <img
                    src="/logo.png"
                    alt="Cryptics"
                    className={`${collapsed ? 'h-16 w-16' : 'h-16 w-16'} flex-shrink-0 object-contain`}
                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                  />
                  {!collapsed && <span className="text-white font-bold tracking-tight text-2xl">Cryptics</span>}
                </div>
              </div>
            
            </div>
            <button onClick={() => setCollapsed((c) => !c)} className="text-zinc-400 hover:text-white p-2 rounded-md" aria-label="Toggle sidebar">
              {collapsed ? '»' : '«'}
            </button>
          </div>

          <nav className={`flex-1 w-full ${collapsed ? 'text-center' : ''}`}>
            <a href="/dashboard" className={`flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-zinc-900 transition-all duration-200 ${collapsed ? 'justify-center' : ''}`}>
              <div className="w-5 h-5 text-zinc-500">📊</div>
              {!collapsed && <span className="font-medium text-zinc-400">Home</span>}
            </a>
            <a href="/dashboard/market" className={`flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-zinc-900 transition-all duration-200 ${collapsed ? 'justify-center' : ''}`}>
              <div className="w-5 h-5 text-zinc-500">📈</div>
              {!collapsed && <span className="font-medium text-zinc-400">Market</span>}
            </a>
            {/* removed Watchlist and Analytics per request */}
          </nav>

          <div className={`mt-auto w-full ${collapsed ? 'text-center' : ''}`}>
            {!collapsed && <div className="text-sm text-zinc-400 mb-3">{displayName}</div>}
            <button
              onClick={() => logout()}
              className={`w-full py-2 px-3 bg-red-600 hover:bg-red-500 rounded text-sm transition-colors ${collapsed ? 'w-12 mx-auto' : ''}`}
            >
              {!collapsed ? 'Logout' : '⎋'}
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile topbar with hamburger */}
      <header className="md:hidden fixed left-0 right-0 top-0 z-50 bg-zinc-950 border-b border-zinc-900 p-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => setMobileOpen(true)} className="p-2 bg-zinc-900 rounded-md">☰</button>
          <div className="text-lg font-bold">Cryptics</div>
        </div>
        <div className="text-sm text-zinc-400">{displayName}</div>
      </header>

      {/* Mobile overlay menu */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 bg-black/60" onClick={() => setMobileOpen(false)}>
          <div className="absolute left-0 top-0 bottom-0 w-64 bg-zinc-950 border-r border-zinc-900 p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <div className="text-2xl font-bold">Cryptics</div>
              <button onClick={() => setMobileOpen(false)} className="text-zinc-400">✕</button>
            </div>
            <nav className="space-y-2">
              <a href="/dashboard" className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-zinc-900 transition-all duration-200 group">
                <div className="w-5 h-5 text-zinc-500">📊</div>
                <span className="font-medium text-zinc-400">Home</span>
              </a>
              <a href="/dashboard/market" className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-zinc-900 transition-all duration-200 group">
                <div className="w-5 h-5 text-zinc-500">📈</div>
                <span className="font-medium text-zinc-400">Market</span>
              </a>
            </nav>
            <div className="mt-auto pt-6 border-t border-zinc-800">
              <div className="text-sm text-zinc-400 mb-3">{displayName}</div>
              <button onClick={() => { logout(); }} className="w-full py-2 px-3 bg-red-600 hover:bg-red-500 rounded text-sm">Logout</button>
            </div>
          </div>
        </div>
      )}

      {/* Main content area with left margin for sidebar on desktop, and top padding for mobile header */}
      {/* Compute left margin only for medium+ screens so mobile doesn't get a static left gap */}
      <div className={`flex-1 ${collapsed ? 'md:ml-20' : 'md:ml-64'}`}> 
        <main className={`p-6 bg-gradient-to-br from-zinc-950 via-black to-zinc-950 min-h-screen pt-8 relative z-0`}>
          {children}
        </main>
      </div>
    </div>
  );
}
