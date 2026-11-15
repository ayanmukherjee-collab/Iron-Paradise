import type { MetadataRoute } from "next";
import { gym } from "@/content/landing";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: gym.fullName,
    short_name: gym.name,
    description: gym.description,
    id: "/app",
    start_url: "/app",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#1c1b1d",
    theme_color: "#1c1b1d",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
