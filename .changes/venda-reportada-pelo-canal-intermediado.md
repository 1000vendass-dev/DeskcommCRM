---
impacto: capacidade_nova
secao: adicionado
titulo: A venda que veio de anúncio vai para a Meta pelo próprio canal intermediado, sem token nem dataset no CRM
---

Quando o número de WhatsApp está conectado por um canal intermediado que já
liga o conjunto de dados da Meta ao número (na tela do próprio provedor), a
venda fechada no CRM — botão Ganhar, arrasto no quadro ou mover em lote —
agora é reportada por esse canal: o evento `Purchase` sai com o valor, a moeda
e o id da conversa, e o provedor completa o vínculo com o clique do anúncio.

Antes, a única via era a conexão direta com a Meta (Configurações ›
Conversões), que exige token e dataset próprios, e quem só tinha a ponte do
lado do canal via a venda parada como pendência "sem conexão".

Quem já configurou a conexão direta não percebe diferença: a venda segue por
ela, e o canal só entra quando essa conexão não existe. A venda sai por um
caminho só, e a resposta do canal é lida por inteiro — um evento recusado
dentro de uma resposta de sucesso aparece como recusa na tela de conversões,
não como enviado.
