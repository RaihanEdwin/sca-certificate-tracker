require("dotenv").config();

module.exports = {
  port: process.env.PORT || 3002,
  mondayApiToken: process.env.MONDAY_API_TOKEN,
  mondayBoardId: process.env.MONDAY_BOARD_ID,
  frontendUrl: process.env.FRONTEND_URL || "http://localhost:8080",
  nodeEnv: process.env.NODE_ENV || "development",
};
