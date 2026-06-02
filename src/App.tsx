import { Navigate, Route, Routes } from "react-router-dom";
import AppLayout from "./components/layout/AppLayout";
import MobileInstallationsView from "./components/mobile/MobileInstallationsView";
import CrmPage from "./pages/CrmPage";
import DashboardPage from "./pages/DashboardPage";
import PlaceholderPage from "./pages/PlaceholderPage";
import ProjectControlPage from "./pages/ProjectControlPage";

export default function App() {
  return (
    <Routes>
      <Route path="/instalaciones/mobile" element={<MobileInstallationsView />} />
      <Route element={<AppLayout />}>
        <Route index element={<DashboardPage />} />
        <Route path="/crm" element={<CrmPage />} />
        <Route path="/obras" element={<ProjectControlPage />} />
        <Route path="/presupuestos" element={<PlaceholderPage title="Presupuestos" />} />
        <Route path="/produccion" element={<PlaceholderPage title="Producción" />} />
        <Route path="/cobros" element={<PlaceholderPage title="Cobros" />} />
        <Route path="/proveedores" element={<PlaceholderPage title="Proveedores" />} />
        <Route path="/inventario" element={<PlaceholderPage title="Inventario" />} />
        <Route path="/reportes" element={<PlaceholderPage title="Reportes" />} />
        <Route path="/configuracion" element={<PlaceholderPage title="Configuración" />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
