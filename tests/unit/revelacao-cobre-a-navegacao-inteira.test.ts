/**
 * A ESPERA DA REVELAÇÃO COBRE TODOA NAVEGAÇÃO — e o sintoma da #884 é nominal.
 *
 * ═══ O defeito ══════════════════════════════════════════════════════════════
 *
 * O sintoma reportado na #884 é: "depois de navegar para a Agenda e voltar, o
 * DOM fica com uma segunda cópia oculta de `tela-agenda`", e o `getByTestId`
 * passa a casar dois. A tela da Agenda foi absolvida por MEDIÇÃO, e este
 * arquivo registra como:
 *
 *   · jsdom, `AgendaClient` real, montar → `unmount()` → remontar:
 *     **1 → 0 → 1**. Nenhum componente da Agenda monta sem desmontar;
 *   · nenhum `Activity`/`unstable_Activity`/`keep-alive`/`Offscreen` no app,
 *     nenhuma rota paralela ou interceptada sob `/app/agenda`, e o `AppShell`
 *     renderiza `{children}` uma vez.
 *
 * A cópia é a **caixa do streaming SSR** (`<div hidden id="S:N">`) que o
 * servidor manda e o React esvazia no cliente — já descrita na issue #1374,
 * cujo conserto (PR #1706) entrou em 2026-09-26, Onze dias depois de a #884.
 *
 * ─── O buraco que sobrou, e que este arquivo fecha ══════════════════════════
 *
 * O `test` da suíte embrulha `page.goto` e `page.reload` para só devolverem
 * quando a revelação termina. "Voltar para a Agenda", na #884, é `page.goBack()`
 * — que NÃO era embrulhado. Quem voltava por ali lia o documento no meio da
 * revelação e era aí que o `tela-agenda` virava dois.
 *
 * ⚠️ O PORQUÊ DE UM TESTE DE HARNESS E NÃO DE e2e. A cerca que existia
 * (`e2e-specs-usam-o-test-da-suite.test.ts`) só confere o IMPORT da spec — foi
 * por isso que a lacune de `goBack` passou. Um e2e aqui exigiria navegador,
 * banco e duas contas para provar uma propriedade que é uma lista de nomes. O
 * que se prova aqui é a COBERTURA, e ela é o que quebrou.
 *
 * ⚠️ O dublê não é uma página de verdade. Ele existe para observar QUANTAS vezes
 * a espera foi exigida e se veio DEPOIS da navegação — as duas propriedades que
 * o embrulho promete. A revelação em página de verdade é de `goBack` na browser;
 * o dublê prova a ligação, e a spec `buffer-ssr-caixa-orfa` continua sendo a
 * que mede o streaming de fato.
 */
import { describe, expect, it } from "vitest";

import { METODOS_DE_NAVEGACAO_REVELADOS } from "../e2e/helpers/revelacao-nas-cargas";

type Ouvinte = (...args: unknown[]) => unknown;

/** O que o dublê registra: quantas vezes a espera foi pedida, e quando. */
class PaginaFalsa {
  /** Ordem dos eventos, para provar que a espera vem DEPOIS da navegação. */
  readonly registro: string[] = [];
  /** Quantas vezes a espera foi cobrada. */
  esperas = 0;

  private espera(): void {
    this.esperas += 1;
    this.registro.push("espera");
  }

  async goto(url: string, opcoes?: { waitUntil?: string }): Promise<{ url: string }> {
    void opcoes;
    this.registro.push(`goto:${url}`);
    return { url };
  }

  async reload(opcoes?: { waitUntil?: string }): Promise<{ url: string }> {
    void opcoes;
    this.registro.push("reload");
    return { url: "" };
  }

  async goBack(): Promise<{ url: string }> {
    this.registro.push("goBack");
    return { url: "" };
  }

  async goForward(): Promise<{ url: string }> {
    this.registro.push("goForward");
    return { url: "" };
  }

  /** A espera que o embrulho do `test` da suíte chama por fora. */
  esperando(): void {
    this.espera();
  }

