import type { MetadataRoute } from "next";

import { marcaDaInstalacao } from "@/lib/branding/instalacao";
import { marcaDaSaida } from "@/lib/branding/saida";

// A marca é lida na instalação, nunca congelada no build da imagem.
export const dynamic = "force-dynamic";

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const marca = await marcaDaSaida(null);
  const linha = await marcaDaInstalacao();
  const versao = linha?.favicon_path ? `?v=${encodeURIComponent(linha.favicon_path)}` : "";
  return {
    name: marca.nome,
    short_name: marca.nome,
    display: "standalone",
    start_url: "/app",
    scope: "/",
    icons: [
      { src: `/app-icon/192${versao}`, sizes: "192x192", type: "image/png" },
      { src: `/app-icon/512${versao}`, sizes: "512x512", type: "image/png" },
    ],
  };
}
