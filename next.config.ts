import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  experimental: {
    // L'import Excel des terrains passe par une action serveur (limite par défaut : 1 Mo) ; l'action accepte 5 Mo.
    serverActions: { bodySizeLimit: "6mb" },
  },
  images: {
    // Optimisation limitée aux images du site et aux fichiers publics téléversés
    localPatterns: [
      { pathname: "/images/**", search: "" },
      { pathname: "/api/files/public/**", search: "" },
    ],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
