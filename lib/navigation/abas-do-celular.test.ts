import { describe, expect, it } from "vitest";

import { NAV_CATALOG } from "./catalogo";
import { ABAS_DO_CELULAR, abaAtiva, barraVisivel } from "./abas-do-celular";

describe("abas do celular", () => {
  it("toda aba aponta para uma porta que já existe no catálogo", () => {
    const hrefs = new Set<string>(NAV_CATALOG.map((d) => d.href));
    for (const aba of ABAS_DO_CELULAR) expect(hrefs.has(aba.href), aba.href).toBe(true);
  });

  it("acende a aba da seção, inclusive nas telas de dentro dela", () => {
    expect(abaAtiva("/app/inbox")).toBe("conversas");
    expect(abaAtiva("/app/kanban")).toBe("funil");
    expect(abaAtiva("/app/pipelines/abc")).toBe("funil");
    expect(abaAtiva("/app/leads/abc")).toBe("funil");
    expect(abaAtiva("/app/agenda")).toBe("agenda");
  });

  it("o que não é das três é de Mais, e prefixo parecido não engana", () => {
    expect(abaAtiva("/app/settings")).toBe("mais");
    expect(abaAtiva("/app/ai/agents")).toBe("mais");
    expect(abaAtiva("/app/inboxes")).toBe("mais");
  });

  it("some dentro de uma conversa aberta, pelas duas formas de URL", () => {
    expect(barraVisivel("/app/inbox", null)).toBe(true);
    expect(barraVisivel("/app/inbox", "c1")).toBe(false);
    expect(barraVisivel("/app/inbox/c1", null)).toBe(false);
    // `?id=` só significa conversa aberta no Inbox.
    expect(barraVisivel("/app/kanban", "x")).toBe(true);
  });
});
