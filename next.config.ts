import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The redesign is the app now: the briefed addresses land on the real,
  // DB-backed pages. The prototypes stay in /public as archive files
  // (write.html, redesign.html) reachable by their .html paths only.
  async redirects() {
    return [
      { source: "/write", destination: "/review/1", permanent: false },
      { source: "/redesign", destination: "/restaurant/1", permanent: false }
    ];
  }
};

export default nextConfig;
