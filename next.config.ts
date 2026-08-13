import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
      },
      {
        // Clerk-hosted avatars — uploaded pictures and the OAuth provider
        // images Clerk proxies. Only reached by the account identity block,
        // and only for a signed-in visitor's own avatar.
        protocol: "https",
        hostname: "img.clerk.com",
      },
    ],
  },
};

export default nextConfig;
