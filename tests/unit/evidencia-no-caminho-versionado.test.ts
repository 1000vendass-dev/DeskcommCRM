/**
 * A doutrina apontava a evidência para um caminho que o `git` ignora.
 *
 * `CLAUDE.md` mandava gravar em `.superpowers/evidence/` e o `.gitignore`
 * (linhas 120 e 140) ignora `.superpowers/` inteiro. Consequência medida: toda
 * prova visual produzida seguindo a doutrina **era invisível para qualquer outro
 * clone** — existia no disco de quem gravou e em mais lugar nenhum. É o item 1
 * do #533, e é passe 10 da triagem: cobrar de um contribuidor algo que a nossa
 * própria documentação mandou fazer errado.
 *
 * Enquanto isso existe `evidence/` na raiz, versionado, com 739 arquivos
 * entregues, e o `moeda-da-organizacao.spec.ts` já carrega o comentário que
 * explica o porquê em quatro linhas. A decisão já estava TOMADA no código; só a
 * doutrina ainda mandava o outro caminho.
 *
 * ── Por que este gate é uma CATRACA e não um relatório ──────────────────────
 *
 * O sintoma (`CLAUDE.md` mentindo) é visível a olho. O que este arquivo prende é
 * a **volta**: a mesma linha reescrita, ou uma spec nova copiando o padrão do
 * vizinho, e a prova invisível recomeça. A varredura é do DISCO (`git grep` com
 * `--untracked`), não do índice, porque spec nova ainda sem `git add` é
 * exatamente o que um gate por `git ls-files` não enxergaria.
 *
 * ── A dívida é do REPOSITÓRIO, e é enumerada ────────────────────────────────
 *
 * Sobravam 71 arquivos citando o caminho, em quatro famílias que este PR não
 * toca, cada uma com dono distinto:
 *
 *  - `HANDOFF-*.md`, `docs/handoffs/`, `docs/superpowers/plans/`, `docs/audits/`:
 *    registro histórico. Reescrever o passado faz o documento MENTIR — o day
 *    one gravou onde gravou, e a prova daquele dia não existe mais.
 *  - `experiments/extensoes/` + `docs/research/extensoes/`: bancada de
 *    laboratório efêmera, deliberadamente fora do versionamento.
 *  - `evidence/**`: artefato de medição gravado por máquina.
 *  - `docs/superpowers/specs/`: plano de uma entrega já executada.
 *
 * A lista é EXAUSTIVA por arquivo, nunca por padrão — perdão por diretório
 * esconderia o arquivo novo dentro dele, que é o defeito que este gate existe
 * para pegar. E ela não APODRECE: o caso "a quarentena não guarda arquivo que
 * saiu da cobertura" exige que o item ainda exista E ainda cite o caminho, então
 * consertar tira a exceção de graça (ou deixa o vermelho demanding remoção).
 */
import { execFileSync } from "node:child_process";

import { describe, expect, it } from "vitest";

const RAIZ = process.cwd();

/** O caminho proibido, escrito uma vez para o teste inteiro citar. */
const CAMINHO = [".superpowers", "evidence"].join("/");

/**
 * Arquivos que a varredura considera — documento, doutrina, spec, script.
 *
 * `evidence/` fica de fora por uma razão que é o próprio tema do gate: ali mora
 * **artefato de medição** (`.json` com o path de origem da captura, `README.md` de
 * índice), e essa escrita é REGISTRO do que foi gravado, não INSTRUÇÃO do que
 * gravar. Incluí-la faria o gate reprovar o próprio lastro que ele manda
 * produzir. O folder de entrega (`evidence/`) continua varrido de outro jeito:
 * `evidencia-citada.test.ts` cobra que a imagem citada exista no `git`.
 *
 * `.gitignore` também fica de fora, e é o único arquivo do repo que **precisa**
 * citar o caminho: é a lista do que ele ignora.
 */
