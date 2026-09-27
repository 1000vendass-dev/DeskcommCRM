/**
 * O `test` da suíte: o do Playwright, com uma diferença — `page.goto` e
 * `page.reload` só devolvem quando o streaming SSR terminou de REVELAR a página
 * (issue #1374). Toda spec importa daqui, não de `@playwright/test`; a cerca é
 * `tests/unit/e2e-specs-usam-o-test-da-suite.test.ts`.
 *
 * ═══ Por que `load` não basta ═══════════════════════════════════════════════
 *
 * O `react-dom` do Next 16.3.5 não revela um boundary quando o `$RC("B:N","S:N")`
 * chega: ele ENFILEIRA a revelação (`$RB`) e a executa depois, num
 * `requestAnimationFrame` ou num `setTimeout` de até 300 ms contados da revelação
 * anterior (`$RT+300-agora`). O evento `load` dispara antes disso. Nessa janela a
 * página inteira mora escondida em `<div hidden id="S:N">`.
 *
 * Se algum provedor da casca muda um contexto nessa janela, o React não pode
 * hidratar o boundary ainda pendente e o renderiza do zero no cliente: por
 * algumas centenas de milissegundos existem as DUAS cópias — a nova, visível no
 * `<main>`, e a do servidor, escondida na caixa. Quando o `$RV` enfim roda, ele
 * remove a caixa e sobra uma. O usuário nunca vê a cópia escondida; o
 * `getByTestId` vê, e reprova por strict mode ("resolved to 2 elements").
 *
 * Medido nos traces de dois runs vermelhos (36237325664 do PR #1703 e
 * 36072593385 da `main`), `/app/agenda`: logo depois do `goto`, `S:1` escondida
 * com o `tela-agenda` e o `<main>` sem ele; na falha, duas cópias; no snapshot
 * seguinte, `S:1` já não existe e o `<main>` tem uma. A caixa não é órfã — é
 * lida no meio da revelação.
 *
 * O remédio é esperar a revelação terminar, uma vez, aqui — e não `.first()`
 * espalhado, que escolheria às cegas entre a cópia viva e a escondida.
 */
import { test as base, type Page } from "@playwright/test";

import { METODOS_DE_NAVEGACAO_REVELADOS } from "./revelacao-nas-cargas";

export * from "@playwright/test";
export { METODOS_DE_NAVEGACAO_REVELADOS };

/** Caixa do streaming que ainda não foi revelada. */
export const CAIXA_PENDENTE = 'div[hidden][id^="S:"]';

/**
 * Teto para a revelação. Ela leva centenas de milissegundos; quem estoura isto
 * não está atrasado, está órfão de verdade — o defeito que a #1374 temia.
 */
const TETO_DA_REVELACAO_MS = 15_000;

export async function esperarARevelacao(page: Page): Promise<void> {
  try {
    await page.waitForFunction((seletor) => document.querySelector(seletor) === null, CAIXA_PENDENTE, {
      polling: 50,
      timeout: TETO_DA_REVELACAO_MS,
    });
  } catch (erro) {
    throw new Error(
      `a caixa do streaming SSR (${CAIXA_PENDENTE}) não foi revelada em ${TETO_DA_REVELACAO_MS} ms ` +
        `depois da carga de ${page.url()} — caixa órfã de verdade (issue #1374).`,
      { cause: erro },
    );
  }
}

const comEspera = new WeakSet<Page>();

/**
 * ⚠️ A COBERTURA VIVE EM `METODOS_DE_NAVEGACAO_REVELADOS`, e é o que este
 * embrulho consome — a lista mora em `revelacao-nas-cargas.ts` porque é ela que
 * se prova. A #884 nasceu de um método de fora dela: `goBack`, que é como uma
 * spec "volta para a Agenda". Acrescentar aqui um método sem acrescentar na
 * lista continua sendo invisível para o `verify`, e o próximo `goBack` da
 * suíte volta a ler o documento no meio da revelação.
 */
function esperarARevelacaoNasCargas(page: Page): void {
  if (comEspera.has(page)) return;
  comEspera.add(page);

  for (const metodo of METODOS_DE_NAVEGACAO_REVELADOS) {
    const original = (page as unknown as Record<string, unknown>)[metodo];
    if (typeof original !== "function") continue;
    // `bind` antes de chamar, e não depois: o embrulho abaixo é lido no próximo
    // `esperarARevelacaoNasCargas`, e a página já guardada no `WeakSet` não
    // volta por aqui.
    const ligado = (original as (...args: unknown[]) => unknown).bind(page);
    (page as unknown as Record<string, unknown>)[metodo] = async (
      ...args: unknown[]
    ): Promise<unknown> => {
      const resposta = await ligado(...args);
      // `commit` pede de propósito a página antes de ela existir — esperar a
      // revelação ali seria esperar por uma caixa que ninguém vai fechar.
      // `goBack`/`goForward` não recebem opções; o guarda é sobre o ARGUMENTO
      // e não sobre o método, e por isso vale para os dois.
      const opcoes = args[args.length - 1];
      const pediuCommit =
        typeof opcoes === "object" && opcoes !== null && (opcoes as { waitUntil?: string }).waitUntil === "commit";
      if (!pediuCommit) await esperarARevelacao(page);
      return resposta;
    };
  }
}

export const test = base.extend({
  // Sem JavaScript os reveladores não rodam e a caixa fica por definição.
  context: async ({ context, javaScriptEnabled }, usar) => {
    if (javaScriptEnabled !== false) context.on("page", esperarARevelacaoNasCargas);
    await usar(context);
  },
  page: async ({ page, javaScriptEnabled }, usar) => {
    if (javaScriptEnabled !== false) esperarARevelacaoNasCargas(page);
    await usar(page);
  },
});
