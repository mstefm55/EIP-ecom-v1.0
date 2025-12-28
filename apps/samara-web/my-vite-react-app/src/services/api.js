// src/services/api.js

export async function callEndpoint(endpoint, options = {}) {
  const baseUrl = "http://localhost:3000"; // or your backend URL

  const defaultHeaders = {
    "Content-Type": "application/json",
  };

  const config = {
    headers: { ...defaultHeaders, ...options.headers },
    method: options.method || "GET",
  };

  if (options.body) {
    config.body = JSON.stringify(options.body);
  }

  const response = await fetch(`${baseUrl}${endpoint}`, config);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API Error (${response.status}): ${errorText}`);
  }

  return await response.json();
}
