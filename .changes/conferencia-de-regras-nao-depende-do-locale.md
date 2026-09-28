---
impacto: nada_mudou
secao: corrigido
titulo: A atualização não acusa mais regra de isolamento que sempre esteve no banco
---

Em servidores cujo idioma do sistema é `en_US.UTF-8` ou `pt_BR.UTF-8`, a conferência de regras de isolamento do `update.sh` podia acusar como ausentes regras que estavam no banco, e a atualização parava no meio com a tela de manutenção de pé, mandando procurar uma regra que nunca faltou. Agora a ordenação e a comparação usam ordem de bytes, e o resultado é o mesmo em qualquer idioma. Instalação que nunca passou por esse aviso não muda em nada.

Se a sua atualização já parou nesse aviso, o `update.sh` que está no disco é o antigo, e é ele que roda a conferência na atualização que traz este conserto, tanto no terminal quanto no botão "Atualizar". Ela pode parar mais uma vez no mesmo aviso. Para sair numa passada só, rode uma vez na pasta do CRM, trocando `vX.Y.Z` pelo número desta versão:

```bash
git fetch --tags origin
git checkout vX.Y.Z
bash hostgator-setup-kit/update.sh --to vX.Y.Z --force
```

Depois disso as atualizações seguintes voltam a rodar sozinhas.

Contribuição de @gideony (#1837).
