import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";

import { ok, fail } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/require-role";
import { requireSupportWrite } from "@/lib/impersonate/support";
import {
  LIMIAR_PADRAO_BUSCA,
  buscarConhecimento,
  resolverAcervoDoAgente,
} from "@/lib/ai/knowledge/busca";
import { traduzir } from "@/lib/i18n/dicionario";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * "Perguntar ao acervo" — a superfície do OPERADOR sobre a MESMA busca que a IA faz.
 *
 * Não reimplementa retrieval: chama `buscarConhecimento`, que o próprio docblock
 * define como "operação única, compartilhada". Duas implementações divergiriam em
 * limiar e em top-K, e o sistema passaria a responder diferente para a IA e para o
 * humano sobre o MESMO acervo — que é exatamente o defeito que a casa já corrigiu
 * uma vez (limiares 0,40 / 0,72 / 0,72 unificados na migração 0097).
 *
 * `organization_id` sai da sessão autenticada (`requireRole`), NUNCA do corpo —
 * mesma regra documentada em `lib/ai/knowledge/busca.ts`.
 *
 * Devolve `motivo` junto de um `trechos` possivelmente vazio, porque "a base não
 * tem essa informação" e "a base tem algo perto, mas não o bastante" são situações
 * que pedem ações opostas (reformular × perguntar para humano) e não podem chegar
 * iguais a quem pergunta. Sem isso a tela promete "sem resultado" para uma busca
 * que quase acertou.
 */

const QUANTIDADE_PADRAO = 6;
const QUANTIDADE_MAXIMA = 10;

type Corpo = {
  pergunta?: unknown;
  agentId?: unknown;
  quantidade?: unknown;
};

/** Converte o corpo sem confiar em tipo algum — qualquer coisa fora vira o default. */
function numero(v: unknown, padrao: number, min: number, max: number): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return padrao;
  return Math.min(max, Math.max(min, Math.floor(n)));
}

