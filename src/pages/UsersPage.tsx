import { KeyRound, Link2, Save, UserPlus } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import DataCard from "../components/ui/DataCard";
import StatusBadge from "../components/ui/StatusBadge";
import { useAuth } from "../context/AuthContext";
import { getObras } from "../lib/firestore";
import { canManageUsers } from "../lib/roles";
import {
  assignWorksToUser,
  countAssignedWorks,
  createSystemUser,
  disableSystemUser,
  enableSystemUser,
  getSystemUsers,
  linkExistingFirebaseUser,
  sendUserPasswordReset,
  setSystemUserRole,
  updateSystemUser
} from "../lib/users";
import type { Obra, SystemUser, UserRole } from "../types";
import { formatDateTime } from "../utils/formatters";

const roles: UserRole[] = [
  "admin",
  "gerencia",
  "administracion",
  "supervisor",
  "fiscalizador",
  "encargado",
  "equipo_campo",
  "produccion",
  "instalador"
];

const emptyForm = {
  uid: "",
  nombre: "",
  email: "",
  password: "",
  role: "supervisor" as UserRole,
  phone: "",
  active: true,
  assignedWorkIds: [] as string[],
  assignedTeamIds: [] as string[],
  teamName: "",
  teamType: "equipo_campo" as SystemUser["teamType"],
  membersDescription: ""
};

