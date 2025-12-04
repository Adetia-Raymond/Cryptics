// cryptics/apps/web/app/(auth)/login/page.tsx
"use client";

import { useState } from "react";
import { login } from "@cryptics/api";
import { useAuth } from "@/providers/AuthProvider";
import Cookies from "js-cookie";
import Link from "next/link";

export default function LoginPage() {
  const { setAuthData } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(e: any) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await login(email, password);

      // Backend sets httpOnly refresh cookie; store only access token and user client-side
      setAuthData({
        access_token: res.access_token,
        user: res.user,
      });

      window.location.href = "/dashboard";
    } catch (err: any) {
      // Normalize backend error shapes: Pydantic validation returns an array of objects,
      // other errors may return { detail: "..." } or { detail: { msg: "..." } }
      const detail = err?.response?.data?.detail;
      let message = "Login failed";
      if (typeof detail === "string") {
        message = detail;
      } else if (Array.isArray(detail)) {
        // map pydantic-like errors to readable messages
        try {
          const parts = detail.map((d: any) => d?.msg || d?.message || JSON.stringify(d));
          message = parts.join("; ");
        } catch (e) {
          message = JSON.stringify(detail);
        }
      } else if (detail && typeof detail === "object") {
        message = detail.msg || detail.message || JSON.stringify(detail);
      } else if (err?.message) {
        message = err.message;
      }
      setError(message);
    }

    setLoading(false);
  }

  return (
    <div className="flex items-center justify-center h-screen bg-zinc-950 text-white px-4">
      <form
        onSubmit={handleLogin}
        className="w-full max-w-md p-8 rounded-xl bg-zinc-900 border border-zinc-800 shadow-xl"
      >
        <h1 className="text-3xl font-bold mb-3">Sign in</h1>
        <p className="text-zinc-400 mb-6">Access your Cryptics dashboard</p>

        {error && (
          <div className="mb-4 text-red-400 bg-red-950/40 p-2 rounded">
            {error}
          </div>
        )}

        <label className="block mb-2 text-sm">Email</label>
        <input
          type="email"
          className="w-full px-3 py-2 mb-4 rounded bg-zinc-800 border border-zinc-700"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <label className="block mb-2 text-sm">Password</label>
        <input
          type="password"
          className="w-full px-3 py-2 mb-6 rounded bg-zinc-800 border border-zinc-700"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 bg-blue-600 hover:bg-blue-500 transition rounded-lg font-semibold"
        >
          {loading ? "Signing in..." : "Login"}
        </button>

        <p className="text-center text-zinc-500 mt-4 text-sm">
          No account?
          <Link href="/register" className="text-blue-400 ml-1">
            Register
          </Link>
        </p>
      </form>
    </div>
  );
}
