const express = require("express");
const axios = require("axios");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

const LOG_FILE = path.join(__dirname, "webhook_logs.json");
const BLOCKED_FILE = path.join(__dirname, "blocked_webhooks.json");

let blockedWebhooks = [];
try {
  blockedWebhooks = JSON.parse(fs.readFileSync(BLOCKED_FILE, "utf8"));
} catch {
  blockedWebhooks = [];
}

function saveBlocked() {
  fs.writeFileSync(BLOCKED_FILE, JSON.stringify(blockedWebhooks, null, 2));
}

const clients = [];

function logWebhookUse(webhookId, webhookToken, body, ip) {
  const logEntry = {
    webhookId,
    webhookToken,
    timestamp: new Date().toISOString(),
    ip,
    body,
  };

  let logs = [];
  try {
    logs = JSON.parse(fs.readFileSync(LOG_FILE, "utf8"));
  } catch {
    logs = [];
  }
  logs.push(logEntry);
  fs.writeFileSync(LOG_FILE, JSON.stringify(logs, null, 2));

  const data = `data: ${JSON.stringify(logEntry)}\n\n`;
  clients.forEach((client) => client.write(data));
}

app.use(express.json());

app.use("/api/:webhookId/:webhookToken", (req, res, next) => {
  const { webhookId, webhookToken } = req.params;
  if (
    blockedWebhooks.some(
      (w) => w.id === webhookId && w.token === webhookToken
    )
  ) {
    return res.status(403).json({ error: "This webhook has been revoked." });
  }
  next();
});

app.post("/api/:webhookId/:webhookToken", async (req, res) => {
  const { webhookId, webhookToken } = req.params;
  const discordWebhook = `https://discord.com/api/webhooks/${webhookId}/${webhookToken}`;
  const ip = req.headers["x-forwarded-for"] || req.connection.remoteAddress;

  logWebhookUse(webhookId, webhookToken, req.body, ip);

  try {
    await axios.post(discordWebhook, req.body);
    res.json({ success: true });
  } catch (err) {
    console.error("Failed to send to Discord:", err.message);
    res.status(500).json({ error: "Failed to send message." });
  }
});

app.get("/admin/live", (req, res) => {
  res.writeHead(200, {
    Connection: "keep-alive",
    "Cache-Control": "no-cache",
    "Content-Type": "text/event-stream",
  });

  clients.push(res);

  req.on("close", () => {
    const index = clients.indexOf(res);
    if (index !== -1) clients.splice(index, 1);
  });
});

app.post("/admin/block", (req, res) => {
  const { webhookId, webhookToken } = req.body;
  if (!webhookId || !webhookToken) {
    return res.status(400).json({ error: "webhookId and webhookToken required" });
  }

  if (!blockedWebhooks.some((w) => w.id === webhookId && w.token === webhookToken)) {
    blockedWebhooks.push({ id: webhookId, token: webhookToken });
    saveBlocked();
  }

  res.json({ success: true, message: "Webhook blocked" });
});

app.get("/admin/logs", (req, res) => {
  try {
    const logs = JSON.parse(fs.readFileSync(LOG_FILE, "utf8"));
    res.json(logs);
  } catch {
    res.json([]);
  }
});

app.listen(PORT, () => {
  console.log(`Webhook proxy running on port ${PORT}`);
});
