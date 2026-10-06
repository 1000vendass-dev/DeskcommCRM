/**
 * A BARRA DE ABAS DO CELULAR, provada pela tela.
 *
 * O que esta spec mede, e por que pela tela e não por unidade:
 *   - no celular a barra aparece, leva aos três destinos e "Mais" abre o menu
 *     inteiro — nenhuma porta do produto fica para trás;
 *   - a barra some dentro de uma conversa aberta, para o campo de escrever ter
 *     a parte de baixo da tela;
 *   - o `<main>` reserva a altura dela (contrato do rodapé), e o conteúdo não
 *     fica escondido atrás da barra;
 *   - no desktop ela não aparece e não reserva nada.
 *
 * As regras puras (qual aba acende, quando a barra some) estão em
 * `lib/navigation/abas-do-celular.test.ts`; aqui é o que a pessoa vê.
 *
 * Pré-requisito: `.e2e-creds.json` (gerado por scripts/seed-e2e-credentials.ts).
 */
import { mkdirSync } from "node:fs";
import * as path from "node:path";

import { test, expect, type Page } from "./helpers/test";
import { lerCreds } from "./helpers/login-admin";

const creds = lerCreds();
const EVIDENCE = path.join(process.cwd(), "evidence", "fuzil-abas-do-celular");
mkdirSync(EVIDENCE, { recursive: true });

const CELULAR = { width: 390, height: 844 };

async function entrar(page: Page): Promise<void> {
  // `agent` e não `admin`: é quem atende pelo telefone, e não passa pelo MFA.
  await page.goto("/login");
  await page.locator("#email").fill(creds.users.agent!.email);
  await page.locator("#password").fill(creds.password);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await page.waitForURL(/\/app\//);
}

const barra = (page: Page) => page.getByRole("navigation", { name: "Navegação do app" });

test.describe("abas do celular", () => {
  test("no celular: abas levam aos destinos, Mais abre o menu, e a conversa esconde a barra", async ({ page }) => {
    await page.setViewportSize(CELULAR);
    await entrar(page);

    await page.goto("/app/inbox");
    await expect(barra(page)).toBeVisible();
    await expect(barra(page).getByRole("link", { name: "Conversas" })).toHaveAttribute("aria-current", "page");
    await page.screenshot({ path: path.join(EVIDENCE, "01-conversas-390.png") });

    // O conteúdo não pode ficar por trás da barra: o `<main>` reserva a altura dela.
    const caixaDaBarra = await barra(page).boundingBox();
    expect(caixaDaBarra?.height ?? 0).toBeGreaterThanOrEqual(56);
    const reserva = Number(await page.locator("main").getAttribute("data-rodape-ocupado"));
    expect(reserva).toBeGreaterThanOrEqual(56);

    await barra(page).getByRole("link", { name: "Funis" }).click();
    await page.waitForURL(/\/app\/kanban/);
    await expect(barra(page).getByRole("link", { name: "Funis" })).toHaveAttribute("aria-current", "page");
    await page.screenshot({ path: path.join(EVIDENCE, "02-funis-390.png") });

    await barra(page).getByRole("link", { name: "Agenda" }).click();
    await page.waitForURL(/\/app\/agenda/);
    await page.screenshot({ path: path.join(EVIDENCE, "03-agenda-390.png") });

    await barra(page).getByRole("button", { name: "Mais" }).click();
    const menu = page.getByRole("navigation", { name: "Navegação principal" });
    await expect(menu).toBeVisible();
    await page.screenshot({ path: path.join(EVIDENCE, "04-mais-390.png") });
    await page.keyboard.press("Escape");
    await expect(menu).toHaveCount(0);

    // Conversa aberta (a seleção pela lista grava `?id=`): a barra sai do caminho.
    await page.goto("/app/inbox?id=00000000-0000-4000-8000-000000000000");
    await expect(page.getByRole("button", { name: "Conversas" })).toBeVisible();
    await expect(barra(page)).toHaveCount(0);
    await page.screenshot({ path: path.join(EVIDENCE, "05-conversa-aberta-390.png") });

    // Voltar para a lista traz a barra de volta.
    await page.getByRole("button", { name: "Conversas" }).click();
    await expect(barra(page)).toBeVisible();
  });

  test("no desktop a barra não aparece nem reserva espaço", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await entrar(page);
    await page.goto("/app/inbox");
    await expect(barra(page)).toBeHidden();
    await expect(page.locator("main")).toHaveAttribute("data-rodape-ocupado", "0");
  });
});
