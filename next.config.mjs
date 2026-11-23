/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: ["*.trycloudflare.com", "*.ngrok-free.app", "*.ngrok-free.dev", "*.ngrok.io"],
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'ngrok-skip-browser-warning', value: 'true' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Permissions-Policy', value: 'camera=(self), microphone=(self), geolocation=()' },
          // Allow embedding content from the three embeddable platforms
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline'",
              // Audio/video from direct URLs and blob: for file uploads
              "media-src 'self' blob: data: https: http:",
              // iframes: YouTube, SoundCloud, Deezer widget
              "frame-src 'self' https://www.youtube.com https://youtube.com https://w.soundcloud.com https://widget.deezer.com",
              // XHR/fetch for Audius, any CDN direct audio URLs
              "connect-src 'self' https: wss:",
              // Images from anywhere (cover art, YouTube thumbnails)
              "img-src 'self' data: blob: https: http:",
              // Fonts
              "font-src 'self' data:",
            ].join('; '),
          },
        ],
      },
    ]
  },
}

export default nextConfig
