import * as SecureStore from "expo-secure-store";

// Local dev points at `npm run dev` via EXPO_PUBLIC_API_URL in .env.local.
export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "https://ledgr-alphav2.vercel.app";

const TOKEN_KEY = "ledgr.token";
let token: string | null = null;
let onExpired = () => {};

export const loadToken = async () => (token = await SecureStore.getItemAsync(TOKEN_KEY));

export const saveToken = async (value: string | null) => {
  token = value;
  if (value) await SecureStore.setItemAsync(TOKEN_KEY, value);
  else await SecureStore.deleteItemAsync(TOKEN_KEY);
};

/** Called when the server rejects a stored token (expired, or the account is gone). */
export const onTokenExpired = (fn: () => void) => {
  onExpired = fn;
};

export async function api<T = void>(
  path: string,
  init: { method?: "GET" | "POST" | "PUT" | "DELETE"; body?: unknown } = {}
): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: init.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  if (res.status === 401 && token) onExpired();
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new Error(data?.error ?? `Something went wrong (${res.status}). Try again.`);
  }
  return (res.status === 204 ? undefined : await res.json()) as T;
}
