// Proxy para o ViaCEP. Evita CORS no navegador e permite cache no futuro.
// GET /api/shipping/cep/01153000 → { logradouro, bairro, localidade, uf, ... }

type Params = Promise<{ cep: string }>;

type ViaCepResult = {
  cep?: string;
  logradouro?: string;
  complemento?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
  erro?: boolean;
};

export async function GET(_request: Request, { params }: { params: Params }) {
  const { cep: raw } = await params;
  const cep = String(raw).replace(/\D/g, '');
  if (cep.length !== 8) {
    return Response.json({ error: 'CEP inválido' }, { status: 400 });
  }

  try {
    const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      return Response.json({ error: 'Falha ao consultar ViaCEP' }, { status: 502 });
    }
    const data = (await res.json()) as ViaCepResult;
    if (data.erro) {
      return Response.json({ error: 'CEP não encontrado' }, { status: 404 });
    }
    return Response.json({
      cep: data.cep ?? cep,
      logradouro: data.logradouro ?? '',
      bairro: data.bairro ?? '',
      cidade: data.localidade ?? '',
      uf: data.uf ?? '',
    });
  } catch (err) {
    console.error('[shipping/cep] ViaCEP error', err);
    return Response.json({ error: 'Timeout ao consultar ViaCEP' }, { status: 504 });
  }
}
