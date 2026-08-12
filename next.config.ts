import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Padrão do Next.js é 1MB — pequeno demais para upload de logo/assinatura
    // em Configurações (uma foto de assinatura escaneada facilmente passa
    // disso), o que fazia o Server Action falhar com erro genérico de servidor.
    serverActions: {
      bodySizeLimit: '5mb',
    },
  },
};

export default nextConfig;
