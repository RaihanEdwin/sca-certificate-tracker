// Configuration
const API_BASE_URL = window.location.origin + "/api";

// DOM Elements
let searchInput, searchBtn, resultsSection;

// Initialize when DOM is loaded
document.addEventListener("DOMContentLoaded", function () {
  initializeApp();
});

function initializeApp() {
  // Get DOM elements
  searchInput = document.getElementById("searchInput");
  searchBtn = document.getElementById("searchBtn");
  resultsSection = document.getElementById("resultsSection");

  // Add event listeners
  if (searchInput) {
    searchInput.addEventListener("keypress", handleKeyPress);
    searchInput.addEventListener("input", handleInputChange);
  }

  if (searchBtn) {
    searchBtn.addEventListener("click", searchCertificates);
  }

  // Show initial message
  showInitialMessage();
}

function handleKeyPress(event) {
  if (event.key === "Enter") {
    event.preventDefault();
    searchCertificates();
  }
}

function handleInputChange(event) {
  const value = event.target.value.trim();
  if (searchBtn) {
    searchBtn.disabled = value.length === 0;
  }
}

function showInitialMessage() {
  if (resultsSection) {
    resultsSection.innerHTML = `
            <div class="info-message">
                <h3>🎯 Selamat datang di Certificate Tracker!</h3>
                <p>Masukkan nama karyawan untuk mencari sertifikat yang dimiliki.</p>
                <p><strong>Contoh:</strong> Ketik "REZA", "IMAM", atau "ROYYAN"</p>
            </div>
        `;
  }
}

async function searchCertificates() {
  if (!searchInput || !searchBtn || !resultsSection) {
    console.error("Required DOM elements not found");
    return;
  }

  const searchTerm = searchInput.value.trim();

  if (!searchTerm) {
    showError("Silakan masukkan nama yang ingin dicari.");
    return;
  }

  // Show loading state
  setLoadingState(true);

  try {
    const response = await fetch(`${API_BASE_URL}/certificates/search`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        searchTerm: searchTerm,
      }),
    });

    const result = await response.json();
    console.log(result);

    if (!response.ok) {
      throw new Error(
        result.message || `HTTP error! status: ${response.status}`
      );
    }

    if (result.success) {
      if (result.data.results.length === 0) {
        showNoResults(searchTerm);
      } else {
        displayResults(result.data);
      }
    } else {
      throw new Error(result.error || "Unknown error occurred");
    }
  } catch (error) {
    console.error("Error searching certificates:", error);
    showError(`Terjadi kesalahan saat mencari sertifikat: ${error.message}`);
  } finally {
    setLoadingState(false);
  }
}

function setLoadingState(isLoading) {
  if (searchBtn) {
    searchBtn.disabled = isLoading;
    searchBtn.textContent = isLoading ? "🔄 Mencari..." : "🔍 Cari";
  }

  if (isLoading && resultsSection) {
    resultsSection.innerHTML =
      '<div class="loading">Sedang mencari sertifikat...</div>';
  }
}

function displayResults(data) {
  if (!resultsSection) return;

  const { searchTerm, results, count } = data;

  let html = `
        <div class="results-header">
            <h3>📋 Hasil Pencarian: "${searchTerm}"</h3>
            <p>Ditemukan ${count} sertifikat</p>
        </div>
    `;

  if (count > 0) {
    html += `
            <table class="results-table">
                <thead>
                    <tr>
                        <th>Nama</th>
                        <th>Subject Title</th>
                        <th>Expired Date</th>
                        <th>Status</th>
                        <th>Certificate</th>
                    </tr>
                </thead>
                <tbody>
        `;

    results.forEach((cert) => {
      const statusClass = getStatusClass(cert.status);
      const certificateLink =
        cert.certificateLink && cert.certificateLink !== "#"
          ? `<a href="${cert.certificateLink}" target="_blank" class="certificate-link">Lihat</a>`
          : '<span style="color: #999;">-</span>';

      html += `
                <tr>
                    <td><strong>${escapeHtml(cert.name)}</strong></td>
                    <td>${escapeHtml(cert.subjectTitle || "-")}</td>
                    
                    <td>${escapeHtml(cert.expiredDate || "-")}</td>
                    <td><span class="status-badge ${statusClass}">${escapeHtml(
        cert.status || "VALID"
      )}</span></td>
                    <td>${certificateLink}</td>
                </tr>
            `;
    });

    html += `
                </tbody>
            </table>
        `;
  }

  resultsSection.innerHTML = html;
}

function getStatusClass(status) {
  if (!status) return "status-valid";

  const statusLower = status.toLowerCase();

  if (statusLower.includes("expired") && !statusLower.includes("expiring")) {
    return "status-expired";
  } else if (
    statusLower.includes("expiring") ||
    statusLower.includes("akan expired")
  ) {
    return "status-expiring";
  } else {
    return "status-valid";
  }
}

function showNoResults(searchTerm) {
  if (!resultsSection) return;

  resultsSection.innerHTML = `
        <div class="no-results">
            <h3>🔍 Tidak ditemukan</h3>
            <p>Tidak ada sertifikat yang ditemukan untuk nama "${escapeHtml(
              searchTerm
            )}".</p>
            <p><small>Pastikan nama yang Anda masukkan sudah benar atau coba dengan kata kunci yang berbeda.</small></p>
        </div>
    `;
}

function showError(message) {
  if (!resultsSection) return;

  resultsSection.innerHTML = `
        <div class="error-message">
            <strong>❌ Error:</strong> ${escapeHtml(message)}
        </div>
    `;
}

function showSuccess(message) {
  if (!resultsSection) return;

  resultsSection.innerHTML = `
        <div class="success-message">
            <strong>✅ Success:</strong> ${escapeHtml(message)}
        </div>
    `;
}

function escapeHtml(text) {
  if (typeof text !== "string") return text;

  const map = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  };

  return text.replace(/[&<>"']/g, function (m) {
    return map[m];
  });
}

// API Health Check (optional)
async function checkApiHealth() {
  try {
    const response = await fetch(`${API_BASE_URL}/health`);
    const result = await response.json();

    if (result.success) {
      console.log("✅ API is healthy:", result.message);
      return true;
    } else {
      console.warn("⚠️ API health check failed:", result);
      return false;
    }
  } catch (error) {
    console.error("❌ API health check error:", error);
    return false;
  }
}

// Export functions for testing (if needed)
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    searchCertificates,
    displayResults,
    getStatusClass,
    escapeHtml,
    checkApiHealth,
  };
}
