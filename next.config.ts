import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // prototypes live flat in /public; allow the briefed bare routes to reach them
  // (temporary until the real /write route is promoted to the app)
  async redirects() {
    return [
      { source: "/write", destination: "/write.html", permanent: false },
      { source: "/redesign", destination: "/redesign.html", permanent: false }
    ];
  }
};

export default nextConfig;
