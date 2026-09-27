---
impacto: nada_mudou
secao: corrigido
titulo: O inbox não abre mais barra de rolagem lateral com texto longo na memória do contato
---

Um fato durável registrado em "Memória do contato" (painel lateral da conversa)
com uma URL ou chave longa, sem espaços, largava a coluna do painel. Como aquela
é a **última coluna** do grid do inbox, o que estourava nela estourava a página
inteira — quem atendia precisava de `Shift + Scroll` para voltar à conversa.

São duas camadas, e as duas estavam sem proteção:

- o texto do fato usava `whitespace-pre-wrap` sem quebra forçada, e
- o wrapper da coluna do CRM não tinha `min-w-0`, ao contrário da coluna da
  conversa, que ganhou o seu no conserto anterior (v1.46.0).

Um teste novo com três réguas prende as duas: quebra forçada em todo
`whitespace-pre-wrap` do inbox, `wrap-anywhere` no fato, e `min-w-0` na coluna.
Nenhuma tela mudou de estrutura e nenhuma configuração pede ação.

Refs #1802
