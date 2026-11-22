// Auth.js v4 uses NEXTAUTH_URL; retain the requested AUTH_URL configuration name.
if (process.env.AUTH_URL && !process.env.NEXTAUTH_URL) {
  process.env.NEXTAUTH_URL = process.env.AUTH_URL;
}
