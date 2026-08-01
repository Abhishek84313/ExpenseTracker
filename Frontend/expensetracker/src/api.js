// Base URL of the Spring Boot API.
// Set VITE_API_URL in Vercel to the deployed Render URL; falls back to local dev.
export const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8080";
