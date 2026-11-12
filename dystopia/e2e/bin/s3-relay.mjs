import fs from "node:fs";
import http from "node:http";
import https from "node:https";

const REQUIRED_ENV = ["RELAY_PORT", "EMULATOR_PORT", "ALLOWED_ORIGIN", "EMULATOR_CA"];
const missing = REQUIRED_ENV.filter((name) => !process.env[name]);
if (missing.length > 0) {
  console.error(`missing environment variables: ${missing.join(", ")}`);
  process.exit(1);
}

const { RELAY_PORT, EMULATOR_PORT, ALLOWED_ORIGIN, EMULATOR_CA } = process.env;
const ca = fs.readFileSync(EMULATOR_CA);

const ALLOW_ORIGIN = { "access-control-allow-origin": ALLOWED_ORIGIN };
const PREFLIGHT_HEADERS = {
  ...ALLOW_ORIGIN,
  "access-control-allow-methods": "GET,PUT",
  "access-control-allow-headers": "content-type",
  "access-control-max-age": "300",
};

// aws-emulator refuses any request that carries browser-origin headers.
const isBrowserOriginHeader = (name) => name === "origin" || name === "referer" || name.startsWith("sec-fetch-");

const forwardedHeaders = (headers) =>
  Object.fromEntries(Object.entries(headers).filter(([name]) => !isBrowserOriginHeader(name)));

const server = http.createServer((req, res) => {
  if (req.method === "OPTIONS") {
    res.writeHead(204, PREFLIGHT_HEADERS);
    res.end();
    return;
  }

  // The Host header is forwarded as received because the emulator verifies the signature against it.
  const upstream = https.request(
    {
      host: "127.0.0.1",
      port: EMULATOR_PORT,
      method: req.method,
      path: req.url,
      headers: forwardedHeaders(req.headers),
      ca,
    },
    (upstreamRes) => {
      console.log(`${req.method} ${req.url.split("?")[0]} ${upstreamRes.statusCode}`);
      res.writeHead(upstreamRes.statusCode, { ...upstreamRes.headers, ...ALLOW_ORIGIN });
      upstreamRes.pipe(res);
    },
  );
  upstream.on("error", (error) => {
    console.error(`${req.method} ${req.url.split("?")[0]} 502 ${error.message}`);
    if (res.headersSent) {
      res.destroy();
      return;
    }
    res.writeHead(502, ALLOW_ORIGIN);
    res.end(error.message);
  });
  res.on("close", () => upstream.destroy());
  req.pipe(upstream);
});

server.listen(Number(RELAY_PORT), "127.0.0.1", () => {
  console.log(`s3 relay listening on 127.0.0.1:${RELAY_PORT}`);
});
