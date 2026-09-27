---
impacto: nada_mudou
secao: corrigido
titulo: Voltar e avançar numa spec espera a revelação da página, como carregar e recarregar
---

Quem usa a Agenda e volta para ela por `goBack` — a navegação de volta do
navegador — podia encontrar a tela contada duas vezes, e o sintoma era um teste
que reprovava sozinho, sem ninguém ter mudado nada na Agenda. A tela estava
bem: a cópia extra que aparecia era a da revelação da página, que o navegador
esvazia sozinho poucos instantes depois. O que faltava era a navegação de
volta esperar esse esvaziamento, como carregar e recarregar já esperavam. Agora
espera, e a agenda é desenhada uma vez só depois de voltar para ela.

Nada a fazer para quem já roda o sistema: a mudança é na suíte de testes, e o
aplicativo se comporta exatamente como antes.

Contribuição de @webtecnica (#884).
