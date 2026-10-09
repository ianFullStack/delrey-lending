// Cloudflare Pages Function: POST /api/contact
// Emails every website lead to Del Rey Lending via Resend (https://resend.com).
// Env vars (Cloudflare Pages > Settings > Environment variables):
//   RESEND_API_KEY  required to actually send
//   MAIL_FROM       e.g. "Del Rey Lending Website <website@delreylending.com>" (domain must be verified in Resend)
//   MAIL_TO         optional comma list, defaults to the two addresses below

const DEFAULT_TO = ["loandoc21@gmail.com", "monica@delreylending.com", "jacobTurner@delreylending.com"];

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const clean = (v, max) => String(v ?? "").replace(/\r/g, "").trim().slice(0, max);
const esc = (s) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

export async function onRequestPost({ request, env }) {
  let data;
  try { data = await request.json(); } catch { return json({ ok: false, error: "Bad request." }, 400); }

  // Spam traps: hidden honeypot field, and forms submitted faster than a human could type.
  if (data.company || (typeof data.elapsedMs === "number" && data.elapsedMs < 2500)) return json({ ok: true });

  const lead = {
    name: clean(data.name, 120),
    email: clean(data.email, 200),
    phone: clean(data.phone, 40),
    message: clean(data.message, 4000),
    source: clean(data.source, 40) || "Website",
    transcript: clean(data.transcript, 8000),
  };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(lead.email)) return json({ ok: false, error: "Please enter a valid email." }, 400);

  const to = env.MAIL_TO ? env.MAIL_TO.split(",").map((s) => s.trim()).filter(Boolean) : DEFAULT_TO;
  const subject = `New ${lead.source} lead: ${lead.name || lead.email}`;
  const rows = [["Name", lead.name], ["Email", lead.email], ["Phone", lead.phone], ["Source", lead.source], ["Message", lead.message]]
    .filter(([, v]) => v);
  const text = rows.map(([k, v]) => `${k}: ${v}`).join("\n") + (lead.transcript ? `\n\nChat transcript:\n${lead.transcript}` : "");
  const html = `<h2>New website lead</h2><table cellpadding="6">${rows
    .map(([k, v]) => `<tr><td><b>${k}</b></td><td>${esc(v).replace(/\n/g, "<br>")}</td></tr>`).join("")}</table>` +
    (lead.transcript ? `<h3>Chat transcript</h3><pre style="white-space:pre-wrap;font-family:inherit">${esc(lead.transcript)}</pre>` : "");

  if (!env.RESEND_API_KEY) {
    console.log("[contact] RESEND_API_KEY not set, lead NOT emailed:\n" + text);
    return json({ ok: true, dryRun: true });
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: env.MAIL_FROM || "Del Rey Lending Website <onboarding@resend.dev>", to, reply_to: lead.email, subject, text, html }),
  });
  if (!res.ok) {
    console.log("[contact] Resend error", res.status, await res.text());
    return json({ ok: false, error: "Sorry, that didn't go through. Please call us at (310) 415-2039." }, 502);
  }
  return json({ ok: true });
}
