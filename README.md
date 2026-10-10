# Del Rey Lending website

Plain HTML/CSS/JS replacement for the GoDaddy Website Builder site (delreylending.godaddysites.com).

- `public/` static site: `index.html`, `styles.css`, `app.js` (cookie consent, FAQ chatbot, rate quote wizard, contact form)
- `functions/api/contact.js` Cloudflare Pages Function: emails every lead (contact form, chat, rate quote) to
  loandoc21@gmail.com and monica@delreylending.com via Resend
- `dev-server.ts` local preview: `bun dev-server.ts` -> http://localhost:8790 (without `RESEND_API_KEY` leads are only logged to the console)

## Temporary preview
`bun dev-server.ts` plus `~/bin/cloudflared/cloudflared.exe tunnel --url http://localhost:8790` gives a public trycloudflare.com link that works only while this PC runs both. The link changes every restart.

## Deploy (Cloudflare Pages, free)
1. Create a Cloudflare account, then Workers & Pages > Create > Pages > upload this folder (or connect a GitHub repo).
   Build command: none. Output directory: `public`. The `functions/` folder is picked up automatically.
2. Create a Resend account (free tier 3,000 emails/month), add the domain `delreylending.com`, and add the DNS records it shows.
3. In Pages > Settings > Environment variables set `RESEND_API_KEY` and `MAIL_FROM` = `Del Rey Lending Website <website@delreylending.com>`.
4. Point the domain at Pages (Custom domains > add `delreylending.com` and `www`). **Keep the existing MX records** so
   monica@delreylending.com email keeps working.
5. Once live and tested, cancel the GoDaddy Website Builder plan (keep the domain registration).

## Before launch
- Photos in `public/img/` are GoDaddy stock images, licensed for GoDaddy-hosted sites only. Replace with owned or free-license photos (Unsplash/Pexels).
- Monica does not want a personal bio or personal license number on the site (2026-10-09). Company NMLS 2456300 and phone (310) 415-2039 are shown.
- Add a privacy policy page (the site collects contact info).
- The old site listed "Home Equity Line of Credit Loans (GA)". Confirm what "GA" meant.

## Publishing an update
1. Bump the `?v=` number on styles.css / app.js / calc.js in index.html and refinance.html (browsers cache old copies otherwise).
2. `git commit`, `git push`, then `git subtree split --prefix public -b gh-pages && git push -f origin gh-pages`.

Leads: FormSubmit to loandoc21@gmail.com, cc monica@delreylending.com (activated 2026-10-09 for delreylending.com).
