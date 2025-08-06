const express = require("express");
const router = express.Router();
const MondayClient = require("../utils/mondayClient");

const mondayClient = new MondayClient();

// GET /api/certificates - Get all certificates
router.get("/", async (req, res) => {
  try {
    const data = await mondayClient.getAllCertificates();
    res.json({
      success: true,
      data: data,
    });
  } catch (error) {
    console.error("Error fetching certificates:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch certificates",
      message: error.message,
    });
  }
});

// POST /api/certificates/search - Search certificates by name
router.post("/search", async (req, res) => {
  try {
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

    res.json({
      success: true,
      data: {
        searchTerm: searchTerm.trim(),
        results: results,
        count: results.length,
      },
    });
  } catch (error) {
    console.error("Error searching certificates:", error);
    res.status(500).json({
      success: false,
      error: "Failed to search certificates",
      message: error.message,
    });
  }
});

// GET /api/certificates/:name - Get certificates for specific person
router.get("/:name", async (req, res) => {
  try {
    const { name } = req.params;
    const results = await mondayClient.searchCertificatesByName(name);

    res.json({
      success: true,
      data: {
        name: name,
        results: results,
        count: results.length,
      },
    });
  } catch (error) {
    console.error("Error fetching certificates for person:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch certificates for person",
      message: error.message,
    });
  }
});

module.exports = router;
