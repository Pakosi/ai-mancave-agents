const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());

// test route
app.get("/api/test", (req, res) => {
  res.json({ message: "Backend is alive" });
});

app.get("/api/status", (req, res) => {
  res.json({ status: "ok" });
});

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

// root route (optional but nice)
app.get("/", (req, res) => {
  res.send("AI Mancave Backend Running");
});

app.listen(3001, () => {
  console.log("Server running on port 3001");
});
