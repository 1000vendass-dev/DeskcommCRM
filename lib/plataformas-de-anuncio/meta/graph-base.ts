/**
 * O HOST DA GRAPH DO EIXO DE ANÚNCIO — um lugar só, dentro da SUA fronteira.
 *
 * ─── Por que esta cópia e não a do canal ─────────────────────────────────────
 *
 * O canal de mensagem e a conta de anúncios são duas credenciais com ciclos de
 * vida diferentes, falando com a mesma plataforma. `lib/graph-version.ts` já
 * registra essa decisão: os dois eixos usam a MESMA versão, de propósito, mas
 * NENHUM herda a variável do outro. Aqui é igual, e por três razões medidas:
 *
 * 1. **A fronteira.** `scripts/lint-channels.ts` só libera nome de provider
 *    dentro de `lib/channels/` e `lib/plataformas-de-anuncio/`. Um util na raiz
 *    seria um terceiro lugar que nomeia o host, e a feature passaria a poder
 *    falar com a plataforma de anúncios sem passar por esta fronteira.
 * 2. **O override.** Uma instalação pode apontar o canal para um recetor de
 *    prova em tela e o anúncio para a produção (ou o contrário) sem que uma
 *    variável mate a outra. Quem aponta o canal para `127.0.0.1` para provar a
 *    jornada de envio não pode, ao mesmo tempo, estar reportando conversão de
 *    venda para o vazio.
 * 3. **A conta.** A conta de anúncios é do cliente e a credencial vem por
 *    organização; o canal oficial é da instalação. Um knob único seria um
 *    botão que muda o destino de duas contas diferentes ao mesmo tempo.
 *
 * O portão de validação é o MESMO do canal, pelas mesmas três medidas: base
 * absoluta `http`/`https`, barra final aparada, e recusa que fecha na ação (host
 * real) e abre no log. Ver `lib/channels/meta/graph-base.ts` para a justificativa
 * de cada regra — aqui ela é replicada, não importada, pela fronteira.
 */
import { VERSAO_PADRAO_DA_GRAPH } from "@/lib/graph-version";

/** O host real da Meta para o eixo de anúncio. */
export const HOST_PADRAO_DA_GRAPH_DE_ANUNCIO = "https://graph.facebook.com";

/** A variável deste eixo. Nome próprio, e a razão está no cabeçalho. */
const CHAVE = "META_ADS_GRAPH_BASE_URL";

/**
 * A base com a versão — `https://graph.facebook.com/v22.0`.
 *
 * A VERSÃO é a constante do eixo (`VERSAO_PADRAO_DA_GRAPH`, a MESMA que
 * `conversions.ts` fixava), e não a função `graphVersion()` do canal: o anúncio
 * não herda a variável do canal de mensagem, por decisão já escrita em
 * `lib/graph-version.ts`. Subir de versão é uma edição deliberada num arquivo só,
 * e a razão está no cabeçalho de `insights.ts`: campo válido some entre versões
 * sem aviso.
 */
export function baseDaGraphDeAnuncio(): string {
  return `${hostDaGraphDeAnuncio()}/${VERSAO_PADRAO_DA_GRAPH}`;
}

/** Só o host, para quem monta a URL com `new URL` e não quer caminho dentro. */
export function hostDaGraphDeAnuncio(): string {
  const daVariavel = process.env[CHAVE]?.trim();
  if (!daVariavel) return HOST_PADRAO_DA_GRAPH_DE_ANUNCIO;
  return hostAceito(daVariavel) ?? recusa(daVariavel);
}

/** O que a variável aponta, ou `null` quando não é base aceitável. */
export function hostAceito(valor: string | undefined): string | null {
  const trimmed = valor?.trim();
  if (!trimmed) return null;
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  if (!url.hostname) return null;
  return `${url.protocol}//${url.host}${url.pathname.replace(/\/+$/, "")}`;
}

function recusa(valor: string): string {
  console.warn(
    `[ads.meta] ${CHAVE} recusado (${JSON.stringify(valor)}): use uma base absoluta ` +
      `http:// ou https://. Falando com o host real desta vez.`,
  );
  return HOST_PADRAO_DA_GRAPH_DE_ANUNCIO;
}
