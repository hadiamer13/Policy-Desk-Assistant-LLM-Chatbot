// server.js
// Express entry point. This is a placeholder for Step 1: it starts the
// server and exposes a health check so "npm start" and "npm run dev" have
// something real to run. The /chat route, static file serving for
// public/, and request validation are added in a later step.

import express from "express";
import { config } from "./config.js";

const app = express();
app.use(express.json());

app.get("/health", (req, res) => {
  res.json({ status: "ok", defensesEnabled: config.defensesEnabled });
});

app.listen(config.port, () => {
  console.log(`Northfield Policy Desk Assistant listening on port ${config.port}`);
  console.log(`Defenses: ${config.defensesEnabled ? "ON" : "OFF"}`);
});
