import { KeyRound, LogIn } from "lucide-react";
import { FormEvent, useState } from "react";
import BrandLogo from "../components/brand/BrandLogo";
import { useAuth } from "../context/AuthContext";
import { isFirebaseConfigured } from "../lib/firebase";

export default function LoginPage() {
  const { demoLogin, login, resetPassword } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const firebaseReady = isFirebaseConfigured();
  const demoVisible = !import.meta.env.PROD || !firebaseReady;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");

    if (!firebaseReady) {
      setError("Firebase todavia no esta configurado. Usa el modo demo local en desarrollo.");
      return;
    }

    setLoading(true);
    try {
      await login(email, password);
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "No se pudo iniciar sesion.");
    } finally {
      setLoading(false);
    }
  }

  async function handleResetPassword() {
    setError("");
    setMessage("");
    if (!email) {
      setError("Escribi tu correo para enviar la recuperacion.");
      return;
    }

    try {
      await resetPassword(email);
      setMessage("Te enviamos un correo para restablecer la contrasena.");
    } catch (resetError) {
      setError(resetError instanceof Error ? resetError.message : "No se pudo enviar la recuperacion.");
    }
  }

  return (
    <main className="min-h-screen bg-next-navy px-4 py-8 text-next-text">
      <section className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-6xl items-center justify-center">
        <div className="grid w-full overflow-hidden rounded-lg bg-white shadow-2xl lg:grid-cols-[0.9fr_1.1fr]">
          <div className="bg-next-navy p-8 text-white sm:p-10">
            <BrandLogo variant="login" />
            <div className="mt-12 text-center lg:text-left">
              <h1 className="text-4xl font-black tracking-normal">NEXT CONTROL</h1>
              <p className="mt-4 max-w-md text-sm font-semibold leading-6 text-white/72">
                Plataforma de gestion y control integral para obras, finanzas, produccion e instalacion.
              </p>
            </div>
          </div>

          <form className="space-y-5 p-8 sm:p-10" onSubmit={handleSubmit}>
            <div>
              <p className="text-sm font-black uppercase text-next-blue">Acceso</p>
              <h2 className="mt-1 text-2xl font-black">Iniciar sesion</h2>
            </div>

            {!firebaseReady ? (
              <div className="rounded-lg border border-orange-100 bg-orange-50 px-4 py-3 text-sm font-semibold leading-6 text-next-orange">
                Firebase todavia no esta configurado. La app esta usando datos demo locales.
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

            <label className="block">
              <span className="text-sm font-bold text-next-muted">Correo</span>
              <input
                className="mt-2 h-12 w-full rounded-md border border-slate-200 bg-next-bg px-3 text-sm outline-none transition focus:border-next-blue focus:bg-white focus:ring-4 focus:ring-next-blue/10"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                type="email"
                autoComplete="email"
                placeholder="admin@nextglass.com"
              />
            </label>

            <label className="block">
              <span className="text-sm font-bold text-next-muted">Contrasena</span>
              <input
                className="mt-2 h-12 w-full rounded-md border border-slate-200 bg-next-bg px-3 text-sm outline-none transition focus:border-next-blue focus:bg-white focus:ring-4 focus:ring-next-blue/10"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                type="password"
                autoComplete="current-password"
                placeholder="********"
              />
            </label>

            <button
              className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-md bg-next-blue px-4 text-sm font-black text-white shadow-sm transition hover:bg-next-navy disabled:cursor-not-allowed disabled:opacity-60"
              type="submit"
              disabled={loading}
            >
              <LogIn className="h-5 w-5" aria-hidden="true" />
              {loading ? "Ingresando..." : "Iniciar sesion"}
            </button>

            <button
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-4 text-sm font-black text-next-blue transition hover:bg-next-light"
              type="button"
              onClick={handleResetPassword}
            >
              <KeyRound className="h-4 w-4" aria-hidden="true" />
              Recuperar contrasena
            </button>

            {demoVisible ? (
              <button
                className="h-12 w-full rounded-md border border-next-blue bg-white px-4 text-sm font-black text-next-blue transition hover:bg-next-light"
                type="button"
                onClick={demoLogin}
              >
                Entrar en modo demo
              </button>
            ) : null}
          </form>
        </div>
      </section>
    </main>
  );
}
