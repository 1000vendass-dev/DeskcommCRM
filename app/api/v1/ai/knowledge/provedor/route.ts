import { requireSupportWrite } from "@/lib/impersonate/support";
/**
 * PUT /api/v1/ai/knowledge/provedor — quem prepara a base: OpenAI ou Google.
 *
 * Contribuição de @vgamkt (#1130): a base de conhecimento exigia uma chave da
 * OpenAI, e quem só tinha a do Google ficava sem base.
 *
 * A escolha mora onde a escada de `lib/ai/embeddings/chave.ts` já olha primeiro:
 * os dois pontos de embedding em `ai_purpose_bindings`, SEMPRE juntos —
 * indexar com um provedor e consultar com outro é a falha que não dá erro, só
 * resposta sem o seu material.
 *
 *  * `google` — amarra os dois pontos à chave do Google mais antiga, ativa e
 *    validada. Sem ela, 422: a troca não pode apontar para uma chave que não
 *    serve, senão a escada cai de volta na OpenAI e a tela mente.
 *  * `openai` — desfaz a escolha do Google (apaga só os bindings `google`). Só
 *    vale se, sem ela, a escada acha uma chave OpenAI/OpenRouter/gateway.
 *
 * Trocar REFAZ A BASE: a busca só compara trechos do mesmo modelo, e o indexador
 * reembeda toda fonte cujo modelo mudou. A fila sai neste mesmo pedido
 * (`enfileirarTodosOsMateriais`), não num segundo clique.
 *
 * Auth: admin — decide para qual fornecedor o texto do material vai. A
 * organização vem da sessão, nunca do corpo. Audita `ai.knowledge_provider_changed`
 * quando a troca acontece; pedir o provedor que já está valendo não é mutação.
 */
import { randomUUID } from "node:crypto";
import { type NextRequest } from "next/server";
import { z } from "zod";

import {
  MODELO_DE_EMBEDDING_DO_GOOGLE,
  provedorDaBase,
  resolverChaveDeEmbedding,
  type PontoDeEmbedding,
} from "@/lib/ai/embeddings/chave";
import { enfileirarTodosOsMateriais } from "@/lib/ai/knowledge/reprepara-tudo";
import { fail, ok } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/require-role";
import { traduzir } from "@/lib/i18n/dicionario";
import { logger } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const PONTOS: PontoDeEmbedding[] = ["embedding_indexar", "embedding_consultar"];

const corpoSchema = z.object({ provedor: z.enum(["openai", "google"]) }).strict();

export async function PUT(req: NextRequest): Promise<Response> {
  const supportDenied = await requireSupportWrite();
  if (supportDenied) return supportDenied;

  const requestId = randomUUID();
  const authz = await requireRole("admin", { requestId, resource: "ai_knowledge" });
  if (!authz.ok) return authz.response;
  const { org, user } = authz;
  const t = (texto: string) => traduzir(texto, user.idioma);

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return fail("invalid_request", t("Body JSON inválido."), 400, { requestId });
  }
  const parsed = corpoSchema.safeParse(raw);
  if (!parsed.success) {
    return fail("validation_failed", t("Campos inválidos."), 422, {
      requestId,
      details: parsed.error.flatten(),
    });
  }
  const { provedor } = parsed.data;

  const atual = await resolverChaveDeEmbedding(org.orgId, "embedding_indexar");
  const provedorAnterior = atual ? provedorDaBase(atual) : null;
  if (provedorAnterior === provedor) {
    return ok({ provedor, mudou: false, fila: null }, { requestId });
  }

  const admin = createAdminClient();

  if (provedor === "google") {
    const { data: credencial } = await admin
      .from("ai_provider_credentials")
      .select("id")
      .eq("organization_id", org.orgId)
      .eq("provider", "google")
      .eq("is_active", true)
      .not("validated_at", "is", null)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (!credencial) {
      return fail(
        "sem_chave_do_provedor",
        t("Cadastre e valide uma chave do Google em IA › Credenciais antes de trocar."),
        422,
        { requestId },
      );
    }
    const { error } = await admin.from("ai_purpose_bindings").upsert(
      PONTOS.map((purpose) => ({
        organization_id: org.orgId,
        purpose,
        provider: "google",
        credential_id: (credencial as { id: string }).id,
        model_id: MODELO_DE_EMBEDDING_DO_GOOGLE,
        base_url: null,
        is_enabled: true,
      })),
      { onConflict: "organization_id,purpose" },
    );
    if (error) {
      logger.error("[ai-knowledge-provedor] falha ao gravar a escolha", {
        error: error.message,
        requestId,
      });
      return fail("internal_error", t("Não foi possível trocar o provedor."), 500, { requestId });
    }
  } else {
    const semEscolha = await resolverChaveDeEmbedding(org.orgId, "embedding_indexar", {
      semEscolha: true,
    });
    if (!semEscolha || provedorDaBase(semEscolha) !== "openai") {
      return fail(
        "sem_chave_do_provedor",
        t("Cadastre e valide uma chave da OpenAI ou OpenRouter em IA › Credenciais antes de trocar."),
        422,
        { requestId },
      );
    }
    const { error } = await admin
      .from("ai_purpose_bindings")
      .delete()
      .eq("organization_id", org.orgId)
      .in("purpose", PONTOS)
      .eq("provider", "google");
    if (error) {
      logger.error("[ai-knowledge-provedor] falha ao desfazer a escolha", {
        error: error.message,
        requestId,
      });
      return fail("internal_error", t("Não foi possível trocar o provedor."), 500, { requestId });
    }
  }

  // A troca já valeu; a fila é o que refaz a base. Se ela falhar, o botão
  // "Preparar tudo de novo" da mesma tela é o caminho de volta — e a resposta
  // diz isso em vez de fingir sucesso inteiro.
  let fila = null;
  try {
    fila = await enfileirarTodosOsMateriais({
      leitura: await createClient(),
      admin,
      organizationId: org.orgId,
      requestId,
      motivo: "troca_de_provedor",
    });
  } catch (err) {
    logger.error("[ai-knowledge-provedor] troca feita, fila de reindexação não saiu", {
      error: err instanceof Error ? err.message : String(err),
      requestId,
    });
  }

  void audit({
    action: "ai.knowledge_provider_changed",
    actorUserId: user.id,
    organizationId: org.orgId,
    resourceType: "ai_purpose_binding",
    requestId,
    metadata: { de: provedorAnterior, para: provedor, fila },
  });

  return ok({ provedor, mudou: true, fila }, { requestId });
}
