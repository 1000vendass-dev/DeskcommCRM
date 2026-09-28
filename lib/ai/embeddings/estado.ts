/**
 * O estado da chave da base de conhecimento, como a tela o recebe.
 *
 * Um só construtor para a página (render de servidor) e para
 * `GET /api/v1/ai/knowledge/chave` (o polling do hook): eram dois blocos iguais,
 * e um campo novo em só um deles faria a tela mudar de resposta no primeiro
 * refetch.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  EXPLICACAO_DA_ORIGEM,
  provedorDaBase,
  resolverChaveDeEmbedding,
  type ProvedorDaBase,
} from "@/lib/ai/embeddings/chave";

export interface EstadoDaChave {
  pode_indexar: boolean;
  origem: string | null;
  explicacao: string | null;
  chave_em_uso: string | null;
  avisos: string[];
  /** Quem prepara a base hoje; `null` sem chave. */
  provedor: ProvedorDaBase | null;
  /** Para onde dá para trocar AGORA (há chave utilizável do outro lado); `null` = nenhum. */
  pode_trocar_para: ProvedorDaBase | null;
  credenciais_embedding: Array<{
    id: string;
    provider: "openai" | "openrouter" | "google";
    label: string;
    api_key_last4: string | null;
    validated_at: string | null;
    validation_error: string | null;
    is_active: boolean;
  }>;
}

export async function montarEstadoDaChave(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<EstadoDaChave> {
  const [chave, { data }] = await Promise.all([
    resolverChaveDeEmbedding(organizationId),
    supabase
      .from("ai_provider_credentials_safe")
      .select("id, provider, label, api_key_last4, validated_at, validation_error, is_active")
      .eq("organization_id", organizationId)
      .in("provider", ["openai", "openrouter", "google"])
      .order("created_at", { ascending: true }),
  ]);
  const credenciais = (data ?? []) as EstadoDaChave["credenciais_embedding"];
  const provedor = chave ? provedorDaBase(chave) : null;

  let podeTrocarPara: ProvedorDaBase | null = null;
  if (provedor === "openai") {
    const temGoogle = credenciais.some(
      (c) => c.provider === "google" && c.is_active && c.validated_at !== null,
    );
    podeTrocarPara = temGoogle ? "google" : null;
  } else if (provedor === "google") {
    // Voltar para a OpenAI = desfazer a escolha. Só vale oferecer se, sem ela,
    // a escada acha uma chave que NÃO seja a do próprio Google.
    const semEscolha = await resolverChaveDeEmbedding(organizationId, "embedding_indexar", {
      semEscolha: true,
    });
    podeTrocarPara = semEscolha && provedorDaBase(semEscolha) === "openai" ? "openai" : null;
  }

  return {
    pode_indexar: chave !== null,
    origem: chave?.origem ?? null,
    explicacao: chave ? EXPLICACAO_DA_ORIGEM[chave.origem] : null,
    chave_em_uso: chave?.rotulo ?? null,
    avisos: chave?.avisos ?? [],
    provedor,
    pode_trocar_para: podeTrocarPara,
    credenciais_embedding: credenciais,
  };
}
