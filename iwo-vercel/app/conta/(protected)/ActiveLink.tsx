"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

type Props = {
  href: string;
  exact?: boolean;
  children: ReactNode;
};

/**
 * Wrapper around next/link that sets `aria-current="page"` when the route
 * matches, so CSS (`[aria-current="page"]`) can style the active item.
 */
export default function ActiveLink({ href, exact = false, children }: Props) {
  const pathname = usePathname() ?? "";
  const isActive = exact
    ? pathname === href
    : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link href={href} aria-current={isActive ? "page" : undefined}>
      {children}
    </Link>
  );
}
