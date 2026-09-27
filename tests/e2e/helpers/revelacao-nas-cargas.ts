/**
 * Quais métodos de navegação a espera da revelação DOVE envolver.
 *
 * ═══ O defeito que este arquivo existe para fechar (issue #884) ═════════════
 *
 * `tests/e2e/helpers/test.ts` embrulha `page.goto` e `page.reload` para que
 * só devolvam quando o streaming SSR terminou de revelar a página
 * (issue #1374). O cenário da #884 é, palavra por palavra, "depois de navegar
 * para a Agenda e voltar" — e "voltar" em Playwright é `page.goBack()`, que
 * NÃO era embrulhado. A spec que volta por ali lia o documento no meio da
 * revelação e o `getByTestId("tela-agenda")` casava com DOIS elementos
 * (`strict mode violation`), o vermelho INTERMITENTE do PR #873.
 *
 * A tela da Agenda não era a culpada: medida em jsdom, `AgendaClient` monta 1,
 * desmonta para 0 e remonta para 1. A cópia é a caixa do streaming SSR
 * (`<div hidden id="S:N">`) do servidor, que o React esvazia no cliente.
 *
 * ─── Por que uma LISTA, e não o embrulho em si ═════════════════════════════
 *
 * A lista é o que se prova, e o embrulho sai dela. A falha anterior foi a
 * mesma deste arquivo: a cobertura vivia espalhada dentro do `page.goto`, e a
 * cobertura esquecida (`goBack`) não tinha onde aparecer. Com a lista aqui, a
 * omissão de um método vira uma linha a mais nesta constante — e um teste que
 * a lê.
 *
 * ⚠️ `reload` e `goForward` entram pelo mesmo motivo de `goBack`: são navegação
 * de verdade, e uma spec que volta pela barra do navegador ou pelo botão
 * "avançar" tem o mesmo defeito. `goForward` não é usado hoje — e é por isso
 * que ele precisa entrar: a próxima spec que usar vai herdar a espera, em vez
 * de descobrir a lacuna.
 *
 * ⚠️ `setContent` NÃO entra: ele troca o documento inteiro e não produz caixa
 * de streaming. Incluí-lo seria uma espera que nunca passa, e um teste que
 * estufa a cobertura sem medir nada.
 */
export const METODOS_DE_NAVEGACAO_REVELADOS: readonly string[] = [
  "goto",
  "reload",
  "goBack",
  "goForward",
];
