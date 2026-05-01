import { existsSync, readFileSync, writeFileSync } from "node:fs";

for (const file of [".env", ".env.local"]) {
  if (!existsSync(file)) continue;

  const lines = readFileSync(file, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;

    const separator = trimmed.indexOf("=");
    const key = trimmed.slice(0, separator).trim();
    const rawValue = trimmed.slice(separator + 1).trim();
    const value = rawValue.replace(/^['"]|['"]$/g, "");

    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

function getSupabaseUrl() {
  const projectRef = (process.env.VITE_SUPABASE_PROJECT_REF || "").trim();
  if (projectRef) return `https://${projectRef}.supabase.co`;

  return (process.env.VITE_SUPABASE_URL || "").trim();
}

const config = {
  supabaseUrl: getSupabaseUrl(),
  supabaseAnonKey: process.env.VITE_SUPABASE_ANON_KEY || "",
};

writeFileSync(
  "runtime-config.js",
  `window.BREAKROOM_CONFIG = ${JSON.stringify(config, null, 2)};\n`,
);
