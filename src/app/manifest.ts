import type { MetadataRoute } from "next";

// "Add to Home Screen" opens Ledgr full-screen, straight to the dashboard.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Ledgr",
    short_name: "Ledgr",
    description: "Every Aussie tax deduction, tracked.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#fff5ea",
    theme_color: "#fff5ea",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
