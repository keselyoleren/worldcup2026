"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, signInWithPopup, signOut as fbSignOut, type User } from "firebase/auth";
import { auth, googleProvider, firebaseReady } from "@/lib/firebase";

type AuthCtx = {
  user: User | null;
  loading: boolean; // masih menunggu status auth pertama dari Firebase
  ready: boolean; // Firebase sudah dikonfigurasi (env terisi)
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
};

const Ctx = createContext<AuthCtx>({
  user: null,
  loading: true,
  ready: false,
  signIn: async () => {},
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(firebaseReady);

  useEffect(() => {
    if (!auth) return;
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
  }, []);

  const signIn = async () => {
    if (!auth) return;
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (e: unknown) {
      // Popup ditutup user = bukan error yang perlu ditampilkan
      const code = (e as { code?: string })?.code;
      if (code !== "auth/popup-closed-by-user" && code !== "auth/cancelled-popup-request") {
        console.error("Login Google gagal:", e);
        alert("Login Google gagal. Coba lagi, atau cek konsol untuk detail.");
      }
    }
  };

  const signOut = async () => {
    if (auth) await fbSignOut(auth);
  };

  return (
    <Ctx.Provider value={{ user, loading, ready: firebaseReady, signIn, signOut }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  return useContext(Ctx);
}
