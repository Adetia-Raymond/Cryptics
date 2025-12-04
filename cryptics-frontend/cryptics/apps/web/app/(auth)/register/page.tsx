// cryptics/apps/web/app/(auth)/register/page.tsx
"use client";

import { useState } from "react";
import { registerUser, login } from "@cryptics/api";
import Cookies from "js-cookie";
import { useAuth } from "@/providers/AuthProvider";
import Link from "next/link";

export default function RegisterPage() {
  const { setAuthData } = useAuth();
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleRegister(e: any) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      await registerUser(email, username, password);

      // ⭐ After register → login automatically
      const res = await login(email, password);

      // Backend sets httpOnly refresh cookie; persist only access_token/user client-side
      setAuthData({
        access_token: res.access_token,
        user: res.user,
      });

      window.location.href = "/dashboard";
    } catch (err: any) {
      setError(err?.response?.data?.detail || "Registration failed");
    }

    setLoading(false);
  }

  return (
    <div className="flex items-center justify-center h-screen bg-zinc-950 text-white px-4">
      <form
        onSubmit={handleRegister}
        className="w-full max-w-md p-8 rounded-xl bg-zinc-900 border border-zinc-800 shadow-xl"
      >
        <h1 className="text-3xl font-bold mb-3">Create account</h1>
        <p className="text-zinc-400 mb-6">Start using Cryptics</p>

        {error && <div className="mb-4 text-red-400">{error}</div>}

        <label className="block mb-2 text-sm">Email</label>
        <input
          type="email"
          className="w-full px-3 py-2 mb-4 rounded bg-zinc-800 border border-zinc-700"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <label className="block mb-2 text-sm">Username</label>
        <input
          type="text"
          className="w-full px-3 py-2 mb-4 rounded bg-zinc-800 border border-zinc-700"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
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
          {loading ? "Creating..." : "Register"}
        </button>

        <p className="text-center text-zinc-500 mt-4 text-sm">
          Already have an account?
          <Link href="/login" className="text-blue-400 ml-1">
            Login
          </Link>
        </p>
      </form>
    </div>
  );
}
