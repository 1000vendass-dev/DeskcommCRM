---
impacto: capacidade_nova
secao: adicionado
titulo: Perguntar ao acervo direto da conversa — e a busca do atendente vira métrica em Evolução
---

Quem atende ganha, ao lado da conversa, uma caixa de pergunta sobre o material da própria empresa (as fontes que a IA usa nas respostas). Digitar a pergunta devolve os trechos que passaram no limiar, com o percentual de afinidade de cada um, e mostra claramente as duas situações que a IA escondia: o acervo está vazio (o material ainda não existe) e o acervo tem algo parecido, mas não passou no limiar (é perto, mas não é isso). Nada de servidor novo: as buscas usam o mesmo `search_knowledge` e o mesmo LIMIAR_PADRAO que as respostas da IA usam, e não existe uma segunda régua para a tela.

A busca de quem opera deixa também de ser invisível para a própria ferramenta: até aqui só o agente gravava em `knowledge_searches`, então a tela de Evolução mostrava a IA perguntando e o trabalho do atendente sumia da métrica. Agora a pergunta humana entra na mesma série, marcada como humana — quem sai do sistema mantém o histórico daquilo que pesquisou, sem apagar nada. Não há ação para quem opera a VPS: a migração é aditiva e roda sozinha na atualização.

Contribuição de @webtecnica (#1869).
