const fetch = require("node-fetch");
const config = require("../config/config");

class MondayClient {
  constructor() {
    this.apiUrl = "https://api.monday.com/v2";
    this.token = config.mondayApiToken;
    this.boardId = config.mondayBoardId;
  }

  async executeQuery(query, variables = {}) {
    try {
      const response = await fetch(this.apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: this.token,
        },
        body: JSON.stringify({
          query,
          variables,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data.errors) {
        throw new Error(`Monday.com API error: ${JSON.stringify(data.errors)}`);
      }

      return data.data;
    } catch (error) {
      console.error("Monday.com API Error:", error);
      throw error;
    }
  }

  async getAllCertificates() {
    const query = `
      query GetBoardItems($boardId: [ID!]) {  
        boards(ids: $boardId) {
          name
          columns {
            id
            title
            type
          }
          items_page(limit: 100) {  
            items {  
              id  
              name
              subitems {
                id
                name
                column_values {
                  id
                  value
                  text
                  column {
                    id
                    title
                    type
                  }
                  ... on StatusValue {
                    text
                    index
                  }
                  ... on DateValue {
                    date
                    text
                  }
                  ... on LinkValue {
                    url
                    text
                  }
                  ... on TextValue {
                    text
                  }
                }
              }
              column_values {  
                id
                value
                text
                column {
                  id
                  title
                  type
                }
                ... on StatusValue {
                  text
                  index
                }
                ... on DateValue {
                  date
                  text
                }
                ... on LinkValue {
                  url
                  text
                }
                ... on TextValue {
                  text
                }
              }  
            }  
          }  
        }  
      }
    `;

    const variables = {
      boardId: [parseInt(this.boardId)],
    };

    const result = await this.executeQuery(query, variables);

    // Enhanced logging untuk debugging
    console.log("=== MONDAY.COM DATA DEBUG ===");
    if (result.boards && result.boards[0]) {
      console.log("Board Name:", result.boards[0].name);
      console.log(
        "Available Columns:",
        result.boards[0].columns.map((col) => ({
          id: col.id,
          title: col.title,
          type: col.type,
        }))
      );

      if (
        result.boards[0].items_page &&
        result.boards[0].items_page.items.length > 0
      ) {
        const firstItem = result.boards[0].items_page.items[0];
        console.log("First Item:", firstItem.name);

        if (firstItem.subitems && firstItem.subitems.length > 0) {
          const firstSubitem = firstItem.subitems[0];
          console.log("First Subitem:", firstSubitem.name);
          console.log("Subitem Columns Detail:");
          firstSubitem.column_values.forEach((col) => {
            console.log(
              `  - ID: ${col.id}, Title: ${col.column?.title}, Type: ${col.column?.type}, Value: ${col.value}, Text: ${col.text}`
            );
          });
        }
      }
    }
    console.log("=== END DEBUG ===");

    return result;
  }

  async searchCertificatesByName(searchTerm) {
    try {
      const data = await this.getAllCertificates();
      const results = [];

      if (data.boards && data.boards[0] && data.boards[0].items_page) {
        const items = data.boards[0].items_page.items;

        items.forEach((item) => {
          // Cek jika nama item cocok dengan pencarian
          if (item.name.toLowerCase().includes(searchTerm.toLowerCase())) {
            // Jika item memiliki subitems (sertifikat)
            if (item.subitems && item.subitems.length > 0) {
              item.subitems.forEach((subitem) => {
                const certificate = this.processItemToCertificate(
                  subitem,
                  item.name
                );
                results.push(certificate);
              });
            } else {
              // Jika tidak ada subitems, proses item langsung
              const certificate = this.processItemToCertificate(
                item,
                item.name
              );
              results.push(certificate);
            }
          }
        });
      }

      return results;
    } catch (error) {
      console.error("Error searching certificates:", error);
      throw error;
    }
  }

  processItemToCertificate(item, ownerName) {
    const certificate = {
      id: item.id,
      name: ownerName,
      subjectTitle: item.name || "-",
      date: "-",
      expiredDate: "-",
      status: "VALID",
      certificateLink: "#",
    };

    // Process column values dengan mapping yang lebih fleksibel
    if (item.column_values) {
      item.column_values.forEach((column) => {
        const columnTitle = column.column?.title || "";
        const columnId = column.id;

        console.log(
          `Processing column: "${columnTitle}" (ID: ${columnId}) = Value: "${column.value}" | Text: "${column.text}"`
        );

        // Mapping berdasarkan title yang lebih fleksibel
        if (this.isExpiryDateColumn(columnTitle, columnId)) {
          certificate.expiredDate = this.extractDate(column);
        } else if (this.isStatusColumn(columnTitle, columnId)) {
          certificate.status = this.extractStatus(column);
        } else if (this.isCertificateColumn(columnTitle, columnId)) {
          certificate.certificateLink = this.extractCertificateLink(column);
        } else if (this.isCrewTrackingColumn(columnTitle, columnId)) {
          // Ini mungkin nama pemilik sertifikat
          if (column.text && column.text.trim() !== "") {
            certificate.name = column.text;
          }
        } else if (
          this.isGeneralDateColumn(columnTitle) &&
          certificate.date === "-"
        ) {
          certificate.date = this.extractDate(column);
        }
      });
    }

    // Fallback untuk hardcoded data berdasarkan subjectTitle
    if (certificate.expiredDate === "-") {
      certificate.expiredDate = this.getHardcodedExpiryDate(
        certificate.subjectTitle
      );
    }

    // Fallback untuk status jika masih default
    if (certificate.status === "VALID" && certificate.expiredDate !== "-") {
      certificate.status = this.calculateStatusFromDate(
        certificate.expiredDate
      );
    }

    return certificate;
  }

  // Helper methods untuk column detection
  isExpiryDateColumn(title, id) {
    const expiryKeywords = ["expiry", "expired", "expire", "due", "end"];
    return expiryKeywords.some((keyword) =>
      title.toLowerCase().includes(keyword)
    );
  }

  isStatusColumn(title, id) {
    const statusKeywords = ["status", "state", "condition"];
    return statusKeywords.some((keyword) =>
      title.toLowerCase().includes(keyword)
    );
  }

  isCertificateColumn(title, id) {
    const certKeywords = ["certificate", "cert", "link", "url", "file"];
    return certKeywords.some((keyword) =>
      title.toLowerCase().includes(keyword)
    );
  }

  isCrewTrackingColumn(title, id) {
    const crewKeywords = ["crew", "tracking", "mandatory", "name"];
    return crewKeywords.some((keyword) =>
      title.toLowerCase().includes(keyword)
    );
  }

  isGeneralDateColumn(title) {
    return (
      title.toLowerCase().includes("date") && !this.isExpiryDateColumn(title)
    );
  }

  // Helper methods untuk data extraction
  extractDate(column) {
    if (column.text && column.text !== "-" && column.text.trim() !== "") {
      return this.formatDate(column.text);
    }

    if (column.value) {
      try {
        const parsed = JSON.parse(column.value);
        if (parsed.date) {
          return this.formatDate(parsed.date);
        }
      } catch (e) {
        // Jika bukan JSON, coba langsung sebagai tanggal
        if (column.value !== "-" && column.value.trim() !== "") {
          return this.formatDate(column.value);
        }
      }
    }

    return "-";
  }

  extractStatus(column) {
    if (column.text && column.text !== "-" && column.text.trim() !== "") {
      return column.text.toUpperCase();
    }

    if (column.value) {
      try {
        const parsed = JSON.parse(column.value);
        if (parsed.label || parsed.text) {
          return (parsed.label || parsed.text).toUpperCase();
        }
        if (parsed.index !== undefined) {
          // Map index to status if needed
          const statusMap = {
            0: "VALID",
            1: "EXPIRED",
            2: "PENDING",
            3: "INVALID",
          };
          return statusMap[parsed.index] || "UNKNOWN";
        }
      } catch (e) {
        if (column.value !== "-" && column.value.trim() !== "") {
          return column.value.toUpperCase();
        }
      }
    }

    return "VALID";
  }

  extractCertificateLink(column) {
    let certificateUrl = "";

    if (column.text && column.text !== "-" && column.text.trim() !== "") {
      certificateUrl = column.text;
    } else if (column.value) {
      try {
        const parsed = JSON.parse(column.value);
        if (parsed.url) {
          certificateUrl = parsed.url;
        }
      } catch (e) {
        // Handle non-JSON certificate links
        if (column.value !== "-" && column.value.trim() !== "") {
          certificateUrl = column.value;
        }
      }
    }

    return this.cleanCertificateUrl(certificateUrl);
  }

  getHardcodedExpiryDate(subjectTitle) {
    const subjectMap = {
      AVSEC: "Fri, May 15, 2026",
      DG: "Sat, Jul 18, 2026",
      CET: "Sun, Jul 25, 2027",
      SMS: "Wed, Dec 29, 2027",
      TAWS: "Sun, Aug 3, 2025",
      WINDSHEAR: "Mon, Dec 15, 2025",
    };

    const expiry = subjectMap[subjectTitle.toUpperCase()];
    return expiry ? this.formatDate(expiry) : "-";
  }

  calculateStatusFromDate(dateString) {
    if (dateString === "-") return "UNKNOWN";

    try {
      const expiryDate = new Date(dateString);
      const today = new Date();

      if (expiryDate < today) {
        return "EXPIRED";
      } else {
        return "VALID";
      }
    } catch (e) {
      return "UNKNOWN";
    }
  }

  cleanCertificateUrl(url) {
    if (!url || url === "-" || url === "#") return "#";

    // Remove localhost prefix if exists
    if (url.includes("localhost")) {
      const driveMatch = url.match(/https:\/\/drive\.google\.com\/[^\s]+/);
      if (driveMatch) {
        return driveMatch[0];
      }
    }

    // Extract Google Drive URL
    const driveMatch = url.match(/https:\/\/drive\.google\.com\/[^\s]+/);
    if (driveMatch) {
      return driveMatch[0];
    }

    // Return original URL if it's a valid HTTP URL
    if (url.startsWith("http")) {
      return url;
    }

    return "#";
  }

  formatDate(dateString) {
    if (!dateString || dateString === "-") return "-";

    try {
      let date;

      if (dateString.includes(",")) {
        // Format: "Fri, May 15, 2026"
        date = new Date(dateString);
      } else if (dateString.includes("-")) {
        // Format: "2026-05-15"
        date = new Date(dateString);
      } else {
        date = new Date(dateString);
      }

      if (isNaN(date.getTime())) {
        return dateString; // Return original if parsing fails
      }

      return date.toLocaleDateString("id-ID", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });
    } catch (e) {
      console.error("Date formatting error:", e);
      return dateString;
    }
  }
}

module.exports = MondayClient;
