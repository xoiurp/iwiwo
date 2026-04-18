import { redirect } from "next/navigation";
import { auth } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";
import PerfilForm, { type PerfilInitial } from "./PerfilForm";
import ChangePasswordForm from "./ChangePasswordForm";

export const dynamic = "force-dynamic";

export default async function PerfilPage() {
  const session = await auth();
  if (!session?.user?.email) redirect("/conta/login");

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: {
      id: true,
      name: true,
      email: true,
      customer: {
        select: {
          name: true,
          phone: true,
          cpf: true,
          birthDate: true,
        },
      },
    },
  });
  if (!user) redirect("/conta/login");

  const c = user.customer;
  const initial: PerfilInitial = {
    name: c?.name ?? user.name ?? "",
    email: user.email ?? "",
    phone: c?.phone ?? "",
    cpf: c?.cpf ?? "",
    birthDate: c?.birthDate
      ? new Date(c.birthDate).toISOString().slice(0, 10)
      : "",
  };

  return (
    <div>
      <h1 className="conta-heading">Perfil</h1>
      <p className="conta-subheading">
        Atualize seus dados pessoais e senha.
      </p>

      <section className="conta-section" aria-labelledby="perfil-dados-title">
        <h2 id="perfil-dados-title" className="conta-section-title">
          Dados pessoais
        </h2>
        <PerfilForm initial={initial} />
      </section>

      <section className="conta-section" aria-labelledby="perfil-senha-title">
        <h2 id="perfil-senha-title" className="conta-section-title">
          Alterar senha
        </h2>
        <ChangePasswordForm />
      </section>
    </div>
  );
}
