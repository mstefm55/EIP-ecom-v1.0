// scripts/bootstrap.mjs
// Usage:
// node scripts/bootstrap.mjs "sid=...; csrf=...; did=..." "csrfValueHere"

const [cookieHeader, csrf] = process.argv.slice(2);

if (!cookieHeader || !csrf) {
  console.error(
    'Usage: node scripts/bootstrap.mjs "sid=...; csrf=...; did=..." "csrfValue"'
  );
  process.exitCode = 1;
} else {
  try {
    const res = await fetch("http://127.0.0.1:4000/api/eip/authz/bootstrap", {
      method: "GET",
      headers: {
        cookie: cookieHeader,
        "x-csrf": csrf,
      },
    });

    const text = await res.text();
    console.log("HTTP", res.status);
    console.log(text);

    // Set exit code without forcing immediate process exit (Windows-safe)
    process.exitCode = res.ok ? 0 : 2;
  } catch (e) {
    console.error("Request failed:", e?.message || e);
    process.exitCode = 2;
  }
}
