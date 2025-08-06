// js/script.js - Updated for Vercel Deployment

// API Configuration
const API_BASE_URL = "/api/certificates"; // Vercel serverless endpoint

// DOM Elements
const searchInput = document.getElementById("searchInput");
const searchBtn = document.getElementById("searchBtn");
const resultsSection = document.getElementById("resultsSection");
const loadingSpinner = document.createElement("div");

// Initialize app
document.addEventListener("DOMContentLoaded", function () {
  initializeApp();
});

function initializeApp() {
  // Setup loading spinner
  loadingSpinner.className = "loading-spinner";
  loadingSpinner.innerHTML = `
        <div style="text-align: center; padding: 20px;">
            <div style="border: 4px solid #f3f3f3; border-top: 4px solid #3498db; border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite; margin: 0 auto;"></div>
            <p style="margin-top: 10px; color: #666;">Mencari sertifikat...</p>
        </div>
    `;

  // Add CSS for loading animation
  const style = document.createElement("style");
  style.textContent = `
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
    `;
  document.head.appendChild(style);

  // Event listeners
  searchBtn.addEventListener("click", handleSearch);
  searchInput.addEventListener("keypress", function (e) {
    if (e.key === "Enter") {
      handleSearch();
    }
  });

  // Enable search button when user types
  searchInput.addEventListener("input", function () {
    const hasInput = this.value.trim().length > 0;
    searchBtn.disabled = !hasInput;
    searchBtn.style.opacity = hasInput ? "1" : "0.6";
  });
}

async function handleSearch() {
  const searchTerm = searchInput.value.trim();

  if (!searchTerm) {
    showError("Masukkan nama karyawan untuk mencari sertifikat");
    return;
  }

  // Disable button dan show loading
  searchBtn.disabled = true;
  searchBtn.textContent = "Mencari...";
  showLoading();

  try {
    const result = await searchCertificates(searchTerm);

    if (result.success) {
      displayResults(result.data);
    } else {
      showError(result.error || "Terjadi kesalahan saat mencari sertifikat");
    }
  } catch (error) {
    console.error("Search failed:", error);
    showError("Koneksi bermasalah. Silakan coba lagi.");
  } finally {
    // Re-enable button
    searchBtn.disabled = false;
    searchBtn.textContent = "🔍 Cari";
  }
}

async function searchCertificates(searchTerm) {
  try {
    const response = await fetch(API_BASE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ searchTerm }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error("API Error:", error);

    // Return user-friendly error
    if (error.name === "TypeError" && error.message.includes("fetch")) {
      return {
        success: false,
        error:
          "Tidak dapat terhubung ke server. Periksa koneksi internet Anda.",
      };
    }

    return {
      success: false,
      error: error.message || "Terjadi kesalahan tidak diketahui",
    };
  }
}

function displayResults(data) {
  const { searchTerm, results, count } = data;

  if (!results || count === 0) {
    showEmptyResults(searchTerm);
    return;
  }

  resultsSection.innerHTML = `
        <div class="results-header">
            <h3>📋 Hasil Pencarian: "${searchTerm}"</h3>
            <p>Ditemukan ${count} sertifikat</p>
        </div>
        
        <div class="results-table">
            <table class="certificate-table">
                <thead>
                    <tr>
                        <th>Nama</th>
                        <th>Subject Title</th>
                        <th>Date</th>
                        <th>Expired Date</th>
                        <th>Status</th>
                        <th>Certificate</th>
                    </tr>
                </thead>
                <tbody>
                    ${results
                      .map((cert) => createCertificateRow(cert))
                      .join("")}
                </tbody>
            </table>
        </div>
    `;

  resultsSection.style.display = "block";
}

function createCertificateRow(certificate) {
  const { name, subjectTitle, date, expiredDate, status, certificateLink } =
    certificate;

  // Determine status class
  const statusClass = getStatusClass(status, expiredDate);

  // Format certificate link
  const linkHTML =
    certificateLink && certificateLink !== "#"
      ? `<a href="${certificateLink}" target="_blank" class="certificate-link">📄 Lihat</a>`
      : '<span class="no-certificate">-</span>';

  return `
        <tr>
            <td class="name-cell">${name || "-"}</td>
            <td class="subject-cell">${subjectTitle || "-"}</td>
            <td class="date-cell">${date || "-"}</td>
            <td class="expired-date-cell">${expiredDate || "-"}</td>
            <td class="status-cell">
                <span class="status-badge ${statusClass}">${
    status || "UNKNOWN"
  }</span>
            </td>
            <td class="certificate-cell">${linkHTML}</td>
        </tr>
    `;
}

function getStatusClass(status, expiredDate) {
  if (!status) return "status-unknown";

  const statusUpper = status.toUpperCase();

  if (statusUpper.includes("VALID")) return "status-valid";
  if (statusUpper.includes("EXPIRED")) return "status-expired";
  if (statusUpper.includes("PENDING")) return "status-pending";

  // Check expiry date
  if (expiredDate && expiredDate !== "-") {
    try {
      const expiry = new Date(expiredDate);
      const now = new Date();

      if (expiry < now) return "status-expired";
    } catch (e) {
      console.warn("Invalid date format:", expiredDate);
    }
  }

  return "status-valid";
}

function showEmptyResults(searchTerm) {
  resultsSection.innerHTML = `
        <div class="empty-results">
            <div class="empty-icon">🔍</div>
            <h3>Tidak Ada Hasil</h3>
            <p>Tidak ditemukan sertifikat untuk "<strong>${searchTerm}</strong>"</p>
            <div class="empty-suggestions">
                <h4>Saran:</h4>
                <ul>
                    <li>Periksa ejaan nama</li>
                    <li>Coba gunakan nama lengkap atau nama panggilan</li>
                    <li>Gunakan kata kunci yang lebih umum</li>
                </ul>
            </div>
        </div>
    `;

  resultsSection.style.display = "block";
}

function showError(message) {
  resultsSection.innerHTML = `
        <div class="error-message">
            <div class="error-icon">⚠️</div>
            <h3>Terjadi Kesalahan</h3>
            <p>${message}</p>
            <button onclick="location.reload()" class="retry-btn">🔄 Coba Lagi</button>
        </div>
    `;

  resultsSection.style.display = "block";
}

function showLoading() {
  resultsSection.innerHTML = "";
  resultsSection.appendChild(loadingSpinner);
  resultsSection.style.display = "block";
}

// Utility function to get all certificates (optional)
async function getAllCertificates() {
  try {
    const response = await fetch(API_BASE_URL, {
      method: "GET",
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error("Error fetching all certificates:", error);
    return { success: false, error: error.message };
  }
}

// Export for testing (if needed)
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    searchCertificates,
    getAllCertificates,
  };
}
