// Public settings, inlined at build time from .env.local (web/vite.config.ts).
export const env = {
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL as string,
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY as string,
};
