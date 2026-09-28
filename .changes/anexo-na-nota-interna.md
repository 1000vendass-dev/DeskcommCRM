---
impacto: capacidade_nova
secao: adicionado
titulo: Anexo de imagem, arquivo, áudio ou vídeo dentro de nota interna
---

A nota interna de conversa passa a aceitar anexo. Quem escreve nota pode anexar imagem, documento, áudio ou vídeo, e o anexo aparece na própria nota — como ficha de apoio para o time, com o nome do arquivo e o tipo visíveis no cartão.

O arquivo não sai da empresa: ele vive num bucket próprio (`internal-media`), separado da mídia de conversa, **não vai para o cliente no WhatsApp** e **não é apagado pela rotina diária de limpeza** que varre a mídia de conversa (que retém por 1 dia). Isso é de propósito: a nota interna é apoio ao atendimento, não mensagem enviada.

Para quem lê a nota, o anexo abre por um endereço temporário (60 segundos) e só se a pessoa puder ler a conversa daquela nota — mesma regra de permissão que a própria nota já tinha, sem permissão nova.

**LGPD**: quando um contato pede exclusão, a nota e o arquivo dela entram na mesma cascata que redige as demais notas — o texto é redigido, o ponteiro do arquivo é zerado e o arquivo vai para a fila de remoção sob o pedido. A exportação de dados também inclui o anexo. A remoção automática de órfãos do bucket próprio acontece **sob pedido LGPD**, nunca pela retenção diária.

**Sem mudança de comportamento para a nota sem anexo**: ela continua como estava; as colunas novas ficam vazias.

Contribuição de @webtecnica (#1883).
