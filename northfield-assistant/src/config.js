// config.js
// Loads environment variables once and validates the ones the app cannot
// run without. Failing loudly here (instead of letting a missing key
// surface later as a confusing fetch error) is the whole point of this
// file.

import "dotenv/config";

function requireEnv(name) {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    throw new Error(
      `Missing required environment variable "${name}". ` +
        `Copy .env.example to .env and fill it in before starting the server.`
    );
  }
  return value.trim();
}

const GROQ_API_KEY = requireEnv("GROQ_API_KEY");
const GROQ_MODEL = process.env.GROQ_MODEL?.trim() || "llama-3.3-70b-versatile";
const PORT = Number.parseInt(process.env.PORT, 10) || 3000;

// DEFENSES defaults to "on" (fail safe) unless explicitly set to "off".
// This lets the evaluation harness flip it per run: once with defenses on,
// once with them off, to produce the before/after comparison the rubric
// asks for.
const DEFENSES_ENABLED = (process.env.DEFENSES?.trim().toLowerCase() ?? "on") !== "off";

const GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";

export const config = {
  groqApiKey: GROQ_API_KEY,
  groqModel: GROQ_MODEL,
  groqEndpoint: GROQ_ENDPOINT,
  port: PORT,
  defensesEnabled: DEFENSES_ENABLED,
};
