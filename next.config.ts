import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  env: {
    // Timestamp when this build started. Used by /api/check-rebuild to decide
    // whether Airtable has been edited since the last deploy.
    BUILD_TIME: new Date().toISOString(),
  },
  async redirects() {
    return [
      {
        source: '/founder-toolkit',
        destination: '/founders',
        permanent: true,
      },
      // Admin routes renamed: /admin/assistant -> /admin/chatbot.
      {
        source: '/admin/assistant',
        destination: '/admin/chatbot/playground',
        permanent: false,
      },
      {
        source: '/admin/assistant/conversations',
        destination: '/admin/chatbot/log',
        permanent: false,
      },
      // Migrated from Webflow redirects (exported 6 April 2026).
      // Redirects whose destination doesn't exist on the new site
      // were skipped: /ai-safety-reading-guide, /landscape-map/suggest,
      // /jobs-old, /reading-guide.
      // Chains through /stay-informed were collapsed to /media-channels.
      { source: '/donating', destination: '/donation-guide', permanent: true },
      { source: '/database', destination: '/communities', permanent: true },
      {
        source: '/events',
        destination: '/events-and-training',
        permanent: true,
      },
      { source: '/talk-to-a-human', destination: '/advisors', permanent: true },
      { source: '/landscape-map', destination: '/map', permanent: true },
      { source: '/landscape-map-2025', destination: '/map', permanent: true },
      { source: '/reading-group', destination: '/', permanent: true },
      { source: '/courses', destination: '/self-study', permanent: true },
      { source: '/funders', destination: '/funding', permanent: true },
      {
        source: '/volunteer-projects',
        destination: '/projects',
        permanent: true,
      },
      {
        source: '/stay-informed',
        destination: '/media-channels',
        permanent: true,
      },
      {
        source: '/learn-and-stay-informed',
        destination: '/media-channels',
        permanent: true,
      },
      { source: '/media', destination: '/media-channels', permanent: true },
    ]
  },
}

export default nextConfig