export default function UsersPage() {
  const { profile } = useAuth();
  const [users, setUsers] = useState<SystemUser[]>([]);
  const [works, setWorks] = useState<Obra[]>([]);
  const [mode, setMode] = useState<"create" | "link">("create");
  const [form, setForm] = useState(emptyForm);
  const [selectedUser, setSelectedUser] = useState<SystemUser | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [loadedUsers, loadedWorks] = await Promise.all([getSystemUsers(), getObras()]);
      setUsers(loadedUsers);
      setWorks(loadedWorks);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "No se pudieron cargar los usuarios.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canManageUsers(profile)) {
      setError("No tenes permisos para administrar usuarios.");
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");
    try {
      if (selectedUser) {
        await updateSystemUser(selectedUser.uid, {
          nombre: form.nombre,
          role: form.role,
          phone: form.phone || undefined,
          active: form.active,
          assignedWorkIds: form.assignedWorkIds,
          assignedTeamIds: form.assignedTeamIds,
          teamName: form.role === "equipo_campo" ? form.teamName || form.nombre : undefined,
          teamType: form.role === "equipo_campo" ? form.teamType : undefined,
          membersDescription: form.role === "equipo_campo" ? form.membersDescription || undefined : undefined
        });
        await assignWorksToUser(selectedUser.uid, form.assignedWorkIds);
        await setSystemUserRole(selectedUser.uid, form.role);
        setMessage("Usuario actualizado.");
      } else if (mode === "link") {
        await linkExistingFirebaseUser({
          uid: form.uid,
          nombre: form.nombre,
          email: form.email,
          role: form.role,
          active: form.active,
          phone: form.phone || undefined,
          assignedWorkIds: form.assignedWorkIds,
          assignedTeamIds: form.assignedTeamIds,
          teamName: form.role === "equipo_campo" ? form.teamName || form.nombre : undefined,
          teamType: form.role === "equipo_campo" ? form.teamType : undefined,
          membersDescription: form.role === "equipo_campo" ? form.membersDescription || undefined : undefined,
          updatedAt: new Date().toISOString()
        });
        setMessage("Usuario existente vinculado.");
      } else {
        await createSystemUser({
          nombre: form.nombre,
          email: form.email,
          password: form.password,
          role: form.role,
          phone: form.phone || undefined,
          active: form.active,
          assignedWorkIds: form.assignedWorkIds,
          assignedTeamIds: form.assignedTeamIds,
          teamName: form.role === "equipo_campo" ? form.teamName || form.nombre : undefined,
          teamType: form.role === "equipo_campo" ? form.teamType : undefined,
          membersDescription: form.role === "equipo_campo" ? form.membersDescription || undefined : undefined
        });
        setMessage("Usuario creado. La contrasena temporal no fue guardada.");
      }
      setForm(emptyForm);
      setSelectedUser(null);
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "No se pudo guardar el usuario.");
    } finally {
      setSaving(false);
    }
  }

  function editUser(user: SystemUser) {
    setSelectedUser(user);
    setMode("create");
    setForm({
      uid: user.uid,
      nombre: user.nombre,
      email: user.email,
      password: "",
      role: user.role,
      phone: user.phone ?? "",
      active: user.active,
      assignedWorkIds: user.assignedWorkIds ?? [],
      assignedTeamIds: user.assignedTeamIds ?? [],
      teamName: user.teamName ?? "",
      teamType: user.teamType ?? "equipo_campo",
      membersDescription: user.membersDescription ?? ""
    });
  }

  async function toggleActive(user: SystemUser) {
    if (!window.confirm(`${user.active ? "Desactivar" : "Activar"} ${user.nombre}?`)) return;
    if (user.active) {
      await disableSystemUser(user.uid);
    } else {
      await enableSystemUser(user.uid);
    }
    await load();
  }

  async function resetPassword(user: SystemUser) {
    await sendUserPasswordReset(user.email);
    setMessage("Solicitud de recuperacion enviada si Firebase Functions esta disponible.");
  }

  if (loading) return <StateCard text="Cargando usuarios..." />;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-black uppercase text-next-blue">Administracion</p>
        <h1 className="mt-1 text-3xl font-black tracking-normal">USUARIOS</h1>
        <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-next-muted">
          Cuentas, roles y asignaciones. Las contrasenas se crean en Firebase Auth y nunca se guardan en Firestore.
        </p>
      </div>

      {message ? <Notice tone="success" text={message} /> : null}
      {error ? <Notice tone="error" text={error} /> : null}

      <section className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <DataCard title={selectedUser ? "Editar usuario" : mode === "link" ? "Vincular usuario existente" : "Nuevo usuario"}>
          <div className="mb-4 flex flex-wrap gap-2">
            <button className={`h-9 rounded-md px-3 text-xs font-black ${mode === "create" ? "bg-next-blue text-white" : "border border-next-blue text-next-blue"}`} type="button" onClick={() => { setMode("create"); setSelectedUser(null); setForm(emptyForm); }}>
              <UserPlus className="mr-1 inline h-4 w-4" /> Crear
            </button>
            <button className={`h-9 rounded-md px-3 text-xs font-black ${mode === "link" ? "bg-next-blue text-white" : "border border-next-blue text-next-blue"}`} type="button" onClick={() => { setMode("link"); setSelectedUser(null); setForm(emptyForm); }}>
              <Link2 className="mr-1 inline h-4 w-4" /> Vincular UID
            </button>
          </div>

          <form className="grid gap-3 sm:grid-cols-2" onSubmit={handleSubmit}>
            {(mode === "link" || selectedUser) ? (
              <input className="field sm:col-span-2" required={mode === "link"} placeholder="UID existente" value={form.uid} disabled={Boolean(selectedUser)} onChange={(event) => setForm({ ...form, uid: event.target.value })} />
            ) : null}
            <input className="field" required placeholder="Nombre completo" value={form.nombre} onChange={(event) => setForm({ ...form, nombre: event.target.value })} />
            <input className="field" required placeholder="Correo" type="email" value={form.email} disabled={Boolean(selectedUser)} onChange={(event) => setForm({ ...form, email: event.target.value })} />
            {!selectedUser && mode === "create" ? (
              <input className="field" required placeholder="Contrasena temporal" type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} />
            ) : null}
            <select className="field" value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value as UserRole })}>
              {roles.map((role) => <option key={role}>{role}</option>)}
            </select>
            <input className="field" placeholder="Telefono opcional" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
            {form.role === "equipo_campo" ? (
              <>
                <input className="field" placeholder="Nombre del equipo o cuadrilla" value={form.teamName} onChange={(event) => setForm({ ...form, teamName: event.target.value })} />
                <select className="field" value={form.teamType} onChange={(event) => setForm({ ...form, teamType: event.target.value as SystemUser["teamType"] })}>
                  <option value="equipo_campo">Equipo de campo</option>
                  <option value="cuadrilla">Cuadrilla</option>
                </select>
                <textarea className="field min-h-20 sm:col-span-2" placeholder="Descripcion de integrantes o uso compartido" value={form.membersDescription} onChange={(event) => setForm({ ...form, membersDescription: event.target.value })} />
              </>
            ) : null}
            <label className="flex h-11 items-center gap-2 rounded-md border border-slate-200 px-3 text-sm font-bold text-next-muted">
              <input checked={form.active} className="accent-next-blue" type="checkbox" onChange={(event) => setForm({ ...form, active: event.target.checked })} />
              Usuario activo
            </label>
            <label className="sm:col-span-2">
              <span className="text-xs font-black uppercase text-next-muted">Obras asignadas</span>
              <select
                className="field mt-1 min-h-32"
                multiple
                value={form.assignedWorkIds}
                onChange={(event) => setForm({
                  ...form,
                  assignedWorkIds: Array.from(event.target.selectedOptions).map((option) => option.value)
                })}
              >
                {works.map((work) => <option key={work.id} value={work.id}>{work.nombre}</option>)}
              </select>
            </label>
            <button className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-next-blue px-4 text-sm font-black text-white disabled:opacity-60 sm:col-span-2" type="submit" disabled={saving}>
              <Save className="h-4 w-4" />
              {saving ? "Guardando..." : "Guardar usuario"}
            </button>
          </form>
        </DataCard>

        <DataCard title="Usuarios del sistema">
          <div className="space-y-3">
            {users.length ? users.map((user) => (
              <article key={user.uid} className="rounded-lg border border-slate-100 p-3">
                <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-base font-black text-next-text">{user.nombre}</h2>
                      <StatusBadge label={user.active ? "Activo" : "Inactivo"} status={user.active ? "success" : "critical"} />
                      <StatusBadge label={user.role} status="info" />
                    </div>
                    <p className="mt-1 text-sm font-semibold text-next-muted">{user.email}</p>
                    <p className="mt-1 break-all text-xs font-semibold text-next-muted">UID: {user.uid}</p>
                    <p className="mt-1 text-xs font-semibold text-next-muted">
                      Obras asignadas: {countAssignedWorks(user, works)} · Ultimo acceso: {user.lastLoginAt ? formatDateTime(user.lastLoginAt) : "Sin dato"}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button className="h-9 rounded-md border border-next-blue px-3 text-xs font-black text-next-blue" type="button" onClick={() => editUser(user)}>Editar</button>
                    <button className="h-9 rounded-md border border-slate-200 px-3 text-xs font-black text-next-muted" type="button" onClick={() => toggleActive(user)}>{user.active ? "Desactivar" : "Activar"}</button>
                    <button className="inline-flex h-9 items-center gap-1 rounded-md border border-slate-200 px-3 text-xs font-black text-next-muted" type="button" onClick={() => resetPassword(user)}>
                      <KeyRound className="h-4 w-4" /> Reset
                    </button>
                  </div>
                </div>
              </article>
            )) : <EmptyState text="Todavia no hay usuarios." />}
          </div>
        </DataCard>
      </section>
    </div>
  );
}

function Notice({ tone, text }: { tone: "success" | "error"; text: string }) {
  const classes = tone === "success"
    ? "border-green-100 bg-green-50 text-next-green"
    : "border-red-100 bg-red-50 text-next-red";
  return <div className={`rounded-lg border px-4 py-3 text-sm font-semibold ${classes}`}>{text}</div>;
}

function StateCard({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-5 py-4 text-sm font-bold text-next-muted shadow-soft">
      {text}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-200 bg-next-bg px-4 py-8 text-center text-sm font-semibold text-next-muted">
      {text}
    </div>
  );
}
