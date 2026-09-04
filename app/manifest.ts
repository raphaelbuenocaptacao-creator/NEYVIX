import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "NEYVIX — Intelligence Operating System",
    short_name: "NEYVIX",
    description: "Uma identidade. Uma inteligência. Um universo digital.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#02050a",
    theme_color: "#00a8ff",
    lang: "pt-BR",
    categories: ["business", "productivity", "utilities"],
    icons: [
      {
        src: "/neyvix-icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/neyvix-icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/neyvix-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      { name: "Central de Comando", short_name: "Comando", url: "/dashboard" },
      { name: "NEYVIX AI", short_name: "AI", url: "/ai" },
      { name: "Studio", short_name: "Studio", url: "/studio" },
      { name: "Estate", short_name: "Estate", url: "/estate" },
      { name: "Automation", short_name: "Automation", url: "/automation" },
    ],
  };
}
