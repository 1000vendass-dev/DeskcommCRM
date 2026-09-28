---
impacto: nada_mudou
secao: corrigido
titulo: A atualização não acusa mais regra de isolamento que sempre esteve no banco
---

Em instalações cujo idioma do sistema é um `UTF-8` — o `en_US.UTF-8` e o
`pt_BR.UTF-8` que vêm por padrão em quase toda VPS —, a conferência de regras de
isolamento do `hostgator-setup-kit/update.sh` acusava como ausentes regras que
estavam no banco. O aviso era falso: as duas listas eram ordenadas conforme o
idioma, e a comparação entre elas deixava de reconhecer as regras que estavam
lá. A atualização parava no meio, com a tela de manutenção de pé, mandando
procurar regra que nunca faltou.

Agora a ordenação e a comparação usam ordem de bytes, e o resultado é o mesmo em
qualquer idioma. Instalação que já tinha parado nesse aviso volta a atualizar
normalmente; instalação saudável não muda em nada. Não exige ação de quem opera
a instalação.
