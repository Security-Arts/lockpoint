import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      // Legacy /locks/* routes → /me (permanent 301)
      {
        source: "/locks",
        destination: "/me",
        permanent: true,
      },
      {
        source: "/locks/new",
        destination: "/me",
        permanent: true,
      },
      {
        source: "/locks/:id",
        destination: "/me",
        permanent: true,
      },
      {
        source: "/locks/:id/seal",
        destination: "/me",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
