import { redirect } from "next/navigation";
import { auth, signOut } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";
import ActiveLink from "./ActiveLink";
import "./protected.css";

export const dynamic = "force-dynamic";

export default async function ProtectedContaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user?.email) redirect("/conta/login");

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: {
      name: true,
      email: true,
      customer: { select: { id: true, name: true } },
    },
  });
  if (!user) redirect("/conta/login");

  const displayName =
    user.customer?.name || user.name || user.email || "Minha conta";

  return (
    <div className="conta-shell">
      <aside className="conta-sidebar" aria-label="Menu da conta">
        <div className="conta-user">
          <div className="conta-user-name" title={displayName}>
            {displayName}
          </div>
          <div className="conta-user-email" title={user.email ?? ""}>
            {user.email}
          </div>
        </div>
        <nav className="conta-nav" aria-label="Navegação da conta">
          <ActiveLink href="/conta" exact>
            Painel
          </ActiveLink>
          <ActiveLink href="/conta/pedidos">Meus Pedidos</ActiveLink>
          <ActiveLink href="/conta/suporte">Suporte</ActiveLink>
          <ActiveLink href="/conta/perfil">Perfil</ActiveLink>
          <ActiveLink href="/conta/enderecos">Endereços</ActiveLink>
        </nav>
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/" });
          }}
        >
          <button type="submit" className="conta-signout">
            Sair
          </button>
        </form>
      </aside>
      <main className="conta-main">{children}</main>
    </div>
  );
}
