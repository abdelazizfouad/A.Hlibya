import { performance } from "node:perf_hooks";

const baseUrl = (process.env.BASE_URL || "http://127.0.0.1:3000").replace(/\/$/, "");
const requests = [
  ["health", "/api/health"],
  ["bootstrap", "/api/local/bootstrap"],
  ["catalog", "/api/local/parts?page=1&limit=50"],
  ["part-number-search", "/api/local/parts?page=1&limit=50&q=A2233302303"],
  ["inventory", "/api/local/inventory?page=1&limit=50"],
  ["movement-history", "/api/local/movements?page=1&limit=50"],
];

for (const [name, route] of requests) {
  const started = performance.now();
  const response = await fetch(`${baseUrl}${route}`);
  const body = await response.arrayBuffer();
  const elapsed = performance.now() - started;
  console.log(`${name}\t${response.status}\t${elapsed.toFixed(1)} ms\t${body.byteLength} bytes`);
  if (!response.ok) process.exitCode = 1;
}
