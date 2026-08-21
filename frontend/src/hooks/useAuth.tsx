import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { authApi } from "@/api/endpoints";
import { getAccessToken, getRefreshToken, setTokens } from "@/api/client";
import type { UserOut } from "@/api/types";

interface AuthContextValue {
  user: UserOut | null;
  organizationName: string | null;
  isLoading: boolean;
  isImpersonating: boolean;
  impersonatedByName: string | null;
  login: (phone: string, password: string, countryCode?: string) => Promise<UserOut>;
  logout: () => void;
  startImpersonation: (access: string, orgName: string) => void;
  exitImpersonation: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [organizationName, setOrganizationName] = useState<string | null>(
    localStorage.getItem("districall_org_name")
  );
  const hasToken = !!getAccessToken();

  const { data: user, isLoading } = useQuery({
    queryKey: ["me"],
    queryFn: authApi.me,
    enabled: hasToken,
    retry: false,
  });

  const { data: impersonationStatus } = useQuery({
    queryKey: ["impersonation-status"],
    queryFn: authApi.impersonationStatus,
    enabled: hasToken,
    retry: false,
  });

  async function login(phone: string, password: string, countryCode?: string) {
    const result = await authApi.login(phone, password, countryCode);
    setTokens(result.tokens.access_token, result.tokens.refresh_token);
    setOrganizationName(result.organization_name);
    if (result.organization_name) localStorage.setItem("districall_org_name", result.organization_name);
    // Seed the cache synchronously with data we already have, rather than
    // relying on invalidateQueries + a background refetch: enabling the "me"
    // query only takes effect on the next render, so a redirect that happens
    // immediately after login() resolves could read a still-empty cache and
    // bounce back to /login before the refetch has even started.
    queryClient.setQueryData(["me"], result.user);
    queryClient.setQueryData(["impersonation-status"], { is_impersonating: false, impersonated_by_name: null });
    return result.user;
  }

  function logout() {
    setTokens(null, null);
    localStorage.removeItem("districall_org_name");
    queryClient.clear();
    window.location.href = "/login";
  }

  function startImpersonation(access: string, orgName: string) {
    const ownAccess = getAccessToken();
    const ownRefresh = getRefreshToken();
    if (ownAccess) {
      sessionStorage.setItem("districall_super_admin_access", ownAccess);
      if (ownRefresh) sessionStorage.setItem("districall_super_admin_refresh", ownRefresh);
    }
    setTokens(access, null);
    localStorage.setItem("districall_org_name", orgName);
    queryClient.clear();
    window.location.href = "/dashboard";
  }

  function exitImpersonation() {
    const ownAccess = sessionStorage.getItem("districall_super_admin_access");
    const ownRefresh = sessionStorage.getItem("districall_super_admin_refresh");
    sessionStorage.removeItem("districall_super_admin_access");
    sessionStorage.removeItem("districall_super_admin_refresh");
    localStorage.removeItem("districall_org_name");
    setTokens(ownAccess, ownRefresh);
    queryClient.clear();
    window.location.href = ownAccess ? "/super-admin" : "/login";
  }

  return (
    <AuthContext.Provider
      value={{
        user: user ?? null,
        organizationName,
        isLoading: hasToken && isLoading,
        isImpersonating: impersonationStatus?.is_impersonating ?? false,
        impersonatedByName: impersonationStatus?.impersonated_by_name ?? null,
        login,
        logout,
        startImpersonation,
        exitImpersonation,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
