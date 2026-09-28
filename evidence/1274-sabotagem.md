# 1274 — SABOTAGEM PREVISTA, escrita ANTES do fix

Escopo: filtro por VÁRIAS etiquetas (E/OU) nas três listas (Inbox, Funil, Contatos),
com `?tag=` singular preservado.

Data da escrita: **antes** de qualquer linha do fix. Regra do time: uma previsão escrita
depois do verde é racionalização, não prova.

## As seis sabotagens, e o que CADA uma tem de reprovar

| # | Sabotagem | Teste que tem de ficar VERMELHO | Por que este teste é o certo |
|---|---|---|---|
| S1 | Apagar o ramo `modo === "ou"` e deixar o E cair no caminho de OU (bug de copy-paste) | `tests/unit/filtro-multi-etiqueta.test.ts` → caso "OU com duas etiquetas" | E e OU com DUAS etiquetas produzem o MESMO `or=(tags.cs.{a},tags_do_contato.cs.{a},…)` byte a byte quando o ramo se perde. A diferença só aparece no OPERADOR (`ov` vs `cs`) e no TERMO ÚNICO da disjunção. Só um teste que compara as DUAS formas byte a byte pega. |
| S2 | Trocar `tags.cs.{a,b},tags_do_contato.cs.{a,b}` por `tags.cs.{a},tags.cs.{b},tags_do_contato…` no modo E | mesmo arquivo → caso "E com duas etiquetas" | O `cs` de um valor só cada é OU; "vip E orçamento" viraria "vip OU orçamento" e a lista cresceria. O teste afirma o LITERAL do array com as duas etiquetas em cada caixa. |
| S3 | Deletar a linha `modo` do `_handler.ts` (`aplicarMarcadores(query, q.tag, q.modo)`) | `tests/unit/filtro-multi-etiqueta.test.ts` → caso "o handler aplica o modo que veio da URL" | `modo` tem Default (`"e"`), então TypeScript NÃO reclama de omitir: a assinatura continua válida e a UI escolher "OU" simplesmente filtraria por E, sem erro. Só um teste que passa `modo: "ou"` ao handler e compara o `or=` emitido pega. |
| S4 | Voltar o schema a `tag: conversationTagSchema.optional()` (sem `string[]`) | mesmo arquivo → caso "o schema aceita `?tag=vip&tag=orçamento`" | Com o schema singular, `getAll` devolve array e o `safeParse` RECUSA com 422: a tela de multi-seletor ficaria vermelha na cara do operador. O teste passa o array ao schema e afirma que passa. |
| S5 | Trocar a compatibilidade do `?tag=` singular: fazer o caminho de TAMANHO 1 passar pelo plural e produzir `cs.{vip}` por outro caminho | mesmo arquivo → caso "`?tag=vip` continua byte a byte o `or=` de antes" + `tests/unit/inbox-filtro-de-tag-le-as-duas-caixas.test.ts` (já existente) | O singularity é o CONTRATO de hoje (link salvo, aba aberta, chamada de API). A regressão é silenciosa: a lista volta quase toda, porque `cs.{vip}` e `ov.{vip}` casam a mesma conversa — o sintoma é "o filtro parou de filtrar", e nenhum teste de contagem nota. O teste afirma IGUALDADE BYTE A BYTE com a forma singular de sempre. |
| S6 | No Funil, deixar `applyFilters` casando `cardTemMarcadores` com a lista INTEIRA em vez do modo (ou seja, ignorar `tagMode`) | `tests/unit/filtro-multi-etiqueta.test.ts` → caso "funil: E e OU dão listas diferentes" + `tests/unit/funil-filtro-de-tag-le-as-duas-caixas.test.ts` (existente) | O funil filtra no CLIENTE, sem erro e sem 422: a diferença entre E e OU é só o TAMANHO da lista, e ninguém lê o sintoma. Comparar as duas listas com o MESMO conjunto de leads é o que torna isso vermelho. |

## O que NÃO é sabotagem (e por quê não entra na lista)

- **Migration nova.** A #1274 não pede coluna: o filtro é sobre `conversations.tags` (0033) e
  o campo calculado `tags_do_contato` (0323), que já aceitam "contém todos" e "sobrepõe".
  Uma migration aqui seria mudança de schema sem pedido — proibido pelo escopo desta fatia.
- **Mixing de caixas** ("vip na conversa E orçamento no contato"). A issue registra isso
  como decisão de produto pendente, e é a razão de o E ser "mesma caixa". Sabotar isso
  seria implementar o que a issue NÃO pediu.
- **Teto de 20 etiquetas.** Acima de 20 nenhum marcador escrito hoje seria filtrável
  (é o mesmo teto de `conversationTagsSchema`), então o limite não tira nada de quem filtra.

## Como cada uma é executada

Cada linha é aplicada com `git stash` em cima do commit, roda-se o arquivo de teste
alvo por `dk-heavy.sh`, e o resultado é colado abaixo. Sem o medido, a tabela acima é
apenas uma intenção — e uma intenção não é prova de cobertura.

## RESULTADO MEDIDO

(preenchido depois de rodar — ver final deste arquivo)
