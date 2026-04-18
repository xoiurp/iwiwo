"use client";

// Client-side context providers wrapper. Currently just wraps NextAuth's
// SessionProvider so `useSession()` / client-side `signIn()` work anywhere in
// the tree. Add more providers (Theme, Query, etc.) here as needed.

import type { ReactNode } from "react";
import { SessionProvider } from "next-auth/react";

export default function Providers({ children }: { children: ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
