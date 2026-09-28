---
impacto: capacidade_nova
secao: adicionado
titulo: Relatório por etiqueta — volume, espera e desfecho de cada assunto no período
---

Quem opera agora pode perguntar à API **qual assunto ocupou a operação em um período, e quanto tempo o cliente esperou**: `GET /api/v1/reports/tags` devolve, para cada etiqueta em uso, quantas conversas chegaram, quantas estão em aberto e quantas encerraram, a espera média pela nossa resposta e a fatia de cada uma sobre o total. A lista de etiquetas vem das que realmente existem nas conversas, então uma etiqueta sem conversa no período aparece com zero em vez de sumir da lista, e um período sem dado nenhum diz isso na cara em vez de devolver uma tabela de zeros. O pedido aceita `de`, `ate` (até 90 dias) e `tz`, porque a janela é contada no fuso de quem lê; com a janela maior que a leitura cabe, a resposta avisa que está cortada. É leitura, sem migration e sem tela nesta fatia — a tela vem depois. Contribuição de @webtecnica (#1833)