  comoFuncao(metodo: string): (this: PaginaFalsa, ...args: never[]) => Promise<unknown> {
    return (this as unknown as Record<string, Ouvinte>)[metodo] as never;
  }
}

/**
 * O embrulho do `test` da suíte, em função pura — a MESMA forma de
 * `esperarARevelacaoNasCargas`, com a espera injetada. Ela existe aqui para que
 * a sabotagem possa virar só a LISTA, sem precisar reeditar o helper: a prova
 * é que a lista manda, e não o texto do embrulho.
 */
function embrulhar(alvo: PaginaFalsa, metodos: readonly string[]): void {
  for (const metodo of metodos) {
    const original = (alvo as unknown as Record<string, unknown>)[metodo];
    if (typeof original !== "function") continue;
    const ligado = (original as (...args: unknown[]) => unknown).bind(alvo);
    (alvo as unknown as Record<string, unknown>)[metodo] = async (...args: unknown[]): Promise<unknown> => {
      const resposta = await ligado(...args);
      const opcoes = args[args.length - 1];
      const pediuCommit =
        typeof opcoes === "object" &&
        opcoes !== null &&
        (opcoes as { waitUntil?: string }).waitUntil === "commit";
      if (!pediuCommit) alvo.esperando();
      return resposta;
    };
  }
}

describe("a espera da revelação cobre toda a navegação (issue #884)", () => {
  it("a lista nomeia goto, reload, goBack e goForward — nenhum método de fora", () => {
    expect([...METODOS_DE_NAVEGACAO_REVELADOS].sort()).toEqual([
      "goBack",
      "goForward",
      "goto",
      "reload",
    ]);
  });

  it("goBack espera a revelação — é por ele que uma spec 'volta para a Agenda'", () => {
    const pagina = new PaginaFalsa();
    embrulhar(pagina, METODOS_DE_NAVEGACAO_REVELADOS);
    return pagina.goBack().then(() => {
      expect(pagina.esperas).toBe(1);
      expect(pagina.registro).toEqual(["goBack", "espera"]);
    });
  });

  it("goForward espera a revelação", () => {
    const pagina = new PaginaFalsa();
    embrulhar(pagina, METODOS_DE_NAVEGACAO_REVELADOS);
    return pagina.goForward().then(() => {
      expect(pagina.esperas).toBe(1);
    });
  });

  it("goto espera a revelação", () => {
    const pagina = new PaginaFalsa();
    embrulhar(pagina, METODOS_DE_NAVEGACAO_REVELADOS);
    return pagina.goto("/app/agenda").then(() => {
      expect(pagina.esperas).toBe(1);
    });
  });

  it("reload espera a revelação", () => {
    const pagina = new PaginaFalsa();
    embrulhar(pagina, METODOS_DE_NAVEGACAO_REVELADOS);
    return pagina.reload().then(() => {
      expect(pagina.esperas).toBe(1);
    });
  });

  it("a espera vem DEPOIS da navegação, nunca antes", () => {
    const pagina = new PaginaFalsa();
    embrulhar(pagina, METODOS_DE_NAVEGACAO_REVELADOS);
    return pagina.goBack().then(() => {
      expect(pagina.registro.indexOf("goBack")).toBeLessThan(pagina.registro.indexOf("espera"));
    });
  });

  it("waitUntil: commit não espera — a caixa não existe ainda", () => {
    const pagina = new PaginaFalsa();
    embrulhar(pagina, METODOS_DE_NAVEGACAO_REVELADOS);
    return pagina.goto("/app/agenda", { waitUntil: "commit" }).then(() => {
      expect(pagina.esperas).toBe(0);
    });
  });

  it("a volta de ida e volta cobre os DOIS sentidos da pilha de navegação", () => {
    const pagina = new PaginaFalsa();
    embrulhar(pagina, METODOS_DE_NAVEGACAO_REVELADOS);
    return pagina
      .goForward()
      .then(() => pagina.goBack())
      .then(() => {
        expect(pagina.esperas).toBe(2);
        expect(pagina.registro).toEqual(["goForward", "espera", "goBack", "espera"]);
      });
  });
});
