import { ChevronDown, Cloud, Copy, ExternalLink, History, LockKeyhole, Palette, ShieldCheck, UsersRound } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import StatusBadge from "../components/ui/StatusBadge";
import { useAuth } from "../context/AuthContext";
import {
  firebaseAuth,
  firebaseFunctions,
  firebaseProjectId,
  firebaseStorage,
  firestoreDb,
  getMissingFirebaseEnvVars,
  isFirebaseConfigured
} from "../lib/firebase";
import { canManageUsers, getOperationalPathByRole, getOperationalUrlForUser } from "../lib/roles";
import { getDataSourceLabel } from "../lib/storage";
import { getSystemUsers } from "../lib/users";
import type { SystemUser } from "../types";

type CardId = "usuarios" | "roles" | "modulos" | "historial" | "marca" | "firebase";

export default function SettingsPage() {
  const { authUser, isDemo, profile, role } = useAuth();
  const [openCard, setOpenCard] = useState<CardId | null>(null);
  const [users, setUsers] = useState<SystemUser[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loadingUsers, setLoadingUsers] = useState(false);

  const firebaseReady = isFirebaseConfigured();
  const missingFirebaseVars = getMissingFirebaseEnvVars();
  const sourceLabel = getDataSourceLabel();
  const usingFirebase = sourceLabel === "Usando Firebase";
  const activeUsers = users.filter((user) => user.active).length;

  useEffect(() => {
    if (canManageUsers(profile)) {
      void loadUsers();
    }
  }, [profile?.uid]);

  async function loadUsers() {
    setLoadingUsers(true);
    setError("");
    try {
      setUsers(await getSystemUsers());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "No se pudieron cargar usuarios.");
    } finally {
      setLoadingUsers(false);
    }
  }

  async function copyOperationalLink(user: SystemUser) {
    const url = getOperationalUrlForUser(user);
    if (!url) {
      setError("Asignale un rol al usuario para generar el link operativo.");
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setMessage(`Link operativo copiado para ${user.nombre}.`);
    } catch (copyError) {
      console.error("No se pudo copiar link operativo.", copyError);
      setError("No se pudo copiar el link operativo.");
    }
  }

  const cards = [
    {
      id: "usuarios" as const,
      icon: UsersRound,
      title: "Usuarios y permisos",
      description: "Administra quien puede acceder al sistema y que puede realizar.",
      badge: `${activeUsers} activos`,
      content: (
        <UsersAndPermissions
          loading={loadingUsers}
          onCopy={copyOperationalLink}
          users={users}
        />
      )
    },
    {
      id: "roles" as const,
      icon: ShieldCheck,
      title: "Roles del sistema",
      description: "Define los permisos base de cada tipo de usuario.",
      badge: "Admin, Fiscalizador, Campo, Taller",
      content: <RoleSummary />
    },
    {
      id: "modulos" as const,
      icon: LockKeyhole,
      title: "Permisos por modulo",
      description: "Configura que secciones puede ver y usar cada rol.",
      badge: "Modulos",
      content: <ModuleSummary />
    },
    {
      id: "historial" as const,
      icon: History,
      title: "Historial de actividad",
      description: "Registro de cambios importantes realizados por usuarios.",
      badge: "Recientes",
      content: <EmptyText text="La actividad critica se registra en actividades de avance, tareas, jornadas, cheques y produccion." />
    },
    {
      id: "marca" as const,
      icon: Palette,
      title: "Empresa y marca",
      description: "Logo, nombre comercial y datos visibles del sistema.",
      badge: "Next Glass",
      content: (
        <div className="grid gap-3 sm:grid-cols-3">
          <Diagnostic label="Proyecto" value="NEXT CONTROL" ok />
          <Diagnostic label="Empresa" value="Next Glass" ok />
          <Diagnostic label="Estado" value="Produccion operativa" ok />
        </div>
      )
    },
    {
      id: "firebase" as const,
      icon: Cloud,
      title: "Firebase / Sistema",
      description: "Estado de conexion, Storage y diagnostico tecnico.",
      badge: firebaseReady ? "Conectado" : "Revisar",
      content: (
        <FirebaseDiagnostics
          authEmail={authUser?.email}
          firebaseReady={firebaseReady}
          isDemo={isDemo}
          missingFirebaseVars={missingFirebaseVars}
          profile={profile}
          role={role}
          sourceLabel={sourceLabel}
          usingFirebase={usingFirebase}
        />
      )
    }
  ];

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-black uppercase text-next-blue">Administracion</p>
        <h1 className="mt-1 text-3xl font-black tracking-normal">CONFIGURACION</h1>
        <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-next-muted">
          Centro de usuarios, permisos, links operativos y diagnostico del sistema.
        </p>
      </div>

      {!firebaseReady ? (
        <Notice tone="warning" text={`Firebase no esta completo. Faltan: ${missingFirebaseVars.join(", ") || "variables por verificar"}.`} />
      ) : null}
      {message ? <Notice tone="success" text={message} /> : null}
      {error ? <Notice tone="error" text={error} /> : null}

      <section className="grid gap-4">
        {cards.map((card) => {
          const Icon = card.icon;
          const isOpen = openCard === card.id;
          return (
            <article key={card.id} className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-soft">
              <button
                className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
                type="button"
                onClick={() => setOpenCard(isOpen ? null : card.id)}
              >
                <div className="flex min-w-0 items-start gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-next-light text-next-blue">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-base font-black text-next-text">{card.title}</span>
                    <span className="mt-1 block text-sm font-semibold leading-5 text-next-muted">{card.description}</span>
                  </span>
                </div>
                <span className="flex shrink-0 items-center gap-3">
                  <StatusBadge label={card.badge} status={card.id === "firebase" && !firebaseReady ? "warning" : "info"} />
                  <ChevronDown className={`h-5 w-5 text-next-muted transition ${isOpen ? "rotate-180" : ""}`} aria-hidden="true" />
                </span>
              </button>
              {isOpen ? <div className="border-t border-slate-100 px-5 py-4">{card.content}</div> : null}
            </article>
          );
        })}
      </section>
    </div>
  );
}

