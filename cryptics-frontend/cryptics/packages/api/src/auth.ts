// packages/api/src/auth.ts
import { api } from "./axios";

export interface LoginResponse {
  access_token: string;
  user: any;
}

export async function login(email: string, password: string): Promise<LoginResponse> {
  const res = await api.post("/auth/login", { email, password });
  return res.data as LoginResponse;
}

export async function registerUser(email: string, username: string, password: string) {
  const res = await api.post("/auth/signup", {
    email,
    username,
    password,
  });
  return res.data;
}


export async function refreshToken(): Promise<LoginResponse> {
  const res = await api.post("/auth/refresh");
  return res.data as LoginResponse;
}

export async function logout() {
  const res = await api.post("/auth/logout");
  return res.data;
}
