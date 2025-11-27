// API Configuration
const API_CONFIG = {
  // Cloudflare tunnel URL
  BASE_URL: 'https://api.burntloaf.cafe',
  
  // Fallback to localhost for development
  FALLBACK_URL: 'http://localhost:3000',
  
  // Determine which URL to use
  getApiUrl() {
    // Use tunnel URL if available, otherwise fallback to localhost
    return this.BASE_URL;
  }
};

// Export for use in other files
window.API_CONFIG = API_CONFIG;
