import { beforeEach, describe, expect, it, vi } from "vitest";

import { resolverChaveDeEmbedding } from "@/lib/ai/embeddings/chave";
import { enfileirarTodosOsMateriais } from "@/lib/ai/knowledge/reprepara-tudo";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/require-role";
import { requireSupportWrite } from "@/lib/impersonate/support";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * PUT /api/v1/ai/knowledge/provedor — OpenAI ou Google prepara a base (#1130, @vgamkt).
 *
 * O que se trava aqui:
 *  * admin, organização da sessão;
 *  * os DOIS pontos (indexar e consultar) mudam juntos — um só quebraria a busca
 *    em silêncio;
 *  * a troca não aponta para chave que não serve (422 sem chave validada);
 *  * trocar REFAZ A BASE no mesmo pedido, e pedir o provedor que já vale não
 *    refaz nada nem audita.
 */

vi.mock("@/lib/auth/require-role", () => ({ requireRole: vi.fn() }));
vi.mock("@/lib/impersonate/support", () => ({ requireSupportWrite: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn(async () => ({})) }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/audit", () => ({ audit: vi.fn(async () => undefined) }));
vi.mock("@/lib/ai/knowledge/reprepara-tudo", () => ({ enfileirarTodosOsMateriais: vi.fn() }));
vi.mock("@/lib/ai/embeddings/chave", () => ({
  resolverChaveDeEmbedding: vi.fn(),
  // Cópias das funções puras: o módulo real puxa env e banco no import.
  provedorDaBase: (c: { provedor: string }) => (c.provedor === "google" ? "google" : "openai"),
  MODELO_DE_EMBEDDING_DO_GOOGLE: "google/gemini-embedding-001",
}));

const ORG_ID = "22222222-2222-4222-8222-222222222222";
const USER_ID = "11111111-1111-4111-8111-111111111111";

let credencialGoogle: { id: string } | null;
let filtrosDaCredencial: Array<[string, unknown]>;
let upserts: Array<{ linhas: Array<Record<string, unknown>>; opts: unknown }>;
let deletes: Array<Array<[string, unknown]>>;

function pedido(corpo: unknown): Request {
  return new Request("http://x/api/v1/ai/knowledge/provedor", {
    method: "PUT",
    body: JSON.stringify(corpo),
    headers: { "content-type": "application/json" },
  });
}

async function chamar(corpo: unknown): Promise<Response> {
  const { PUT } = await import("./route");
  return PUT(pedido(corpo) as never);
}

beforeEach(() => {
  vi.clearAllMocks();
  credencialGoogle = { id: "cred-google" };
  filtrosDaCredencial = [];
  upserts = [];
  deletes = [];

  vi.mocked(requireSupportWrite).mockResolvedValue(null as never);
  vi.mocked(requireRole).mockResolvedValue({
    ok: true,
    user: { id: USER_ID, idioma: "pt-BR" },
    org: { orgId: ORG_ID, role: "admin" },
  } as never);
  vi.mocked(enfileirarTodosOsMateriais).mockResolvedValue({
    total: 3,
    prioridade1: 0,
    prioridade2: 3,
    emitidos: 3,
  });
  // Hoje: OpenAI. Sem a escolha: também OpenAI.
  vi.mocked(resolverChaveDeEmbedding).mockResolvedValue({ provedor: "openai" } as never);

  vi.mocked(createAdminClient).mockReturnValue({
    from: (tabela: string) => {
      if (tabela === "ai_provider_credentials") {
        const q = {
          select: () => q,
          eq: (c: string, v: unknown) => (filtrosDaCredencial.push([c, v]), q),
          not: () => q,
          order: () => q,
          limit: () => q,
          maybeSingle: async () => ({ data: credencialGoogle, error: null }),
        };
        return q;
      }
      if (tabela === "ai_purpose_bindings") {
        return {
          upsert: async (linhas: Array<Record<string, unknown>>, opts: unknown) => {
            upserts.push({ linhas, opts });
            return { error: null };
          },
          delete: () => {
            const filtros: Array<[string, unknown]> = [];
            deletes.push(filtros);
            const d = {
              eq: (c: string, v: unknown) => (filtros.push([c, v]), d),
              in: (c: string, v: unknown) => (filtros.push([c, v]), d),
              then: (ok: (v: unknown) => void) => ok({ error: null }),
            };
            return d;
          },
        };
      }
      throw new Error(`tabela não dublada: ${tabela}`);
    },
  } as never);
});

describe("PUT /api/v1/ai/knowledge/provedor", () => {
  it("exige admin e recusa quem não é", async () => {
    vi.mocked(requireRole).mockResolvedValueOnce({
      ok: false,
      response: new Response(null, { status: 403 }),
    } as never);
    const r = await chamar({ provedor: "google" });
    expect(r.status).toBe(403);
    expect(requireRole).toHaveBeenCalledWith("admin", expect.objectContaining({ resource: "ai_knowledge" }));
    expect(upserts).toHaveLength(0);
    expect(enfileirarTodosOsMateriais).not.toHaveBeenCalled();
  });

  it("corpo fora do contrato: 422, e organização no corpo é recusada (strict)", async () => {
    expect((await chamar({ provedor: "anthropic" })).status).toBe(422);
    expect((await chamar({ provedor: "google", organization_id: "outra" })).status).toBe(422);
    expect(upserts).toHaveLength(0);
  });

  it("para o Google: amarra OS DOIS pontos à chave do Google da sessão, refaz a base e audita", async () => {
    const r = await chamar({ provedor: "google" });
    expect(r.status).toBe(200);

    expect(filtrosDaCredencial).toContainEqual(["organization_id", ORG_ID]);
    expect(filtrosDaCredencial).toContainEqual(["provider", "google"]);
    expect(upserts).toHaveLength(1);
    expect(upserts[0]!.linhas.map((l) => l.purpose).sort()).toEqual([
      "embedding_consultar",
      "embedding_indexar",
    ]);
    for (const l of upserts[0]!.linhas) {
      expect(l).toMatchObject({
        organization_id: ORG_ID,
        provider: "google",
        credential_id: "cred-google",
        model_id: "google/gemini-embedding-001",
        is_enabled: true,
      });
    }
    expect(enfileirarTodosOsMateriais).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: ORG_ID, motivo: "troca_de_provedor" }),
    );
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "ai.knowledge_provider_changed",
        organizationId: ORG_ID,
        metadata: expect.objectContaining({ de: "openai", para: "google" }),
      }),
    );
  });

  it("para o Google sem chave do Google validada: 422 e nada muda", async () => {
    credencialGoogle = null;
    const r = await chamar({ provedor: "google" });
    expect(r.status).toBe(422);
    expect(upserts).toHaveLength(0);
    expect(enfileirarTodosOsMateriais).not.toHaveBeenCalled();
    expect(audit).not.toHaveBeenCalled();
  });

  it("pedir o provedor que já vale não refaz a base nem audita", async () => {
    const r = await chamar({ provedor: "openai" });
    expect(r.status).toBe(200);
    expect(((await r.json()) as { data: { mudou: boolean } }).data.mudou).toBe(false);
    expect(enfileirarTodosOsMateriais).not.toHaveBeenCalled();
    expect(audit).not.toHaveBeenCalled();
  });

  it("de volta para a OpenAI: apaga só a escolha do Google desta organização e refaz a base", async () => {
    vi.mocked(resolverChaveDeEmbedding).mockImplementation((async (
      _org: string,
      _ponto: string,
      opcoes?: { semEscolha?: boolean },
    ) => ({ provedor: opcoes?.semEscolha ? "openai" : "google" })) as never);

    const r = await chamar({ provedor: "openai" });
    expect(r.status).toBe(200);
    expect(deletes).toHaveLength(1);
    expect(deletes[0]).toEqual(
      expect.arrayContaining([
        ["organization_id", ORG_ID],
        ["provider", "google"],
        ["purpose", ["embedding_indexar", "embedding_consultar"]],
      ]),
    );
    expect(enfileirarTodosOsMateriais).toHaveBeenCalledTimes(1);
  });

  it("de volta para a OpenAI sem nenhuma chave OpenAI: 422 e a escolha do Google fica", async () => {
    vi.mocked(resolverChaveDeEmbedding).mockResolvedValue({ provedor: "google" } as never);
    const r = await chamar({ provedor: "openai" });
    expect(r.status).toBe(422);
    expect(deletes).toHaveLength(0);
    expect(enfileirarTodosOsMateriais).not.toHaveBeenCalled();
  });

  it("a troca vale mesmo se a fila falhar — e a resposta diz que a base não começou a ser refeita", async () => {
    vi.mocked(enfileirarTodosOsMateriais).mockRejectedValueOnce(new Error("listar_materiais_falhou"));
    const r = await chamar({ provedor: "google" });
    expect(r.status).toBe(200);
    expect(((await r.json()) as { data: { fila: unknown } }).data.fila).toBeNull();
    expect(upserts).toHaveLength(1);
  });
});
