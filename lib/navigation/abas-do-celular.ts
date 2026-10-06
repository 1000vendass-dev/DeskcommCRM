/**
 * AS ABAS DO CELULAR — a barra de baixo, no lugar do menu em gaveta.
 *
 * No telefone o menu lateral só existia escondido atrás do botão de três
 * linhas: para ir do Inbox ao funil eram dois toques e uma lista de vinte
 * portas. Quem atende pelo celular vive em três lugares (as conversas, o funil
 * e a agenda) e a barra de baixo põe os três a um toque, como nos apps de
 * mensagem que essa pessoa já usa o dia inteiro. O resto do produto continua
 * inteiro em "Mais", que abre o MESMO conteúdo do menu lateral — nenhuma porta
 * nova, nenhuma porta a menos.
 *
 * As regras moram aqui, e não no componente, porque são elas que podem estar
 * erradas sem que a tela mostre: qual aba acende em qual URL, e em quais telas
 * a barra sai do caminho.
 */

export type IdDaAba = "conversas" | "funil" | "agenda" | "mais";

export interface AbaDoCelular {
  id: Exclude<IdDaAba, "mais">;
  href: string;
  /** Chave do dicionário (o texto em português é a chave). */
  rotulo: string;
  /** Prefixos de URL que pertencem a esta aba, além do próprio `href`. */
  prefixos: readonly string[];
}

/**
 * Os destinos fixos. São `href` que JÁ existem no `NAV_CATALOG`
 * (`lib/navigation/catalogo.ts`): a barra é um atalho para portas que existem,
 * não uma porta nova — vigiado em `abas-do-celular.test.ts`.
 */
export const ABAS_DO_CELULAR: readonly AbaDoCelular[] = [
  { id: "conversas", href: "/app/inbox", rotulo: "Conversas", prefixos: ["/app/inbox"] },
  {
    id: "funil",
    href: "/app/kanban",
    rotulo: "Funis",
    // O quadro de um funil, a ficha do lead e o CRM são o mesmo lugar para
    // quem vende: abrir um card não pode apagar a aba de onde ele veio.
    prefixos: ["/app/kanban", "/app/pipelines", "/app/leads", "/app/crm"],
  },
  { id: "agenda", href: "/app/agenda", rotulo: "Agenda", prefixos: ["/app/agenda"] },
];

function casaPrefixo(pathname: string, prefixo: string): boolean {
  return pathname === prefixo || pathname.startsWith(`${prefixo}/`);
}

/**
 * Qual aba acende. Toda URL do app que não é de uma das três é de "Mais" —
 * Configurações, IA, Campanhas: é por "Mais" que se chegou lá.
 */
export function abaAtiva(pathname: string): IdDaAba {
  for (const aba of ABAS_DO_CELULAR) {
    if (aba.prefixos.some((p) => casaPrefixo(pathname, p))) return aba.id;
  }
  return "mais";
}

/**
 * A barra aparece? Some DENTRO de uma conversa, como no WhatsApp: ali a parte
 * de baixo da tela é do campo de escrever, e uma barra de abas embaixo dele
 * roubaria a altura de quem está digitando com o teclado aberto.
 *
 * A conversa aberta tem duas formas de URL, e as duas contam: o deep-link
 * `/app/inbox/<id>` e a seleção pela lista, que o Inbox grava como `?id=`
 * (`handleSelect` em `components/inbox/InboxLayout.tsx`).
 */
export function barraVisivel(pathname: string, idDaConversa: string | null): boolean {
  if (pathname.startsWith("/app/inbox/")) return false;
  if (pathname === "/app/inbox" && idDaConversa) return false;
  return true;
}
