"use client";
import { forwardRef, useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { SidebarContent } from "@/components/shell/Sidebar";
import { ContadorDaFila } from "@/components/shell/ContadorDaFila";
import { useAuth } from "@/hooks/auth/AuthProvider";
import { useT } from "@/hooks/i18n/useT";
import { ABAS_DO_CELULAR, abaAtiva, barraVisivel, type IdDaAba } from "@/lib/navigation/abas-do-celular";
import { destinosDaInterface } from "@/lib/navigation/interface";
import { usePecaDoRodape, type PecaDoRodape } from "@/lib/ui/rodape-ocupado";
import { CalendarBlank, ChatCircle, DotsThree, Kanban } from "@/lib/ui/icons";
import { cn } from "@/lib/utils";

const ICONE_DA_ABA = {
  conversas: ChatCircle,
  funil: Kanban,
  agenda: CalendarBlank,
} as const;

/**
 * A barra declara o que ocupa no contrato do rodapé (`lib/ui/rodape-ocupado`):
 * é por ele que o `<main>` da casca e o `grid` do Inbox descontam a altura dela,
 * sem nenhum dos dois saber que existe uma barra. `h-14` (56px) é o piso; a
 * medição real soma a área segura do iPhone quando ela existe.
 */
const BARRA_DE_ABAS: PecaDoRodape = {
  dono: "components/shell/BarraDeAbasDoCelular.tsx",
  distancia: 0,
  altura: 56,
};

/** Abaixo do `md` do Tailwind (768px), a mesma régua do `md:hidden` da barra. */
const CONSULTA_DO_CELULAR = "(max-width: 767.98px)";

/**
 * Sem `matchMedia` (jsdom, navegador muito antigo) a resposta é "não é celular":
 * a barra continua aparecendo pelo CSS e só deixa de reservar, que é o estado
 * de antes dela existir — nunca um erro que derruba a casca inteira.
 */
function ehTelaDeCelular(): boolean {
  return typeof window.matchMedia === "function" && window.matchMedia(CONSULTA_DO_CELULAR).matches;
}

function assinarCelular(avisar: () => void) {
  if (typeof window.matchMedia !== "function") return () => {};
  const mql = window.matchMedia(CONSULTA_DO_CELULAR);
  mql.addEventListener("change", avisar);
  return () => mql.removeEventListener("change", avisar);
}

/**
 * A barra de baixo do celular: Conversas, Funis, Agenda e Mais.
 *
 * QUEM DECIDE SE ELA APARECE É O CSS (`md:hidden`), na primeira pintura — o
 * mesmo motivo de `colunasDoCelular` no Inbox: media query em JavaScript só
 * decide depois da hidratação e faria a barra piscar. O JavaScript decide outra
 * coisa: se ela RESERVA espaço no rodapé. Reservar no desktop, onde ela está
 * escondida, empurraria o conteúdo de toda tela 56px para cima por nada.
 */
export function BarraDeAbasDoCelular() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const ehCelular = useSyncExternalStore(
    assinarCelular,
    ehTelaDeCelular,
    () => false,
  );

  if (!barraVisivel(pathname, searchParams?.get("id") ?? null)) return null;
  return ehCelular ? <BarraQueReserva pathname={pathname} /> : <Barra pathname={pathname} />;
}

function BarraQueReserva({ pathname }: { pathname: string }) {
  const ancora = usePecaDoRodape(BARRA_DE_ABAS);
  return <Barra ref={ancora} pathname={pathname} />;
}

const Barra = forwardRef<HTMLDivElement, { pathname: string }>(function Barra({ pathname }, ref) {
  const t = useT();
  const { user, activeOrg } = useAuth();
  const [maisAberto, setMaisAberto] = useState(false);
  const ativa: IdDaAba = maisAberto ? "mais" : abaAtiva(pathname);

  // A barra é atalho para portas que a pessoa JÁ tem: uma aba só aparece se o
  // destino dela passa pela mesma régua do menu (papel, módulos, interface
  // escolhida pela organização). Sem isto, um `viewer` com interface enxuta
  // veria um atalho para uma tela que o menu dele esconde.
  const abas = useMemo(() => {
    const visiveis = new Set(
      destinosDaInterface(
        activeOrg?.interface_settings,
        user.is_platform_admin && !user.support,
        activeOrg?.role ?? null,
        activeOrg?.modulos_ligados ?? [],
        activeOrg?.capacidades_ligadas ?? [],
      ).map((d) => d.href),
    );
    return ABAS_DO_CELULAR.filter((aba) => visiveis.has(aba.href));
  }, [activeOrg, user.is_platform_admin, user.support]);

  return (
    <div
      ref={ref}
      className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      <nav aria-label={t("Navegação do app")} className="flex h-14 items-stretch">
        {abas.map((aba) => {
          const Icone = ICONE_DA_ABA[aba.id];
          const acesa = ativa === aba.id;
          return (
            <Link
              key={aba.id}
              href={aba.href}
              aria-current={acesa ? "page" : undefined}
              className={cn(
                "relative flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium",
                acesa ? "text-primary" : "text-muted-foreground",
              )}
            >
              <span className="relative">
                <Icone size={24} weight={acesa ? "fill" : "regular"} aria-hidden />
                {aba.id === "conversas" && <ContadorDaFila compacto />}
              </span>
              <span className="truncate">{t(aba.rotulo)}</span>
            </Link>
          );
        })}
        <Sheet open={maisAberto} onOpenChange={setMaisAberto}>
          <button
            type="button"
            onClick={() => setMaisAberto(true)}
            aria-haspopup="dialog"
            aria-expanded={maisAberto}
            className={cn(
              "flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium",
              ativa === "mais" ? "text-primary" : "text-muted-foreground",
            )}
          >
            <DotsThree size={24} weight="bold" aria-hidden />
            <span className="truncate">{t("Mais")}</span>
          </button>
          <SheetContent
            side="left"
            className="flex w-72 max-w-[calc(100vw-2rem)] flex-col gap-0 p-0 sm:max-w-xs"
          >
            <SheetTitle className="sr-only">{t("Navegação principal")}</SheetTitle>
            <SidebarContent
              collapsed={false}
              showCollapseControl={false}
              onNavigate={() => setMaisAberto(false)}
            />
          </SheetContent>
        </Sheet>
      </nav>
    </div>
  );
});
