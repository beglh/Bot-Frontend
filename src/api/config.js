// Single backend served via IIS — all pages (Bot, Admin, Dashboard) use this
const BASE =
  import.meta.env.VITE_API_URL || "https://localhost:443/api";

export const API_BASE = BASE;
export const ADMIN_API_BASE = BASE;