const EH_ARQUIVO_DE_CONTEUDO = /\.(?:md|mdx|ts|tsx|mts|mjs|cjs|js|json|ya?ml|sh)$/i;

/**
 * O `.gitignore` é a FONTE da verdade do que é invisível. O gate pergunta a ele,
 * em vez de repetir a lista de ignorados: se um dia `.superpowers/` deixar de ser
 * ignorado, este gate fica verde sozinho e o motivo do conserto desaparece do
 * ar — que é o resultado correto, e não uma falha de instrumento.
 */
function ignoradoPorGit(caminho: string): boolean {
  try {
    execFileSync("git", ["check-ignore", "-q", "--", caminho], { cwd: RAIZ });
    return true;
  } catch (e) {
    // `check-ignore` sai 1 para "NÃO ignorado" — a resposta boa. Qualquer outro
    // código é o instrumento quebrado, e ele precisa gritar: um catch que
    // devolvesse `false` daria verde com a varredura morta.
    const err = e as { status?: number; stderr?: string };
    if (err.status === 1) return false;
    throw new Error(`git check-ignore saiu ${err.status}: ${err.stderr ?? ""}`);
  }
}

/**
 * TODOS os arquivos com a menção, versionados OU não.
 *
 * `grep -r` (minúsculo) não desce por symlink de diretório, o que mantém
 * `node_modules` e as árvores vizinhas fora do caminho mesmo quando são link.
 * `-l` devolve o nome uma vez, sem linha; quem quer a contagem de ocorrências
 * usa `contagens()`, abaixo.
 *
 * Sai de `.` e não de uma lista de pastas: gate que varre diretório escolhido
 * varre o que o autor lembrou, e arquivo novo em pasta que ele não lembrou
 * passa em silêncio. Os `--exclude-dir` são só o ruído conhecido (build,
 * dependências, e `evidence/` pela razão do cabeçalho).
 */
