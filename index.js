const express = require("express");
const axios = require("axios");
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.post("/api/:webhookId/:webhookToken", async (req, res) => {
  const { webhookId, webhookToken } = req.params;
  const discordWebhook = `https://discord.com/api/webhooks/${webhookId}/${webhookToken}`;

  try {
    await axios.post(discordWebhook, req.body);
    res.json({ success: true });
  } catch (err) {
    console.error("Failed to send to Discord:", err.message);
    res.status(500).json({ error: "Failed to send message." });
  }
});

app.listen(PORT, () => {
  console.log(`Webhook forwarder running on port ${PORT}`);
});
