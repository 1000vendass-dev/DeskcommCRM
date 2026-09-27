---
impacto: nada_mudou
secao: corrigido
titulo: Quem já tinha o DeskcommCRM rodando em ARM (VPS aarch64) volta a conseguir atualizar
---

A partir desta versão, quem já tinha o DeskcommCRM instalado numa VPS ARM
(Oracle Ampere, aarch64) volta a conseguir rodar `update.sh`. A versão anterior
recusava a atualização na primeira linha, dizendo que só existe VPS x86_64 —
mesmo em quem já tinha o CRM funcionando.

O que a recusa continua fazendo é barrar a instalação NOVA: quem ainda não
instalou precisa de uma VPS x86_64, como antes. Quem já tem o CRM no ar só vai
perceber que a atualização demora alguns minutos a mais (as imagens da versão
alvo são construídas na própria VPS) e que ela segue sozinha depois, sem nada
manual.

Crédito: @webtecnica.
