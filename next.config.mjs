/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['pg', 'mongodb', 'bcryptjs', '@huggingface/transformers'],
  poweredByHeader: false,
};
export default nextConfig;
