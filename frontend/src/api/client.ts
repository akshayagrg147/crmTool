import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api";

export const apiClient = axios.create({ baseURL: API_BASE_URL });

let accessToken: string | null = localStorage.getItem("districall_access_token");
let refreshToken: string | null = localStorage.getItem("districall_refresh_token");

export function setTokens(access: string | null, refresh: string | null) {
  accessToken = access;
  refreshToken = refresh;
  if (access) localStorage.setItem("districall_access_token", access);
  else localStorage.removeItem("districall_access_token");
  if (refresh) localStorage.setItem("districall_refresh_token", refresh);
  else localStorage.removeItem("districall_refresh_token");
}

export function getAccessToken() {
  return accessToken;
}

export function getRefreshToken() {
  return refreshToken;
}

apiClient.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

let refreshPromise: Promise<string | null> | null = null;

async function tryRefresh(): Promise<string | null> {
  if (!refreshToken) return null;
  if (!refreshPromise) {
    refreshPromise = axios
      .post(`${API_BASE_URL}/auth/refresh`, { refresh_token: refreshToken })
      .then((res) => {
        setTokens(res.data.access_token, res.data.refresh_token);
        return res.data.access_token as string;
      })
      .catch(() => {
        setTokens(null, null);
        return null;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

apiClient.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    const isAuthRequest = typeof original?.url === "string" && (original.url.includes("/auth/login") || original.url.includes("/auth/refresh"));
    if (error.response?.status === 401 && !isAuthRequest && !original._retry && refreshToken) {
      original._retry = true;
      const newAccess = await tryRefresh();
      if (newAccess) {
        original.headers.Authorization = `Bearer ${newAccess}`;
        return apiClient(original);
      }
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);
