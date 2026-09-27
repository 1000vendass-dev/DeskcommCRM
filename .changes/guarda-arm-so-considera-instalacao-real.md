---
impacto: nada_mudou
secao: corrigido
titulo: Instalar pela primeira vez numa VPS ARM volta a ser recusado, mesmo com o .env já preenchido
---

Se você está começando a instalar o DeskcommCRM numa VPS ARM (Oracle Ampere,
aarch64) e o `install.sh` recusava dizendo que só existe VPS x86_64, a causa
estava no `.env`: uma pasta com o arquivo de configuração preenchido — copiado de
outra máquina, gerado por automação, ou deixado por uma instalação que parou no
meio — era confundida com uma instalação que já estava no ar. O instalador então
aceitava seguir e passava 15 a 25 minutos construindo as imagens na própria VPS,
quando o certo era recusar logo no começo.

Agora a instalação é reconhecida pelo que ela deixou de verdade: os contêineres
do DeskcommCRM (ou do seu Supabase) no Docker, ou o arquivo que o próprio
instalador grava quando termina. Quem já tinha o CRM rodando numa VPS ARM
continua atualizando normalmente, aviso e build local inclusos.

Se você usa o comando de "recomeçar" (`docker compose down -v && rm -f .env`),
ele passou a apagar esse arquivo junto — ele faz parte do estado da instalação.

Contribuição de @webtecnica (#1778).
