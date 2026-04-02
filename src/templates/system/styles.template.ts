export const systemEmailStyles = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  :root { color-scheme: dark; supported-color-schemes: dark; }
  * { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
  body, .ExternalClass { background-color: #0a0a0a !important; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; -webkit-font-smoothing: antialiased; color: #888888; margin: 0 !important; padding: 0 !important; }
  a { color: #4f8ef7; text-decoration: none; }
  /* Gmail mobile app dark mode wrapper selector */
  u + #body .email-wrapper { background-color: #0a0a0a !important; }
  #outlook a { padding: 0; }
  a[x-apple-data-detectors] { color: inherit !important; text-decoration: none !important; }
  @media (prefers-color-scheme: dark) {
    body { background-color: #0a0a0a !important; }
  }
  @media (max-width: 600px) {
    /* Keep minimal, most styling is inline for email client compatibility */
  }
`;
