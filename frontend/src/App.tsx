import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { getAccessToken } from "@/api/client";
import { AppShell } from "@/components/AppShell";
import { PageLoading } from "@/components/Spinner";
import { LoginPage } from "@/pages/Login";
import { DashboardPage } from "@/pages/app/Dashboard";
import { LeadsPage } from "@/pages/app/Leads";
import { FollowUpsPage } from "@/pages/app/FollowUps";
import { TeamPage } from "@/pages/app/Team";
import { AnalyticsPage } from "@/pages/app/Analytics";
import { SuperAdminShell } from "@/pages/super-admin/SuperAdminShell";
import { OrganizationsPage } from "@/pages/super-admin/Organizations";

function homeForRole(role?: string) {
  if (role === "super_admin") return "/super-admin";
  if (role === "telecaller") return "/leads";
  return "/dashboard";
}

function ProtectedRoute({ children, roles }: { children: JSX.Element; roles?: string[] }) {
  const { user, isLoading } = useAuth();
  const hasToken = !!getAccessToken();

  if (!hasToken) return <Navigate to="/login" replace />;
  if (isLoading) return <PageLoading />;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to={homeForRole(user.role)} replace />;
  return children;
}

function RootRedirect() {
  const { user } = useAuth();
  return <Navigate to={homeForRole(user?.role)} replace />;
}

function LoginRoute() {
  const { user, isLoading } = useAuth();
  const hasToken = !!getAccessToken();

  if (hasToken && isLoading) return <PageLoading />;
  if (hasToken && user) return <Navigate to={homeForRole(user.role)} replace />;
  return <LoginPage />;
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginRoute />} />

      <Route
        path="/super-admin"
        element={
          <ProtectedRoute roles={["super_admin"]}>
            <SuperAdminShell />
          </ProtectedRoute>
        }
      >
        <Route index element={<OrganizationsPage />} />
      </Route>

      <Route
        element={
          <ProtectedRoute roles={["admin", "manager", "telecaller"]}>
            <AppShell />
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/leads" element={<LeadsPage />} />
        <Route path="/follow-ups" element={<FollowUpsPage />} />
        <Route
          path="/team"
          element={
            <ProtectedRoute roles={["admin", "manager"]}>
              <TeamPage />
            </ProtectedRoute>
          }
        />
        <Route path="/analytics" element={<AnalyticsPage />} />
      </Route>

      <Route path="/" element={<RootRedirect />} />
      <Route path="*" element={<RootRedirect />} />
    </Routes>
  );
}
