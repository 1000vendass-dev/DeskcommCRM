---
impacto: nada_mudou
secao: alterado
titulo: O caso de aceite que passa pelo agente agora mede o par
---

A doutrina mandava provar pela tela, e era o que ela cobrava. Só que um caso
de aceite que atravessa um agente de IA não se prova com o verde do agente: em
setembro, na validação da v1.12.0, o caso `"quero 2 iphone 15"` passou por uma
bateria que o esperava reprovar — o agente perguntou se era o 128 ou o 256 — e a
ferramenta, medida direto com o mesmo texto, devolvia zero. O verde media o
modelo, não a ferramenta.

Agora todo caso de aceite que atravessa o agente vem **em par** com a medição
direta da ferramenta, com o mesmo texto cru, e só conta como prova quando os
dois lados concordam. A regra está escrita nos guias de aceite, no pré-voo e no
checklist da triagem, e um teste impede que ela suma sem ninguém ver.

Nada muda para quem opera a VPS: nenhuma tela, nenhum dado e nenhuma variável de
ambiente foi tocada.

Contribuição de @webtecnica (#489).
