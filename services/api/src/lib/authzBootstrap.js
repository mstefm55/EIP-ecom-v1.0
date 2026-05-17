// src/lib/authzBootstrap.js

function readCookie(name) {
  // simple cookie reader (csrf is NOT HttpOnly in your setup)
  const m = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return m ? decodeURIComponent(m[1]) : null;
}

export async function fetchBootstrap() {
  const csrf = readCookie("csrf");
  if (!csrf) throw new Error("NO_CSRF_COOKIE");

  const res = await fetch("http://127.0.0.1:4000/api/eip/authz/bootstrap", {
    method: "GET",
    credentials: "include",
    headers: {
      "x-csrf": csrf
    }
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = data?.error || `HTTP_${res.status}`;
    throw new Error(err);
  }
  return data; // { ok:true, payload:{...} }
}
