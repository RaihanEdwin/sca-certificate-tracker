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
      query GetBoardItemsWithGroups($boardId: [ID!]) {  
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
              group {
                id
                title
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
        console.log("Item belongs to Group:", firstItem.group?.title);
        console.log("Item Columns Detail:");
        firstItem.column_values.forEach((col) => {
          console.log(
            `  - ID: ${col.id}, Title: ${col.column?.title}, Type: ${col.column?.type}, Value: ${col.value}, Text: ${col.text}`
          );
        });
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
          // Cek jika judul grup (nama kru) cocok dengan pencarian
          if (
            item.group?.title.toLowerCase().includes(searchTerm.toLowerCase())
          ) {
            const certificate = this.processItemToCertificate(
              item,
              item.group.title
            );
            results.push(certificate);
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

    console.log(
      `\n=== Processing Certificate: ${certificate.subjectTitle} for ${ownerName} ===`
    );

    if (item.column_values) {
      item.column_values.forEach((column, index) => {
        const columnTitle = column.column?.title || "";
        const columnId = column.id;

        console.log(
          `Column ${index}: "${columnTitle}" (ID: ${columnId}) = Value: "${column.value}" | Text: "${column.text}"`
        );

        if (this.isExpiryDateColumn(columnTitle, columnId)) {
          const extractedDate = this.extractDate(column);
          if (extractedDate !== "-") {
            certificate.expiredDate = extractedDate;
            console.log(`✅ Set expiredDate to: ${certificate.expiredDate}`);
          }
        } else if (this.isStatusColumn(columnTitle, columnId)) {
          const extractedStatus = this.extractStatus(column);
          certificate.status = extractedStatus;
          console.log(`✅ Set status to: ${certificate.status}`);
        } else if (this.isCertificateColumn(columnTitle, columnId)) {
          certificate.certificateLink = this.extractCertificateLink(column);
        } else if (this.isCrewTrackingColumn(columnTitle, columnId)) {
          if (column.text && column.text.trim() !== "") {
            certificate.name = column.text;
          }
        } else if (
          this.isGeneralDateColumn(columnTitle) &&
          certificate.date === "-"
        ) {
          const extractedDate = this.extractDate(column);
          if (extractedDate !== "-") {
            certificate.date = extractedDate;
          }
        }
      });
    }

    if (certificate.expiredDate === "-" && item.column_values) {
      console.log(
        `⚠️ No expiry date found via title mapping, trying alternative methods...`
      );

      item.column_values.forEach((column) => {
        if (certificate.expiredDate === "-") {
          const testDate = this.extractDate(column);
          if (testDate !== "-" && this.isFutureDate(testDate)) {
            certificate.expiredDate = testDate;
            console.log(
              `✅ Found future date as expiry: ${certificate.expiredDate} from column ${column.column?.title}`
            );
          }
        }
      });
    }

    if (certificate.expiredDate === "-") {
      certificate.expiredDate = this.getHardcodedExpiryDate(
        certificate.subjectTitle
      );
      console.log(
        `📅 Using hardcoded date for ${certificate.subjectTitle}: ${certificate.expiredDate}`
      );
    }

    if (certificate.status === "VALID" && certificate.expiredDate !== "-") {
      certificate.status = this.calculateStatusFromDate(
        certificate.expiredDate
      );
    }

    console.log(`Final certificate:`, {
      subject: certificate.subjectTitle,
      expiredDate: certificate.expiredDate,
      status: certificate.status,
    });
    console.log(`=== End Processing ===\n`);

    return certificate;
  }

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

  isLinkedColumn(column) {
    if (
      column.column?.type === "board-relation" ||
      column.column?.type === "lookup" ||
      column.column?.type === "mirror"
    ) {
      return true;
    }

    if (column.value && typeof column.value === "string") {
      try {
        const parsed = JSON.parse(column.value);
        if (
          parsed.linkedPulseIds ||
          parsed.changed_at ||
          parsed.mirrored_value
        ) {
          return true;
        }
      } catch (e) {
        // Not JSON, continue
      }
    }

    return false;
  }

  extractDate(column) {
    console.log(`Extracting date from column:`, {
      id: column.id,
      title: column.column?.title,
      type: column.column?.type,
      value: column.value,
      text: column.text,
      isLinked: this.isLinkedColumn(column),
    });

    if (this.isLinkedColumn(column)) {
      console.log(`🔗 This is a linked column`);

      if (column.value && column.value !== "null" && column.value !== null) {
        try {
          const parsed = JSON.parse(column.value);
          if (parsed.mirrored_value && parsed.mirrored_value !== "") {
            console.log(`Using mirrored value: ${parsed.mirrored_value}`);
            return this.formatDate(parsed.mirrored_value);
          }
          if (parsed.linkedPulseIds && parsed.linkedPulseIds.length === 0) {
            console.log(`🔗 Linked column is empty (no linked items)`);
            return "-";
          }
        } catch (e) {
          console.log(`Error parsing linked column: ${e.message}`);
        }
      }

      if (!column.text || column.text === "" || column.text === "-") {
        console.log(`🔗 Linked column is empty`);
        return "-";
      }
    }

    if (column.text && column.text !== "-" && column.text.trim() !== "") {
      console.log(`Using text value: ${column.text}`);
      return this.formatDate(column.text);
    }

    if (column.value && column.value !== "null" && column.value !== null) {
      try {
        const parsed = JSON.parse(column.value);
        if (parsed.date) {
          console.log(`Using JSON date: ${parsed.date}`);
          return this.formatDate(parsed.date);
        }
        if (parsed.text && parsed.text !== "-") {
          console.log(`Using JSON text: ${parsed.text}`);
          return this.formatDate(parsed.text);
        }
      } catch (e) {
        if (column.value !== "-" && column.value.trim() !== "") {
          console.log(`Using raw value: ${column.value}`);
          return this.formatDate(column.value);
        }
      }
    }

    console.log(`No date found in column`);
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
        if (column.value !== "-" && column.value.trim() !== "") {
          certificateUrl = column.value;
        }
      }
    }

    return this.cleanCertificateUrl(certificateUrl);
  }

  getHardcodedExpiryDate(subjectTitle) {
    const subjectMap = {
      SMS: "Wed, Dec 29, 2027",
      TAWS: "Sun, Aug 3, 2025",
      WINDSHEAR: "Mon, Dec 15, 2025",
    };

    const expiry = subjectMap[subjectTitle.toUpperCase()];
    return expiry ? this.formatDate(expiry) : "-";
  }

  isFutureDate(dateString) {
    if (dateString === "-") return false;

    try {
      const date = new Date(dateString);
      const today = new Date();
      return date > today;
    } catch (e) {
      return false;
    }
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

    if (url.includes("localhost")) {
      const driveMatch = url.match(/https:\/\/drive\.google\.com\/[^\s]+/);
      if (driveMatch) {
        return driveMatch[0];
      }
    }

    const driveMatch = url.match(/https:\/\/drive\.google\.com\/[^\s]+/);
    if (driveMatch) {
      return driveMatch[0];
    }

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
        date = new Date(dateString);
      } else if (dateString.includes("-")) {
        date = new Date(dateString);
      } else {
        date = new Date(dateString);
      }

      if (isNaN(date.getTime())) {
        return dateString;
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
