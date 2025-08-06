const express = require("express");
const cors = require("cors");
const path = require("path");
const config = require("./config/config");

// Import routes
const certificatesRoutes = require("./routes/certificates");

const app = express();

// Middleware
app.use(
  cors({
    origin: [
      config.frontendUrl,
      "http://localhost:3002",
      "http://127.0.0.1:8080",
    ],
    credentials: true,
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from frontend directory
app.use(express.static(path.join(__dirname, "../frontend")));

// API Routes
app.use("/api/certificates", certificatesRoutes);

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "Certificate Tracker API is running",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
  });
});

// Serve frontend for any non-API routes
app.get("*", (req, res) => {
  if (!req.path.startsWith("/api")) {
    res.sendFile(path.join(__dirname, "../frontend/index.html"));
  } else {
    res.status(404).json({
      success: false,
      error: "API endpoint not found",
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("Error:", err);
  res.status(500).json({
    success: false,
    error: "Internal server error",
    message:
      config.nodeEnv === "development" ? err.message : "Something went wrong",
  });
});

// Start server
const PORT = config.port;
app.listen(PORT, () => {
  console.log(`🚀 Certificate Tracker Server running on port ${PORT}`);
  console.log(`📱 Frontend: http://localhost:${PORT}`);
  console.log(`🔧 API: http://localhost:${PORT}/api`);
  console.log(`💚 Health check: http://localhost:${PORT}/api/health`);
  console.log(`🌍 Environment: ${config.nodeEnv}`);
});
