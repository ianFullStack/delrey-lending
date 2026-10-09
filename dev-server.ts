// Local preview: bun dev-server.ts  ->  http://localhost:8790
// Serves public/ and runs the same /api/contact function. Without RESEND_API_KEY leads are only logged.
import { onRequestPost } from "./functions/api/contact.js";

const root = new URL("./public/", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const port = Number(process.env.PORT || 8790);

Bun.serve({
  port,
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === "/api/contact" && request.method === "POST") {
      return onRequestPost({ request, env: process.env });
    }
    const path = url.pathname === "/" ? "index.html" : decodeURIComponent(url.pathname.slice(1));
    if (path.includes("..")) return new Response("Not found", { status: 404 });
    const file = Bun.file(root + path);
    return (await file.exists()) ? new Response(file) : new Response("Not found", { status: 404 });
  },
});
console.log(`Del Rey Lending preview on http://localhost:${port}`);
