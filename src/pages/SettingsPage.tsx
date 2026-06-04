import { Cloud, Database, RefreshCcw, RotateCcw } from "lucide-react";
import { useState } from "react";
import DataCard from "../components/ui/DataCard";
import StatusBadge from "../components/ui/StatusBadge";
import { useAuth } from "../context/AuthContext";
import { loadSeedDataToFirebase } from "../lib/firestore";
import {
  firebaseAuth,
  firebaseFunctions,
  firebaseProjectId,
  firebaseStorage,
  firestoreDb,
  getMissingFirebaseEnvVars,
  isFirebaseConfigured
} from "../lib/firebase";
import { canManageUsers } from "../lib/roles";
import { getDataSourceLabel, resetDemoData } from "../lib/storage";

export default function SettingsPage() {
  const { authUser, isDemo, profile, role } = useAuth();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const firebaseReady = isFirebaseConfigured();
  const missingFirebaseVars = getMissingFirebaseEnvVars();
  const sourceLabel = getDataSourceLabel();
  const usingFirebase = sourceLabel === "Usando Firebase";

  async function handleLoadFirebaseSeed() {
    setMessage("");
    setError("");

    if (!firebaseReady) {
      setError("Firebase todavia no esta configurado. Carga tus variables en .env.local.");
      return;
    }

    const replace = window.confirm(
      "Quieres reemplazar datos existentes si ya hay obras en Firebase?"
    );

    setLoading(true);
    try {
      const result = await loadSeedDataToFirebase(replace);
      setMessage(result);
    } catch (seedError) {
      setError(seedError instanceof Error ? seedError.message : "No se pudo cargar el seed.");
    } finally {
      setLoading(false);
    }
  }

  function handleResetLocalDemo() {
    if (!window.confirm("Restablecer datos demo locales?")) {
      return;
    }

    resetDemoData();
    setError("");
    setMessage("Datos demo locales restablecidos.");
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-black uppercase text-next-blue">Administracion</p>
        <h1 className="mt-1 text-3xl font-black tracking-normal">CONFIGURACION</h1>
      </div>

      {!firebaseReady ? (
        <div className="rounded-lg border border-orange-100 bg-orange-50 px-4 py-3 text-sm font-semibold leading-6 text-next-orange">
          Firebase todavia no esta configurado. La app esta usando datos demo locales.
          {missingFirebaseVars.length > 0 ? (
            <span className="mt-1 block text-xs">
              Faltan: {missingFirebaseVars.join(", ")}.
            </span>
          ) : null}
        </div>
      ) : null}

      {message ? (
        <div className="rounded-lg border border-green-100 bg-green-50 px-4 py-3 text-sm font-semibold leading-6 text-next-green">
          {message}
        </div>
      ) : null}

      {error ? (
        <div className="rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold leading-6 text-next-red">
          {error}
        </div>
      ) : null}

      <section className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <DataCard
          title="Estado de conexion"
          subtitle="La app usa Firestore si las variables de Firebase estan completas."
        >
          <div className="flex items-center justify-between gap-4 rounded-lg bg-next-bg p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-md bg-next-light text-next-blue">
                <Cloud className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <p className="text-sm font-black text-next-text">{sourceLabel}</p>
                <p className="text-xs font-semibold text-next-muted">
                  Proyecto Firebase: {firebaseProjectId || "Sin configurar"}
                </p>
              </div>
            </div>
            <StatusBadge
              label={usingFirebase ? "Firebase activo" : "Demo local"}
              status={usingFirebase ? "success" : "warning"}
            />
          </div>
        </DataCard>

        <DataCard title="Datos demo" subtitle="Carga o reinicia datos para presentaciones.">
          <div className="grid gap-3 sm:grid-cols-2">
            <button
              className="inline-flex h-12 items-center justify-center gap-2 rounded-md bg-next-blue px-4 text-sm font-black text-white transition hover:bg-next-navy disabled:opacity-60"
              type="button"
              onClick={handleLoadFirebaseSeed}
              disabled={loading}
            >
              <Database className="h-5 w-5" aria-hidden="true" />
              {loading ? "Cargando..." : "Cargar datos demo en Firebase"}
            </button>
            <button
              className="inline-flex h-12 items-center justify-center gap-2 rounded-md border border-next-blue bg-white px-4 text-sm font-black text-next-blue transition hover:bg-next-light"
              type="button"
              onClick={handleResetLocalDemo}
            >
              <RotateCcw className="h-5 w-5" aria-hidden="true" />
              Restablecer datos demo local
            </button>
          </div>
        </DataCard>
      </section>

      <DataCard title="Informacion">
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            ["Proyecto", "NEXT CONTROL"],
            ["Empresa", "Next Glass | Vidrios y Aluminios"],
            ["Version", "Demo funcional"]
          ].map(([label, value]) => (
            <div key={label} className="rounded-lg border border-slate-100 bg-next-bg px-4 py-3">
              <p className="text-xs font-bold uppercase text-next-muted">{label}</p>
              <p className="mt-1 text-sm font-black text-next-text">{value}</p>
            </div>
          ))}
        </div>
      </DataCard>

      <DataCard title="Diagnostico Firebase">
        <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <p className="text-sm font-semibold leading-6 text-next-muted">
            Estado tecnico visible sin exponer secretos.
          </p>
          {canManageUsers(profile) ? (
            <button
              className="h-10 rounded-md border border-next-blue px-3 text-xs font-black text-next-blue"
              type="button"
              onClick={() => setShowDiagnostics((current) => !current)}
            >
              Ver diagnostico Firebase
            </button>
          ) : null}
        </div>
        {showDiagnostics || isDemo ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Diagnostic label="Firebase" value={firebaseReady ? "Configurado" : "Sin variables"} ok={firebaseReady} />
            <Diagnostic label="Authentication" value={firebaseAuth ? "Disponible" : "No disponible"} ok={Boolean(firebaseAuth)} />
            <Diagnostic label="Firestore" value={firestoreDb ? "Disponible" : "No disponible"} ok={Boolean(firestoreDb)} />
            <Diagnostic label="Storage" value={firebaseStorage ? "Disponible" : "No disponible"} ok={Boolean(firebaseStorage)} />
            <Diagnostic label="Functions" value={firebaseFunctions ? "Disponible" : "No disponible"} ok={Boolean(firebaseFunctions)} />
            <Diagnostic
              label="Variables faltantes"
              value={missingFirebaseVars.length > 0 ? missingFirebaseVars.join(", ") : "Ninguna"}
              ok={missingFirebaseVars.length === 0}
            />
            <Diagnostic label="Modo" value={isDemo ? "Demo local" : "Firebase"} ok={!isDemo} />
            <Diagnostic label="Usuario" value={profile?.nombre ?? authUser?.email ?? "Sin perfil"} ok={Boolean(profile)} />
            <Diagnostic label="UID" value={profile?.uid ?? authUser?.uid ?? "Sin UID"} ok={Boolean(authUser || profile)} />
            <Diagnostic label="Rol" value={role ?? "Sin rol"} ok={Boolean(role)} />
          </div>
        ) : null}
      </DataCard>

      <DataCard title="Storage preparado">
        <div className="flex items-start gap-3 rounded-lg bg-next-bg p-4">
          <RefreshCcw className="mt-0.5 h-5 w-5 shrink-0 text-next-blue" aria-hidden="true" />
          <p className="text-sm font-semibold leading-6 text-next-muted">
            La estructura de Firebase Storage queda preparada para fotos de avance,
            comprobantes de cobro y documentos de obra mediante src/lib/storageUpload.ts.
          </p>
        </div>
      </DataCard>
    </div>
  );
}

function Diagnostic({ label, ok, value }: { label: string; ok: boolean; value: string }) {
  return (
    <div className="min-w-0 rounded-lg border border-slate-100 bg-next-bg px-4 py-3">
      <p className="text-xs font-bold uppercase text-next-muted">{label}</p>
      <p className={`mt-1 truncate text-sm font-black ${ok ? "text-next-green" : "text-next-orange"}`} title={value}>
        {value}
      </p>
    </div>
  );
}
