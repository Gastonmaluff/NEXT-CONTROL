import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from "react";
import type { User } from "firebase/auth";
import {
  getCurrentUserProfile,
  sendPasswordReset,
  signInWithEmail,
  signOutUser,
  subscribeToAuthState
} from "../lib/auth";
import { isFirebaseConfigured } from "../lib/firebase";
import type { SystemUser } from "../types";

type AuthContextValue = {
  authUser: User | null;
  profile: SystemUser | null;
  role: SystemUser["role"] | null;
  loading: boolean;
  isAuthenticated: boolean;
  isDemo: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  demoLogin: () => void;
  resetPassword: (email: string) => Promise<void>;
};

const demoProfile: SystemUser = {
  uid: "demo-admin",
  nombre: "Richard",
  email: "demo@nextglass.com",
  role: "admin",
  active: true,
  assignedWorkIds: [],
  createdAt: "2026-06-01T00:00:00.000Z",
  createdBy: "demo"
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<SystemUser | null>(null);
  const [loading, setLoading] = useState(true);
  const firebaseReady = isFirebaseConfigured();
  const demoAllowed = !import.meta.env.PROD || !firebaseReady;

  useEffect(() => {
    const unsubscribe = subscribeToAuthState(async (user) => {
      const demoSession = localStorage.getItem("next-control-demo-session") === "true";

      if (!user) {
        setAuthUser(null);
        setProfile(demoSession && demoAllowed ? demoProfile : null);
        setLoading(false);
        return;
      }

      setAuthUser(user);
      const userProfile = await getCurrentUserProfile();
      if (userProfile?.active === false) {
        await signOutUser();
        setAuthUser(null);
        setProfile(null);
      } else {
        setProfile(userProfile);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, [demoAllowed]);

  const value = useMemo<AuthContextValue>(() => ({
    authUser,
    profile,
    role: profile?.role ?? null,
    loading,
    isAuthenticated: Boolean(authUser || profile),
    isDemo: profile?.uid === "demo-admin",
    login: async (email, password) => {
      await signInWithEmail(email, password);
    },
    logout: signOutUser,
    demoLogin: () => {
      if (!demoAllowed) return;
      localStorage.setItem("next-control-demo-session", "true");
      setProfile(demoProfile);
    },
    resetPassword: sendPasswordReset
  }), [authUser, demoAllowed, loading, profile]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth debe usarse dentro de AuthProvider.");
  }
  return context;
}
