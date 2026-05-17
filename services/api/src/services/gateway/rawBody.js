function registerRawBody(app) {
  const parser = (req, body, done) => {
    req.rawBody = body;
    done(null, body);
  };

  app.addContentTypeParser("application/json", { parseAs: "buffer" }, parser);
  app.addContentTypeParser("application/*+json", { parseAs: "buffer" }, parser);
  app.addContentTypeParser("text/*", { parseAs: "buffer" }, parser);
  app.addContentTypeParser("*", { parseAs: "buffer" }, parser);
}

function parseJsonBody(req) {
  if (req.body && typeof req.body === "object" && !Buffer.isBuffer(req.body)) {
    return req.body;
  }
  const raw = req.rawBody || req.body;
  if (!raw || !raw.length) return {};
  const text = Buffer.isBuffer(raw) ? raw.toString("utf8") : String(raw);
  return JSON.parse(text);
}

export { registerRawBody, parseJsonBody };
