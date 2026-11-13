"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { usePathname, useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import { messages, type Locale } from "@/lib/i18n";
import type { AppUser, Clinic, ClinicSettings } from "@/lib/types";

interface AppContextValue {
  user: AppUser | null;
  clinic: Clinic | null;
  settings: ClinicSettings | undefined;
  locale: Locale;
  t: (typeof messages)["en"];
  loading: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

function applyTheme(theme: ClinicSettings["theme"] | undefined) {
  const root = document.documentElement;
  const preferred =
    theme === "system"
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"
      : theme || "light";
  root.setAttribute("data-theme", preferred);
}

export function AppProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<AppUser | null>(null);
  const [clinic, setClinic] = useState<Clinic | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async (uid: string) => {
    const userSnapshot = await getDoc(doc(db, "users", uid));
    const userData = userSnapshot.data() as AppUser | undefined;
    if (!userSnapshot.exists() || !userData?.profileComplete || !userData.clinicId) {
      setUser(null);
      setClinic(null);
      return { complete: false as const };
    }
    const clinicSnapshot = await getDoc(doc(db, "clinics", userData.clinicId));
    setUser({ ...userData, uid });
    setClinic((clinicSnapshot.data() as Clinic) || null);
    applyTheme(clinicSnapshot.data()?.settings?.theme);
    return { complete: true as const };
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        setUser(null);
        setClinic(null);
        setLoading(false);
        if (pathname?.startsWith("/dashboard")) router.replace("/");
        return;
      }
      try {
        const result = await load(firebaseUser.uid);
        if (!result.complete && pathname?.startsWith("/dashboard")) {
          router.replace("/onboarding");
        }
      } catch (error) {
        console.error("Could not load clinic workspace:", error);
        if (pathname?.startsWith("/dashboard")) router.replace("/onboarding");
      } finally {
        setLoading(false);
      }
    });
    return unsubscribe;
  }, [pathname, router]);

  const locale: Locale = clinic?.settings?.language === "hi" ? "hi" : "en";

  const value = useMemo<AppContextValue>(
    () => ({
      user,
      clinic,
      settings: clinic?.settings,
      locale,
      t: messages[locale],
      loading,
      refresh: async () => {
        const current = auth.currentUser;
        if (current) await load(current.uid);
      },
      logout: async () => {
        await signOut(auth);
        router.replace("/");
      },
    }),
    [clinic, loading, locale, user, router]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useApp must be used within AppProvider");
  }
  return context;
}
