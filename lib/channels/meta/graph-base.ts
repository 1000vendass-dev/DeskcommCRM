/**
 * O HOST DA GRAPH TEM UM LUGAR SÓ — dentro da fronteira do canal.
 *
 * ─── O que era o defeito (issue #817) ────────────────────────────────────────
 *
 * A VERSÃO da Graph já tinha um lugar só (`lib/graph-version.ts`, #862). O HOST
 * não: `graph.facebook.com` estava escrito à mão em onze linhas de seis arquivos
 * de produção, e nenhum deles podia ser redirecionado. A consequência não é o dia
 * em que o host muda — é o dia em que alguém PRECISA que mude, que é a prova de
 * tela: sem um receptor local, um e2e do canal oficial não tem para onde falar, e
 * o caminho de entrada (conectar, enviar, ler status, baixar mídia, sincronizar
 * modelos, registrar webhook) continua coberto só por dublê de `fetch`, que prova
 * o OurOwn e não a rede.
 *
 * ─── Por que um util GLOBAL seria o desenho errado ───────────────────────────
 *
 * A doutrina de restrição de canal (`docs/doctrine/restricao-de-canal.md`) diz que
 * só a fronteira nomeia o transporte, e o `pnpm lint:channels` cobra isso por
 * construção. Um `lib/graph-base.ts` na raiz seria um segundo lugar que nomeia o
 * host e que TODO mundo pode importar — inclusive a feature, que passaria a poder
 * falar com a plataforma de anúncios sem passar pela fronteira dela. Por isso o
 * host mora AQUI, em `lib/channels/meta/`, e a estação de anúncio tem a SUA
 * própria cópia em `lib/plataformas-de-anuncio/meta/`. São dois eixos com
 * credenciais e ciclos de vida diferentes — a mesma razão pela qual a versão já
 * não é herdada entre eles.
 *
 * ─── Por que a sobreposição é por ENV, e não por organização ─────────────────
 *
 * Destino de chamada é decisão da INSTALAÇÃO, não da organização: o token que
 * acompanha a requisição é por sessão, mas o host é o mesmo para todos os
 * tenants. Deixar isso por organização abriria superfície de SSRF por tenant — o
 * token de um tenant passando por um host que o outro escolheu — sem ganhar
 * nada. Nenhum campo de tela, nenhuma coluna: quem opera aponta a variável no
 * ambiente e reinicia.
 *
 * ─── O portão do override é FECHADO, e é o que separa isto de uma fenda de SSRF ──
 *
 * O valor de `META_GRAPH_BASE_URL` é um destino de chamada, e destino de
 * chamada Configurável é, por definição, a superfície que o revisor precisa ver
 * fechada. Três regras, todas medidas por teste:
 *
 * 1. **Só esquema absoluto.** `http` ou `https` e nada mais. `ftp://`,
 *    `file://`, `javascript:` e caminho relativo caem no host real — não viram
 *    exceção, viram o valor que sempre teve.
 * 2. **Barra final é aparada.** `https://recetor/` e `https://recetor` montam a
 *    MESMA base; sem o `replace` viraria `//v22.0` depois da versão, que a Graph
 *    real nunca devolveria e o receptor local jamais casaria.
 * 3. **Recusa ABERTA no log, fechada na ação.** O valor ruim não derruba o envio
 *    (uma instalação que colou um endereço sem `https` continua falando com a
 *    Meta) e não some em silêncio: o aviso diz qual chave e qual valor chegou.
 *    É a mesma doutrina de `diasDeRetencao` em `lib/env.ts` — falha fechada na
 *    ação, aberta na informação.
 *
 * ⚠️ O QUE ISTO **NÃO** PROTEGE, e a decisão é do mantenedor: uma variável de
 * ambiente é escrita por quem tem acesso ao host da VPS, e quem tem esse acesso
 * já pode trocar o binário. O que o portão impede é o erro (endereço colado sem
 * esquema, com barra sobrando, com variável vazia) virar uma quebra em produção.
 * análise de SSRF de produção é revisão do PR, como a issue combinou.
 */
import { graphVersion } from "@/lib/graph-version";

/** O host real. A instalação que não aponta a variável fala com a Meta. */
export const HOST_PADRAO_DA_GRAPH = "https://graph.facebook.com";

/** A variável que aponta a base para outro lugar (prova em tela, homólogo). */
const CHAVE = "META_GRAPH_BASE_URL";

/**
 * A base da Graph API **desta instalação**, já com a versão dentro: o que os
 * onze pontos antigos montavam na mão, um por um.
 *
 * `versao` é o contrato do seam — quem já tinha a versão na mão (a credencial da
 * sessão, o `SyncInput`) continua mandando nela, e o que não passa nada usa
 * `graphVersion()`. Os DOIS knobs são independentes de propósito: mudar para
 * onde a plataforma fala não é a mesma decisão que mudar com que versão ela é
 * chamada, e um receiver de prova em tela precisa poder ser o par dos dois.
 */
export function graphBaseUrl(versao?: string): string {
  return `${graphHost()}/${versao ?? graphVersion()}`;
}

/**
 * Só o host, sem a versão. Para quem precisa do host cru (o `montarUrl` do eixo de
 * anúncio monta a URL com `new URL`, que não quer caminho).
 */
export function graphHost(): string {
  const daVariavel = process.env[CHAVE]?.trim();
  if (!daVariavel) return HOST_PADRAO_DA_GRAPH;
  return hostAceito(daVariavel) ?? recusa(daVariavel);
}

/**
 * O que a variável aponta, ou `null` quando não é uma base aceitável.
 *
 * Separado da leitura de propósito: quem quiser validar o valor (o `.env.example`
 * no teste, o aviso do log) chama isto sem passar pelo `console.warn`.
 */
export function hostAceito(valor: string | undefined): string | null {
  const trimmed = valor?.trim();
  if (!trimmed) return null;
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }
  // `new URL` aceita `ftp:` e `file:` — e um destino de chamada que aceitasse
  // isso é pior do que não ter override. Só web.
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  if (!url.hostname) return null;
  // Consulta e fragmento não fazem parte de uma base: `?x=1` colado no env
  // seria Transportada para o meio do caminho de cada requisição.
  return `${url.protocol}//${url.host}${url.pathname.replace(/\/+$/, "")}`;
}

/** Recusa ABERTA, ação fechada: o host real e um aviso que diz o que chegou. */
function recusa(valor: string): string {
  console.warn(
    `[canal.meta] ${CHAVE} recusado (${JSON.stringify(valor)}): use uma base absoluta ` +
      `http:// ou https://. Falando com o host real desta vez.`,
  );
  return HOST_PADRAO_DA_GRAPH;
}
