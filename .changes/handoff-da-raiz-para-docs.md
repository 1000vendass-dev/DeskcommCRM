---
impacto: nada_mudou
secao: alterado
titulo: Os 12 HANDOFF da raiz foram para docs/handoffs/ e um gate impede a volta
---

A raiz do repositório tinha 12 arquivos `HANDOFF*.md` — o diário de épicos
encerrados ao lado do código do produto. Quatro deles carregavam identificador
de produção (JID e LID de conversa, UUID de organização, e-mail de pessoa
física, referência de projeto e IP de VPS) num repositório público. O valor foi
trocado por rótulo; o formato sobreviveu, porque é o que mantém o defeito e a
reprodução legíveis.

A regra antiga — "épico vivo mantém o handoff na raiz" — não segurava: a lista
da convenção citava 3 dos 12. Ela saiu do `docs/index.md` e no lugar ficou um
teste que reprova `HANDOFF*` na raiz **e** identificador de produção nos
arquivos arquivados. É a primeira vez que um conserto de documentação ganha
gate: item de doutrina envelhece, teste reprova.

Nada muda para quem opera a instalação. O operador não achava handoff na raiz,
e a pasta de destino já existia.