export async function POST(req: NextRequest): Promise<Response> {
  const requestId = randomUUID();

  // A rota MUTA: a F2 da #1869 grava a pergunta em `knowledge_searches`.
  // Sem esta guarda, o modo support_readonly seria ignorado por um handler que
  // escreve — quem está acompanhando em leitura veria linhas novas nascendo
  // métrica da própria instalação. `requireSupportWrite` (retorno não-nulo é a
  // recusa) cuida do MODO DE ACOMPANHAMENTO; o `requireRole` abaixo cuida do
  // PAPEL. Um não substitui o outro.
  const support = await requireSupportWrite();
  if (support) return support;

  // Papel mínimo do inbox: um atendente lê conversa e lê acervo.
  const authz = await requireRole("agent", { requestId, resource: "ai_knowledge" });
  if (!authz.ok) return authz.response;
  const t = (texto: string) => traduzir(texto, authz.user.idioma);

  let corpo: Corpo;
  try {
    corpo = (await req.json()) as Corpo;
  } catch {
    return fail("unprocessable", t("Corpo inválido."), 422, { requestId });
  }

  const pergunta = typeof corpo.pergunta === "string" ? corpo.pergunta.trim() : "";
  if (pergunta.length < 2) {
    return fail("unprocessable", t("Digite pelo menos 2 caracteres."), 422, { requestId });
  }

  const organizationId = authz.org.orgId;
  const supabase = await createClient();

  const agentId = typeof corpo.agentId === "string" && corpo.agentId ? corpo.agentId : null;
  const quantidade = numero(corpo.quantidade, QUANTIDADE_PADRAO, 1, QUANTIDADE_MAXIMA);

  let knowledgeSourceIds: string[];
  let limiar = LIMIAR_PADRAO_BUSCA;

  if (agentId) {
    // Escopo do agente: mesmo acervo e MESMO limiar que a IA usaria para responder.
    knowledgeSourceIds = await resolverAcervoDoAgente(supabase, organizationId, agentId);
    const { data: agente } = await supabase
      .from("ai_agents")
      .select("config")
      .eq("id", agentId)
      .eq("organization_id", organizationId)
      .maybeSingle();
    const cfg = agente?.config as { rag_similarity_threshold?: unknown } | null;
    if (typeof cfg?.rag_similarity_threshold === "number") {
      limiar = cfg.rag_similarity_threshold;
    }
  } else {
    // Acervo da organização inteira — a biblioteca é da org; a escolha por
    // assistente é do AGENTE, não do operador que está apenas perguntando.
    const { data: fontes, error } = await supabase
      .from("ai_knowledge_sources")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("is_active", true);
    if (error) {
      return fail("internal_error", t("Não foi possível ler o acervo."), 500, { requestId });
    }
    knowledgeSourceIds = (fontes ?? []).map((f) => f.id as string);
  }

  if (knowledgeSourceIds.length === 0) {
    // Acervo vazio NÃO é "sem resultado": é acervo errado ou recém-criado.
    // Dizer "nada encontrado" aqui seria mentir e soaria como defeito.
    return ok(
      {
        trechos: [],
        melhorSimilaridade: null,
        motivo: t("Este acervo ainda não tem material publicado."),
        acervo: { fontes: 0, limiar },
      },
      { requestId },
    );
  }

  try {
    const resultado = await buscarConhecimento(supabase, {
      organizationId,
      knowledgeSourceIds,
      pergunta,
      topK: quantidade,
      limiar,
    });

    const vazio = resultado.trechos.length === 0;
    const melhor = resultado.melhorSimilaridade;

    // Três coisas diferentes chegam como "vazio" e pedem respostas opostas.
    const motivo = vazio
      ? melhor === null
        ? t("A base não tem essa informação.")
        : t("Há algo parecido no acervo, mas ainda abaixo do limiar — tente outras palavras.")
      : null;

    void audit({
      action: "ai.knowledge_searched",
      actorUserId: authz.user.id,
      organizationId,
      resourceType: "knowledge_source",
      // Uma busca atravessa VÁRIAS fontes — não existe "a" linha que seja o
      // recurso desta ação, então `null` é o valor honesto (é o que o gate
      // `audit-resource-id-e-uuid` recomenda, e o que outras 6 rotas fazem).
      // `knowledgeSourceIds[0]` seria pior: pegaria a primeira fonte como se
      // fosse ela a consultada. Os detalhes vivem no metadata.
      resourceId: null,
      requestId,
      metadata: {
        fontes: knowledgeSourceIds.length,
        encontros: resultado.trechos.length,
        melhor_similaridade: melhor,
        escopo: agentId ? "agente" : "organizacao",
      },
    });

    // (função logo abaixo, fora do handler — ela nunca pode derrubar a busca)
    void registrarBuscaHumana(supabase, {
      organizationId,
      hits: resultado.trechos.length,
      topScore: melhor,
      threshold: limiar,
      fontes: knowledgeSourceIds,
      agentId: agentId ?? null,
      userId: authz.user.id,
    });

    return ok(
      {
        trechos: resultado.trechos,
        melhorSimilaridade: melhor,
        motivo,
        acervo: { fontes: knowledgeSourceIds.length, limiar },
      },
      { requestId },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[ai-knowledge-busca] falhou:", msg);
    return fail("internal_error", t("Não foi possível consultar o acervo."), 500, { requestId });
  }
}

/**
 * Grava a pergunta do OPERADOR em `knowledge_searches` — F2 da #1869.
 *
 * ## Por que existe
 *
 * Só o caminho do agente gravava (`search-knowledge.ts:122`). O gráfico de
 * `/app/ai/evolution` conta linhas SEM filtrar (`aggregate.ts:201`), então uma
 * linha humana aparece sozinha — mas só aparece se alguém gravar. `author_kind`
 * (`'human'`) é o que a torna distinguível depois; `agent_id is null` não
 * serviria, porque é `on delete set null` desde a 0181.
 *
 * ## Por que nunca pode derrubar a busca
 *
 * O `catch` do handler devolveria 500 "não foi possível consultar o acervo" para
 * uma busca que CONTEÚM aconteceu e cujos trechos já estão na mão. É o defeito
 * de "prometer primeiro e desmentir depois" que o docblock desta página avisa —
 * só que no sentido inverso: aqui a tela mentiria sobre a própria falha.
 *
 * Mesma decisão do insert do agente (que é engolido de propósito lá, com o
 * `warn` encurtado para não vazar a pergunta no log — esta tabela nunca guarda
 * o texto, decisão da 0086).
 */
async function registrarBuscaHumana(
  supabase: Awaited<ReturnType<typeof createClient>>,
  p: {
    organizationId: string;
    hits: number;
    topScore: number | null;
    threshold: number;
    fontes: string[];
    agentId: string | null;
    userId: string;
  },
): Promise<void> {
  try {
    const { error } = await supabase.from("knowledge_searches").insert({
      organization_id: p.organizationId,
      hits: p.hits,
      top_score: p.topScore,
      threshold: p.threshold,
      knowledge_source_ids: p.fontes,
      // Guarda o ACERVO consultado, não "quem perguntou": com author_kind='human'
      // a dupla lê "operador perguntou sobre o acervo do assistente X", que é o
      // que o audit() chama de `escopo`.
      agent_id: p.agentId,
      author_kind: "human",
      author_user_id: p.userId,
    });
    if (error) console.warn("[ai-knowledge-busca] telemetria não gravada:", error.message);
  } catch (err) {
    console.warn(
      "[ai-knowledge-busca] telemetria não gravada:",
      err instanceof Error ? err.message.slice(0, 120) : String(err).slice(0, 120),
    );
  }
}
