/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Fotos de premios comprimidas (~300 KB) llegan como base64 en server actions.
    serverActions: {
      bodySizeLimit: "2mb",
    },
  },
};

export default nextConfig;
