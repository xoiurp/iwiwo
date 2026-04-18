import { redirect } from "next/navigation";
import { auth } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";
import AddressesClient, { type AddressRow } from "./AddressesClient";

export const dynamic = "force-dynamic";

export default async function EnderecosPage() {
  const session = await auth();
  if (!session?.user?.email) redirect("/conta/login");

  const customer = await prisma.customer.findFirst({
    where: { user: { email: session.user.email } },
    select: {
      id: true,
      addresses: {
        orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
        select: {
          id: true,
          label: true,
          recipient: true,
          cep: true,
          street: true,
          number: true,
          complement: true,
          neighborhood: true,
          city: true,
          state: true,
          country: true,
          isDefault: true,
        },
      },
    },
  });

  const rows: AddressRow[] = customer?.addresses ?? [];

  return (
    <div>
      <h1 className="conta-heading">Endereços</h1>
      <p className="conta-subheading">
        Gerencie os endereços de entrega da sua conta.
      </p>
      <AddressesClient initial={rows} />
    </div>
  );
}
