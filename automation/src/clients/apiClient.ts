
import axios from 'axios';

// ======================================================
// API CONFIGURATION
// ======================================================

const baseURL = process.env.API_BASE_URL;

if (!baseURL) {
    throw new Error(
        '[CONFIG ERROR] API_BASE_URL belum dikonfigurasi.'
    );
}

// ======================================================
// REUSABLE AXIOS CLIENT
// ======================================================

export const apiClient = axios.create({
    baseURL,
    timeout: 10000,

    headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json'
    },

    // Agar status 4xx dan 5xx dapat diuji
    // menggunakan assertion pada negative testing.
    validateStatus: () => true
});
