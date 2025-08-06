// api/certificates.js - Vercel Serverless Function
const MondayClient = require("../lib/mondayClient");

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  const mondayClient = new MondayClient();

  try {
    if (req.method === "GET") {
      const { name } = req.query;

      if (name) {
        // GET /api/certificates?name=reza - Search by name via query param
        const results = await mondayClient.searchCertificatesByName(name);

        res.status(200).json({
          success: true,
          data: {
            name: name,
            results: results,
            count: results.length,
          },
        });
      } else {
        // GET /api/certificates - Get all certificates
        const data = await mondayClient.getAllCertificates();

        res.status(200).json({
          success: true,
          data: data,
        });
      }
    } else if (req.method === "POST") {
      // POST /api/certificates - Search certificates by name in body
      const { searchTerm } = req.body;

      if (!searchTerm || typeof searchTerm !== "string") {
        return res.status(400).json({
          success: false,
          error: "searchTerm is required and must be a string",
        });
      }

      const results = await mondayClient.searchCertificatesByName(
        searchTerm.trim()
      );

      res.status(200).json({
        success: true,
        data: {
          searchTerm: searchTerm.trim(),
          results: results,
          count: results.length,
        },
      });
    } else {
      res.status(405).json({
        success: false,
        error: "Method not allowed",
      });
    }
  } catch (error) {
    console.error("API Error:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
      message: error.message,
    });
  }
}