function arquivosComAMencao(): string[] {
  const exclui = [
    ".git",
    "node_modules",
    ".next",
    "dist",
    "coverage",
    "playwright-report",
    "test-results",
    "evidence",
    //(worktrees aninhados de outras sessões: têm o gate delas próprio)
    ".claude/worktrees",
  ].map((d) => `--exclude-dir=${d}`);

  let saida = "";
  try {
    saida = execFileSync("grep", ["-rlF", `--exclude=.gitignore`, CAMINHO, ".", ...exclui], {
      cwd: RAIZ,
      encoding: "utf8",
      maxBuffer: 16 * 1024 * 1024,
    });
  } catch (e) {
    // grep sai 1 quando não casa nada — que aqui é o resultado bom.
    const err = e as { status?: number; stderr?: string };
    if (err.status !== 1) {
      throw new Error(`a varredura do caminho de evidência não rodou (grep saiu ${err.status}): ${err.stderr ?? ""}`);
    }
  }
  return saida
    .split("\n")
    .filter(Boolean)
    .map((l) => l.replace(/^\.\//, ""))
    .sort();
}

/**
 * DÍVIDA PRÉ-EXISTENTE, enumerada arquivo a arquivo.
 *
 * Publicar o portão duro contra todos quebraria a suíte de todo mundo por dívida
 * que não é de quem está entregando. Excluir em silêncio seria a lista arbitrária
 * que o próprio `evidencia-citada.test.ts` já reprovou uma vez. A saída é
 * quarentena VISÍVEL e CONTÁVEL, com dono declarado em cada família.
 *
 * ⚠️ A lista só pode ENCOLHER. Item novo entra com o motivo escrito junto; item
 * corrigido sai, e o caso de apodrecimento abaixo cobra a saída.
 */
const QUARENTENA = new Set([
  // ── Registro histórico: reescrever faria o documento MENTIR sobre o dia ────
  "HANDOFF-harness-evolution.md",
  "HANDOFF-ia-360.md",
  "HANDOFF-operacao-visivel.md",
  "docs/audits/2026-08-14-afirmacoes-de-estado.md",
  "docs/handoffs/HANDOFF-canais-oficial.md",
  "docs/handoffs/HANDOFF-inbox-multimodal.md",
  "docs/superpowers/handoffs/2026-07-17-webhooks.md",
  "docs/testing/HANDOFF-vps-qa.md",
  "docs/superpowers/plans/2026-07-21-onda0-fundacao-midia.md",
  "docs/superpowers/plans/2026-07-21-onda1-midia-na-ui.md",
  "docs/superpowers/plans/2026-07-21-onda2-composer-whatsapp.md",
  "docs/superpowers/plans/2026-07-22-onda3-agente-multimodal.md",
  "docs/superpowers/plans/2026-07-22-onda4-split-mensagens.md",
  "docs/superpowers/plans/2026-07-22-onda5-templates-vendedor.md",
  "docs/superpowers/plans/2026-07-28-atualizar-versao-na-ui.md",
  "docs/superpowers/plans/2026-08-03-gestao-funis.md",
  "docs/superpowers/plans/2026-08-03-navegacao-agrupada.md",
  "docs/superpowers/specs/2026-07-28-atualizar-versao-na-ui-design.md",
  "docs/superpowers/specs/2026-08-03-gestao-funis-design.md",
  // ── Bancada de laboratório efêmera, fora do versionamento por desenho ─────
  "docs/research/extensoes/04-bancada-executor.md",
  "docs/research/extensoes/05-bancada-eventos.md",
  "docs/research/extensoes/06-bancada-estado-e-dados.md",
  "docs/research/extensoes/07-perfil-comparacao-executor.md",
  "experiments/extensoes/README.md",
  "experiments/extensoes/common.test.mjs",
  "experiments/extensoes/console-process.test.mjs",
  "experiments/extensoes/console.spec.mjs",
  "experiments/extensoes/playwright.config.mjs",
  "experiments/extensoes/runtime/container/quotas.mjs",
  "experiments/extensoes/runtime/container/runner.mjs",
  "experiments/extensoes/runtime/verify.mjs",
  "experiments/extensoes/runtime/workspace.test.mjs",
  // ── Instrumento que já aponta para o caminho certo e só EXPLICA o errado ──
  // A prosa deste script contrasta `evidence/` com `evidence/` para
  // dizer por que grava onde grava. É menção que DOCUMENTA a decisão, análoga à
  // prosa legítima que o `namespace-das-imagens.test.ts` permite.
  "scripts/evidencia-webhooks.ts",
  // ── Os dois specs que JÁ gravam em `evidence/` e nomeiam o outro caminho ──
  // para explicar a escolha. O mesmo comentário vale nos dois; em
  // `moeda-da-organizacao.spec.ts` ele é a explicação de quatro linhas do porquê.
  "tests/e2e/capacidades-do-agente.spec.ts",
  "tests/e2e/moeda-da-organizacao.spec.ts",
  // ── Este arquivo: o próprio nome do caminho, nas asserções e nas mensagens ──
  "tests/unit/evidencia-no-caminho-versionado.test.ts",
  // ── `CLAUDE.md` e o mapa de jornadas: doutrina com dono em PR próprio ─────
  // A linha que manda o caminho errado é a raiz do defeito, e vive em arquivo de
  // instrução do agente: editá-la depende de aprovação que está fora do meu
  // escopo, então ela vai em PR próprio, com este gate já publicado para
  // reprovar qualquer volta enquanto isso.
  "CLAUDE.md",
  "docs/testing/user-journey-map.md",
  "docs/interface-por-vinculo.md",
  "triagem/TRIAGEM.md",
]);

/** Ocorrências por arquivo, para a mensagem de falha dizer o tamanho do estrago. */
function contagens(): Map<string, number> {
  const out = new Map<string, number>();
  for (const arq of arquivosComAMencao()) {
    let n = 0;
    try {
      n = Number(execFileSync("grep", ["-coF", CAMINHO, arq], { cwd: RAIZ, encoding: "utf8" }).trim());
    } catch {
      n = -1; // o arquivo sumiu entre a varredura e a contagem: o caso abaixo acusa
    }
    out.set(arq, n);
  }
  return out;
}

describe("a evidência visual vai para o caminho que o git entrega", () => {
  it("o caminho que este gate proíbe continua ignorado — senão a regra virou falso alarme", () => {
    // O CONTROLE DO INSTRUMENTO, e a dependência real do gate. Se um dia
    // `.superpowers/` deixar de estar no `.gitignore`, todo o defeito que este
    // PR conserta já não existe: a prova passa a ser versionada e a doutrina
    // volta a estar certa. Ficar vermelho nesse dia seria cobrar a correção de
    // um problema que não existe mais.
    expect(
      ignoradoPorGit(`${CAMINHO}/qualquer-coisa.png`),
      `${CAMINHO} deixou de ser ignorado pelo git — a prova visual passa a ser ` +
        "versionada e este gate inteiro perde o assunto. Apague-o e " +
        "descreva no CLAUDE.md o que o substituiu.",
    ).toBe(true);
  });

  it("a varredura enxerga o caminho onde ele está — senão o silêncio não vale nada", () => {
    // Sem este caso, um `grep` que devolvesse vazio por qualquer motivo (flag
    // errada, cwd errado, padrão quebrado) leria como "ninguém aponta para lá",
    // que é o verde que não mede nada.
    const alvo = "tests/unit/evidencia-no-caminho-versionado.test.ts";
    const saida = execFileSync("grep", ["-rlF", CAMINHO, alvo], { cwd: RAIZ, encoding: "utf8" });
    expect(saida.trim()).toBe(alvo);
  });

  it("nenhuma superfície de doutrina ou de escrita aponta para o caminho ignorado", () => {
    const contagem = contagens();
    const infratores = [...contagem.entries()]
      .filter(([arq]) => !QUARENTENA.has(arq))
      .filter(([arq]) => EH_ARQUIVO_DE_CONTEUDO.test(arq))
      .sort();

    expect(
      infratores.map(([arq, n]) => `  ${arq} (${n}×)`),
      "estes arquivos apontam para um caminho que o .gitignore ignora — quem clonar " +
        `recebe o vazio. Grave em evidence/ (versionado, subpasta por entrega):\n${infratores.map(([arq]) => `  ${arq}`).join("\n")}`,
    ).toEqual([]);
  });

  it("a quarentena não guarda arquivo que saiu da cobertura", () => {
    // O anti-apodrecimento. Se um item da quarentena for corrigido (ou o arquivo
    // sumir), a exceção sobreviveria ao motivo que a criou e ninguém perceberia:
    // a lista vira permissão permanente, que é o oposto de um gate.
    const alcancados = new Set(arquivosComAMencao());
    const fantasmas = [...QUARENTENA].filter((d) => !alcancados.has(d));
    expect(
      fantasmas,
      "estes estão em QUARENTENA e não são mais alcançados pela varredura — REMOVA-OS:\n" +
        fantasmas.map((f) => `  ${f}`).join("\n"),
    ).toEqual([]);
  });

  it("a quarentena é feita de arquivo versionado, não de padrão solto", () => {
    // Perdão por diretório esconderia o ARQUIVO NOVO dentro dele — que é o
    // defeito que este gate existe para pegar. Cada item é conferido aqui como
    // caminho exato e relativo à raiz, para o perdão valer só para ele.
    const naoVersionados = [...QUARENTENA].filter((d) => {
      try {
        execFileSync("git", ["ls-files", "--error-unmatch", "--", d], { cwd: RAIZ, stdio: "pipe" });
        return false;
      } catch {
        return true;
      }
    });
    expect(
      naoVersionados,
      "a quarentena aponta para arquivo que o git não versiona:\n" +
        naoVersionados.map((f) => `  ${f}`).join("\n"),
    ).toEqual([]);
  });
});