function UsersAndPermissions({
  loading,
  onCopy,
  users
}: {
  loading: boolean;
  onCopy: (user: SystemUser) => void;
  users: SystemUser[];
}) {
  if (loading) return <EmptyText text="Cargando usuarios..." />;
  if (!users.length) {
    return (
      <div className="space-y-3">
        <EmptyText text="Todavia no hay usuarios cargados." />
        <Link className="inline-flex h-10 items-center rounded-md bg-next-blue px-4 text-xs font-black text-white" to="/usuarios">Ir a Usuarios</Link>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Link className="inline-flex h-10 items-center rounded-md bg-next-blue px-4 text-xs font-black text-white" to="/usuarios">Crear o editar usuarios</Link>
      </div>
      <div className="grid gap-3 xl:grid-cols-2">
        {users.map((user) => {
          const path = user.operationalPath || getOperationalPathByRole(user.role);
          const url = getOperationalUrlForUser(user);
          return (
            <article key={user.uid} className="rounded-lg border border-slate-100 bg-next-bg p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-black text-next-text">{user.nombre}</p>
                  <p className="mt-1 truncate text-xs font-semibold text-next-muted">{user.email}</p>
                </div>
                <StatusBadge label={user.active ? "Activo" : "Inactivo"} status={user.active ? "success" : "neutral"} />
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <Diagnostic label="Rol" value={formatRole(user.role)} ok={Boolean(user.role)} />
                <Diagnostic label="Link operativo" value={path ?? "Perfil pendiente"} ok={Boolean(path)} />
              </div>
              <p className="mt-3 rounded-md bg-white px-3 py-2 text-xs font-semibold text-next-muted">
                Pasale este link al usuario. Al ingresar, debera iniciar sesion con el correo y contrasena creados.
              </p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <button className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-next-blue px-3 text-xs font-black text-next-blue" type="button" onClick={() => onCopy(user)}>
                  <Copy className="h-4 w-4" aria-hidden="true" />
                  Copiar link
                </button>
                <a className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-next-blue px-3 text-xs font-black text-white" href={url ?? "#"} target="_blank" rel="noreferrer">
                  <ExternalLink className="h-4 w-4" aria-hidden="true" />
                  Abrir vista
                </a>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

function RoleSummary() {
  const rows = [
    ["Admin", "Acceso completo"],
    ["Fiscalizador", "Avance, tareas, asignaciones y validacion"],
    ["Campo", "Jornadas, tareas, fotos e instalacion"],
    ["Taller", "Produccion de taller"],
    ["Solo lectura", "Consulta limitada"]
  ];
  return <SimpleRows rows={rows} />;
}

function ModuleSummary() {
  const rows = [
    ["Finanzas y Cheques", "Solo admin, gerencia y administracion"],
    ["Tareas e Instalaciones", "Admin, gerencia, fiscalizador y campo segun rol"],
    ["Produccion / Taller", "Admin, gerencia, produccion y taller"],
    ["Configuracion / Usuarios", "Admin y gerencia"]
  ];
  return <SimpleRows rows={rows} />;
}

function FirebaseDiagnostics({
  authEmail,
  firebaseReady,
  isDemo,
  missingFirebaseVars,
  profile,
  role,
  sourceLabel,
  usingFirebase
}: {
  authEmail?: string | null;
  firebaseReady: boolean;
  isDemo: boolean;
  missingFirebaseVars: string[];
  profile: SystemUser | null;
  role: string | null;
  sourceLabel: string;
  usingFirebase: boolean;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 rounded-lg bg-next-bg p-4">
        <div>
          <p className="text-sm font-black text-next-text">{sourceLabel}</p>
          <p className="text-xs font-semibold text-next-muted">Proyecto Firebase: {firebaseProjectId || "Sin configurar"}</p>
        </div>
        <StatusBadge label={usingFirebase ? "Firebase activo" : "Modo local"} status={usingFirebase ? "success" : "warning"} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Diagnostic label="Firebase" value={firebaseReady ? "Configurado" : "Sin variables"} ok={firebaseReady} />
        <Diagnostic label="Authentication" value={firebaseAuth ? "Disponible" : "No disponible"} ok={Boolean(firebaseAuth)} />
        <Diagnostic label="Firestore" value={firestoreDb ? "Disponible" : "No disponible"} ok={Boolean(firestoreDb)} />
        <Diagnostic label="Storage" value={firebaseStorage ? "Disponible" : "No disponible"} ok={Boolean(firebaseStorage)} />
        <Diagnostic label="Functions" value={firebaseFunctions ? "Disponible" : "No disponible"} ok={Boolean(firebaseFunctions)} />
        <Diagnostic label="Variables faltantes" value={missingFirebaseVars.length ? missingFirebaseVars.join(", ") : "Ninguna"} ok={!missingFirebaseVars.length} />
        <Diagnostic label="Modo" value={isDemo ? "Local" : "Firebase"} ok={!isDemo} />
        <Diagnostic label="Usuario" value={profile?.nombre ?? authEmail ?? "Sin perfil"} ok={Boolean(profile)} />
        <Diagnostic label="UID" value={profile?.uid ?? "Sin UID"} ok={Boolean(profile?.uid)} />
        <Diagnostic label="Rol" value={role ?? "Sin rol"} ok={Boolean(role)} />
      </div>
    </div>
  );
}

function SimpleRows({ rows }: { rows: string[][] }) {
  return (
    <div className="grid gap-2">
      {rows.map(([label, value]) => (
        <div key={label} className="rounded-lg bg-next-bg px-4 py-3">
          <p className="text-xs font-black uppercase text-next-muted">{label}</p>
          <p className="mt-1 text-sm font-semibold text-next-text">{value}</p>
        </div>
      ))}
    </div>
  );
}

function Diagnostic({ label, ok, value }: { label: string; ok: boolean; value: string }) {
  return (
    <div className="min-w-0 rounded-lg border border-slate-100 bg-white px-4 py-3">
      <p className="text-xs font-bold uppercase text-next-muted">{label}</p>
      <p className={`mt-1 truncate text-sm font-black ${ok ? "text-next-green" : "text-next-orange"}`} title={value}>{value}</p>
    </div>
  );
}

function EmptyText({ text }: { text: string }) {
  return <div className="rounded-lg border border-dashed border-slate-200 bg-next-bg px-4 py-8 text-center text-sm font-semibold text-next-muted">{text}</div>;
}

function Notice({ tone, text }: { tone: "success" | "warning" | "error"; text: string }) {
  const classes = tone === "success"
    ? "border-green-100 bg-green-50 text-next-green"
    : tone === "warning"
      ? "border-orange-100 bg-orange-50 text-next-orange"
      : "border-red-100 bg-red-50 text-next-red";
  return <div className={`rounded-lg border px-4 py-3 text-sm font-semibold ${classes}`}>{text}</div>;
}

function formatRole(value: string) {
  return value.replace("_", " ");
}
