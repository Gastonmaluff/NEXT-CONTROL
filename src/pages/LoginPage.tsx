import { KeyRound, LogIn } from "lucide-react";
import { FormEvent, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { isFirebaseConfigured } from "../lib/firebase";

const logoPath = `${import.meta.env.BASE_URL}logo-next-glass.png`;
const markPath = `${import.meta.env.BASE_URL}logo-next-glass-mark.png`;
const firebaseLogoPath = `${import.meta.env.BASE_URL}firebase-authentication-official.png`;
const googleCloudLogoPath = `${import.meta.env.BASE_URL}google-cloud-official.png`;

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
    <main className="min-h-screen overflow-x-hidden bg-[#f4f7fb] text-[#122b4c] lg:h-screen lg:overflow-hidden">
      <section className="grid min-h-screen lg:h-screen lg:grid-cols-2">
        <div className="relative isolate flex min-h-[460px] flex-col overflow-hidden bg-[#061b33] px-8 py-10 text-white sm:px-16 lg:h-screen lg:min-h-0 lg:px-[9%] lg:py-10">
          <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden opacity-10">
            <img className="absolute left-1/2 top-1/2 h-[95%] w-[95%] -translate-x-1/2 -translate-y-1/2 object-contain blur-[1px] grayscale" src={markPath} alt="" aria-hidden="true" />
          </div>
          <div className="pointer-events-none absolute -left-32 top-8 h-96 w-96 rounded-full border border-[#087af0]/40" aria-hidden="true" />
          <div className="pointer-events-none absolute -bottom-64 -left-20 h-[34rem] w-[34rem] rounded-full border border-[#087af0]/40" aria-hidden="true" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[#0c2b4d]/80 to-transparent" aria-hidden="true" />

          <div className="relative z-10 flex flex-1 flex-col items-center justify-center lg:items-start">
            <img className="h-auto w-[min(70vw,360px)] object-contain grayscale brightness-0 invert" src={logoPath} alt="NEXT GLASS Vidrios y Aluminios" />
          </div>
        </div>

        <div className="flex items-center justify-center overflow-y-auto px-5 py-8 sm:px-10 lg:h-screen lg:overflow-hidden lg:px-[8%] lg:py-6">
          <form className="w-full max-w-[480px] rounded-[2rem] bg-white px-7 py-7 shadow-[0_24px_70px_rgba(31,58,91,0.12)] sm:px-8 sm:py-7 lg:scale-[0.96]" onSubmit={handleSubmit}>
            <div>
              <p className="text-base font-black uppercase tracking-wide text-[#1168d9]">Acceso</p>
              <h2 className="mt-2 text-3xl font-black tracking-tight text-[#122b4c]">Iniciar sesión</h2>
            </div>

            {message ? <Notice tone="success" text={message} /> : null}
            {error ? <Notice tone="error" text={error} /> : null}

            <div className="mt-6 space-y-3">
              <label className="block">
                <span className="text-base font-black text-[#122b4c]">Correo</span>
                <input className="mt-2 h-12 w-full rounded-2xl border border-[#dce5f1] bg-[#f2f6fc] px-4 text-sm text-[#122b4c] outline-none transition placeholder:text-[#8c96a3] focus:border-[#1168d9] focus:bg-white focus:ring-4 focus:ring-[#1168d9]/10" value={email} onChange={(event) => setEmail(event.target.value)} type="email" autoComplete="email" placeholder="admin@nextglass.com" />
              </label>

              <label className="block">
                <span className="text-base font-black text-[#122b4c]">Contraseña</span>
                <input className="mt-2 h-12 w-full rounded-2xl border border-[#dce5f1] bg-[#f2f6fc] px-4 text-sm text-[#122b4c] outline-none transition placeholder:text-[#8c96a3] focus:border-[#1168d9] focus:bg-white focus:ring-4 focus:ring-[#1168d9]/10" value={password} onChange={(event) => setPassword(event.target.value)} type="password" autoComplete="current-password" placeholder="**********" />
              </label>

              <button className="inline-flex h-12 w-full items-center justify-center gap-3 rounded-2xl bg-[#1468d8] px-5 text-sm font-black text-white shadow-[0_12px_24px_rgba(20,104,216,0.2)] transition hover:bg-[#0e56b8] disabled:cursor-not-allowed disabled:opacity-60" type="submit" disabled={loading}>
                <LogIn className="h-5 w-5" aria-hidden="true" />
                {loading ? "Ingresando..." : "Iniciar sesión"}
              </button>

              <button className="inline-flex h-12 w-full items-center justify-center gap-3 rounded-2xl border border-[#bdc9d8] bg-white px-5 text-sm font-black text-[#1168d9] transition hover:bg-[#f4f8fd]" type="button" onClick={handleResetPassword}>
                <KeyRound className="h-5 w-5" aria-hidden="true" />
                Recuperar contraseña
              </button>

              {demoVisible ? <button className="h-12 w-full rounded-2xl border border-[#bdc9d8] bg-white px-5 text-sm font-black text-[#1168d9] transition hover:bg-[#f4f8fd]" type="button" onClick={demoLogin}>Entrar en modo demo</button> : null}
            </div>

            <div className="mt-5 border-t border-[#dfe5ed] pt-4 text-center">
              <p className="text-sm font-medium uppercase tracking-wide text-[#9199a4]">Ingreso seguro potenciado por</p>
              <div className="mt-3 flex flex-wrap items-center justify-center gap-x-8 gap-y-2 grayscale opacity-75">
                <img className="h-7 w-auto max-w-[120px] object-contain" src={firebaseLogoPath} alt="Firebase" />
                <img className="h-7 w-auto max-w-[150px] object-contain" src={googleCloudLogoPath} alt="Google Cloud" />
              </div>
              <p className="mt-4 text-[11px] font-medium text-[#a1a7af]">¿Necesitas ayuda para ingresar? Contactá al administrador.</p>
            </div>
          </form>
        </div>
      </section>
    </main>
  );
}

function Notice({ tone, text }: { tone: "success" | "error"; text: string }) {
  return <div className={`mt-6 rounded-xl border px-4 py-3 text-sm font-semibold leading-6 ${tone === "success" ? "border-green-100 bg-green-50 text-next-green" : "border-red-100 bg-red-50 text-next-red"}`}>{text}</div>;
}
