import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { getAccessToken } from "@/api/client";
import { AppShell } from "@/components/AppShell";
import { PageLoading } from "@/components/Spinner";
import { LoginPage } from "@/pages/Login";
import { LandingPageV2 } from "@/pages/LandingV2";
import { DashboardPageV2 } from "@/pages/app/DashboardV2";
import { LeadsPage } from "@/pages/app/Leads";
import { FollowUpsPage } from "@/pages/app/FollowUps";
import { TasksPage } from "@/pages/app/Tasks";
import { WorkspaceSettingsPage } from "@/pages/app/WorkspaceSettings";
import { LostDealsPage } from "@/pages/app/LostDeals";
import { IntegrationsPage } from "@/pages/app/Integrations";
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

function RootRoute() {
  const { user, isLoading } = useAuth();
  const hasToken = !!getAccessToken();

  if (hasToken && isLoading) return <PageLoading />;
  if (hasToken && user) return <Navigate to={homeForRole(user.role)} replace />;
  return <LandingPageV2 />;
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
        <Route path="/dashboard" element={<DashboardPageV2 />} />
        <Route path="/leads" element={<LeadsPage />} />
        <Route path="/follow-ups" element={<FollowUpsPage />} />
      <Route path="/tasks" element={<TasksPage />} />
      <Route path="/workspace-settings" element={<WorkspaceSettingsPage />} />
        <Route
          path="/lost-deals"
          element={
            <ProtectedRoute roles={["admin", "manager"]}>
              <LostDealsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/team"
          element={
            <ProtectedRoute roles={["admin", "manager"]}>
              <TeamPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/integrations"
          element={
            <ProtectedRoute roles={["admin", "manager"]}>
              <IntegrationsPage />
            </ProtectedRoute>
          }
        />
        <Route path="/analytics" element={<AnalyticsPage />} />
      </Route>

      <Route path="/" element={<RootRoute />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
