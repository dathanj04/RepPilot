import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "RepPilot AI",
    short_name: "RepPilot",
    description: "Less admin. More territory. More relationships.",
    start_url: "/today",
    display: "standalone",
    background_color: "#F5F7FA",
    theme_color: "#10263E",
    icons: [
      { src: "/icon", sizes: "512x512", type: "image/png" },
    ],
  };
}
