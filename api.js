// All talking to the server happens here.
// VITE_API_URL is only needed if the server lives on a different website.
const BASE = import.meta.env.VITE_API_URL || "";
const TOKEN_KEY = "kavach.token";

export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}
export function saveToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* private mode: the user just has to log in again next time */
  }
}

async function request(method, path, body) {
  const headers = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(BASE + path, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error("Can't reach the Kavach server. Is it running?");
  }

  let data = null;
  try {
    data = await res.json();
  } catch {
    /* no JSON in the answer */
  }
  if (!res.ok) {
    const error = new Error(data?.error || "Something went wrong.");
    error.status = res.status;
    throw error;
  }
  return data;
}

export const api = {
  get: (path) => request("GET", path),
  post: (path, body) => request("POST", path, body),
  patch: (path, body) => request("PATCH", path, body),
};
