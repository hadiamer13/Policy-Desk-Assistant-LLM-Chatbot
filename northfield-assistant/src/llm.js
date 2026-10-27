// llm.js
// Thin wrapper around the Groq chat completions endpoint (OpenAI-compatible
// schema). Kept deliberately small and framework-free: callLLM() takes
// OpenAI-style messages and returns the assistant's text, or throws a
// readable Error.

import { config } from "./config.js";

const TIMEOUT_MS = 20_000;
const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Call the Groq LLM with a list of chat messages.
 *
 * @param {Array<{role: "system"|"user"|"assistant", content: string}>} messages
 * @param {{temperature?: number, maxTokens?: number, responseFormat?: object}} [options]
 * @returns {Promise<string>} the text of the first completion choice
 */
export async function callLLM(messages, options = {}) {
  const { temperature = 0.2, maxTokens = 1024, responseFormat } = options;

  const body = {
    model: config.groqModel,
    messages,
    temperature,
    max_tokens: maxTokens,
  };
  if (responseFormat) {
    body.response_format = responseFormat;
  }

  let lastError;

  // One retry (two attempts total) on 429 / 5xx, which are the classes of
  // failure where retrying is actually likely to help (rate limit, or a
  // transient upstream problem) rather than a request that will fail the
  // same way every time (e.g. 400 bad request, 401 bad key).
  for (let attempt = 0; attempt < 2; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const response = await fetch(config.groqEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.groqApiKey}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        const message = `Groq API returned ${response.status} ${response.statusText}: ${errorText}`;

        const statusError = new Error(message);
        statusError.retryable = RETRYABLE_STATUS.has(response.status);

        if (statusError.retryable && attempt === 0) {
          lastError = statusError;
          await sleep(1000); // brief backoff before the single retry
          continue;
        }
        throw statusError;
      }

      const data = await response.json();
      const text = data?.choices?.[0]?.message?.content;
      if (typeof text !== "string") {
        throw new Error(
          `Groq API response did not contain the expected choices[0].message.content field: ${JSON.stringify(
            data
          )}`
        );
      }
      return text;
    } catch (err) {
      clearTimeout(timer);

      // err.retryable is set above (bad status code that's worth retrying).
      // A timeout (AbortError) or a network-level failure (fetch throwing
      // before any response) are also worth one retry - everything else
      // (malformed response body, programmer error) fails fast.
      const isTimeout = err.name === "AbortError";
      const isNetworkError = err instanceof TypeError; // fetch's generic failure type
      lastError = isTimeout
        ? new Error(`Groq API call timed out after ${TIMEOUT_MS}ms`)
        : err;

      if (err.retryable || isTimeout || isNetworkError) {
        if (attempt === 0) {
          await sleep(1000);
          continue;
        }
        throw lastError;
      }
      throw err;
    }
  }

  throw lastError ?? new Error("Groq API call failed for an unknown reason.");
}

// Self-test: run with `node src/llm.js` to confirm GROQ_API_KEY works.
// Guarded so this never runs when llm.js is imported by server.js or
// anything else.
const isDirectRun = import.meta.url === `file://${process.argv[1]}`;
if (isDirectRun) {
  (async () => {
    console.log(`Calling Groq (${config.groqModel}) with a test message...`);
    try {
      const reply = await callLLM([
        { role: "user", content: "Reply with exactly the word: pong" },
      ]);
      console.log("Success. Model replied:");
      console.log(reply);
    } catch (err) {
      console.error("Test call failed:", err.message);
      process.exitCode = 1;
    }
  })();
}
