import { Navigate, Route, Routes } from "react-router-dom";
import AppLayout from "./components/layout/AppLayout";
import MobileInstallationsView from "./components/mobile/MobileInstallationsView";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { canManageUsers } from "./lib/roles";
import CrmPage from "./pages/CrmPage";
import DashboardPage from "./pages/DashboardPage";
import FinancesPage from "./pages/FinancesPage";
import LoginPage from "./pages/LoginPage";
import PlaceholderPage from "./pages/PlaceholderPage";
import ProjectControlPage from "./pages/ProjectControlPage";
import SettingsPage from "./pages/SettingsPage";
import SupervisorPage from "./pages/SupervisorPage";
import SuppliersPage from "./pages/SuppliersPage";
import UsersPage from "./pages/UsersPage";

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}

function AppRoutes() {
  const { authUser, isAuthenticated, loading, logout, profile } = useAuth();

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-next-bg px-4">
        <div className="rounded-lg border border-slate-200 bg-white px-5 py-4 text-sm font-bold text-next-muted shadow-soft">
          Cargando NEXT CONTROL...
        </div>
      </main>
    );
  }

  const authenticatedWithoutProfile = Boolean(authUser && !profile);

  return (
    <Routes>
      <Route path="/login" element={isAuthenticated ? <Navigate to="/control" replace /> : <LoginPage />} />

      {!isAuthenticated ? (
        <Route path="*" element={<Navigate to="/login" replace />} />
      ) : authenticatedWithoutProfile ? (
        <Route path="*" element={<MissingProfilePage onLogout={logout} />} />
      ) : (
        <>
          <Route path="/instalaciones/mobile" element={<MobileInstallationsView />} />
          <Route element={<AppLayout />}>
            <Route index element={<Navigate to="/control" replace />} />
            <Route path="/control" element={<DashboardPage />} />
            <Route path="/dashboard" element={<Navigate to="/control" replace />} />
            <Route path="/clientes" element={<CrmPage />} />
            <Route path="/crm" element={<Navigate to="/clientes" replace />} />
            <Route path="/crm-obras" element={<Navigate to="/clientes" replace />} />
            <Route path="/avance-obras" element={<ProjectControlPage />} />
            <Route path="/avance-obras/:obraId" element={<ProjectControlPage />} />
            <Route path="/obras" element={<Navigate to="/avance-obras" replace />} />
            <Route path="/supervisor" element={<SupervisorPage />} />
            <Route path="/campo" element={<SupervisorPage />} />
            <Route path="/finanzas-obras" element={<FinancesPage />} />
            <Route path="/finanzas-obras/:obraId" element={<FinancesPage />} />
            <Route path="/presupuestos" element={<PlaceholderPage title="Presupuestos" />} />
            <Route path="/produccion" element={<ProjectControlPage />} />
            <Route path="/cobros" element={<FinancesPage />} />
            <Route path="/proveedores" element={<SuppliersPage />} />
            <Route path="/inventario" element={<PlaceholderPage title="Inventario" />} />
            <Route path="/reportes" element={<PlaceholderPage title="Reportes" />} />
            <Route path="/configuracion" element={<SettingsPage />} />
            <Route
              path="/usuarios"
              element={canManageUsers(profile) ? <UsersPage /> : <Navigate to="/control" replace />}
            />
          </Route>
          <Route path="*" element={<Navigate to="/control" replace />} />
        </>
      )}
    </Routes>
  );
}

function MissingProfilePage({ onLogout }: { onLogout: () => Promise<void> }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-next-bg px-4">
      <section className="w-full max-w-lg rounded-lg border border-orange-100 bg-white p-6 text-center shadow-soft">
        <p className="text-sm font-black uppercase text-next-orange">Perfil pendiente</p>
        <h1 className="mt-2 text-2xl font-black text-next-text">Cuenta sin rol asignado</h1>
        <p className="mt-3 text-sm font-semibold leading-6 text-next-muted">
          Tu cuenta existe, pero todavia no tiene un perfil y rol asignados. Contacta al administrador.
        </p>
        <button
          className="mt-5 h-11 rounded-md bg-next-blue px-5 text-sm font-black text-white transition hover:bg-next-navy"
          type="button"
          onClick={() => void onLogout()}
        >
          Cerrar sesion
        </button>
      </section>
    </main>
  );
}
