(() => {
  "use strict";
  const $ = (s) => document.querySelector(s);
  $("#year").textContent = new Date().getFullYear();

  // ---------- Cookie consent ----------
  // "necessary" = nothing optional loads. "all" = optional third-party embeds (Google Map) may load.
  const CONSENT_KEY = "drl-consent";
  const getConsent = () => { try { return localStorage.getItem(CONSENT_KEY); } catch { return null; } };
  const setConsent = (v) => { try { localStorage.setItem(CONSENT_KEY, v); } catch {} };
  const banner = $("#cookie");

  function loadMap() {
    const map = $("#map");
    if (map.querySelector("iframe")) return;
    map.innerHTML = '<iframe title="Map to Del Rey Lending" loading="lazy" referrerpolicy="no-referrer-when-downgrade" ' +
      'src="https://www.google.com/maps?q=11500+Olympic+Blvd+Suite+400,+Los+Angeles,+CA+90064&output=embed"></iframe>';
  }
  function applyConsent(v) { if (v === "all") loadMap(); }

  const existing = getConsent();
  if (existing) applyConsent(existing); else banner.hidden = false;
  banner.addEventListener("click", (e) => {
    const v = e.target.closest("[data-consent]")?.dataset.consent;
    if (!v) return;
    setConsent(v); banner.hidden = true; applyConsent(v);
  });
  $("#cookie-settings").addEventListener("click", () => { banner.hidden = false; });
  $("#load-map").addEventListener("click", loadMap); // explicit one-time click is consent for the map only

  // ---------- Lead submission (shared by form + chat) ----------
  // Leads are emailed by FormSubmit (formsubmit.co). Locally, dev-server.ts handles /api/contact instead.
  const LEAD_TO = "loandoc21@gmail.com";
  const LEAD_CC = "monica@delreylending.com";
  const LOCAL = ["localhost", "127.0.0.1"].includes(location.hostname);
  async function sendLead(data) {
    const failMsg = "Sorry, that didn't go through. Please call us at (310) 415-2039.";
    if (LOCAL) {
      const res = await fetch("/api/contact", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.ok) throw new Error(body.error || failMsg);
      return;
    }
    if (data.company || (data.elapsedMs ?? 9999) < 2500) return; // spam trap: pretend success
    const payload = {
      _subject: `New ${data.source || "website"} lead: ${data.name || data.email}`,
      _cc: LEAD_CC, _template: "table", _captcha: "false",
      Name: data.name, Email: data.email, Phone: data.phone || "", Source: data.source,
      Message: data.message || "", ...(data.transcript ? { "Chat transcript": data.transcript } : {}),
      _replyto: data.email,
    };
    const res = await fetch("https://formsubmit.co/ajax/" + LEAD_TO, {
      method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(payload),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok || String(body.success) !== "true") throw new Error(failMsg);
  }
  const validEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

  const form = $("#contact-form");
  const startedAt = Date.now();
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const status = form.querySelector(".form-status");
    const data = Object.fromEntries(new FormData(form));
    status.className = "form-status";
    if (!validEmail(data.email || "")) { status.textContent = "Please enter a valid email."; status.classList.add("err"); return; }
    status.textContent = "Sending...";
    try {
      await sendLead({ ...data, source: "Contact form", elapsedMs: Date.now() - startedAt });
      form.reset();
      status.textContent = "Thank you! We'll be in touch soon."; status.classList.add("ok");
    } catch (err) { status.textContent = err.message; status.classList.add("err"); }
  });

  // ---------- Chatbot ----------
  // Answers general questions first. Personal info is only requested when the visitor asks to be contacted.
  const NOTE = "General information only, not a loan offer or commitment to lend.";
  const FAQ = [
    { id: "loans", chip: "What loans do you offer?", keys: ["loan type", "loans do you", "offer", "products", "programs", "options", "what kind"],
      a: "We help with:\n- Home purchases and refinances\n- Fixed rate and adjustable rate (ARM) mortgages\n- FHA loans\n- VA loans\n- Home Equity Lines of Credit (HELOC)\n- Residential, investment and commercial property financing" },
    { id: "fha", keys: ["fha"],
      a: "FHA loans are insured by the Federal Housing Administration. They are popular with first-time buyers because they typically allow a down payment as low as 3.5% and more flexible credit guidelines. They do include mortgage insurance." },
    { id: "va", keys: [" va ", "va loan", "veteran", "military", "service member"],
      a: "VA loans are for eligible veterans, active-duty service members and some surviving spouses. They typically allow 0% down and have no monthly mortgage insurance. You'll need a Certificate of Eligibility, which we can help you get." },
    { id: "arm", chip: "Fixed vs. adjustable?", keys: ["fixed", " arm ", " arms ", "adjustable", "variable"],
      a: "A fixed rate loan keeps the same interest rate for the whole term, so your principal and interest payment never changes. An adjustable rate mortgage (ARM) starts with a set rate for a few years (for example 5, 7 or 10) and then adjusts periodically. ARMs can make sense if you expect to move or refinance before the adjustment period." },
    { id: "refi", chip: "Should I refinance?", keys: ["refi", "refinanc", "cash out", "cash-out", "lower my payment"],
      a: "People refinance to lower their rate or payment, shorten their term, switch from an ARM to a fixed rate, or take cash out of their equity. Whether it makes sense depends on your current rate, how long you plan to stay, and closing costs. Try our refinance calculator to estimate your new payment and break-even point. The rate you enter is only an estimate, so talk to a loan officer for your real rate and terms.", calc: true },
    { id: "heloc", keys: ["heloc", "equity", "line of credit", "second mortgage"],
      a: "A Home Equity Line of Credit (HELOC) lets you borrow against your home's equity as needed, like a credit card secured by your home, while keeping your first mortgage in place. It's often used for renovations or consolidating higher-interest debt." },
    { id: "down", chip: "How much down payment?", keys: ["down payment", "downpayment", "how much down", "put down", "20%"],
      a: "It depends on the program. Typical minimums: VA 0% (eligible borrowers), conventional as low as 3% for some first-time buyers, FHA 3.5%. We also offer down payment assistance programs. Putting down 20% on a conventional loan avoids private mortgage insurance, but it isn't required." },
    { id: "credit", keys: ["credit", "score", "fico"],
      a: "Credit requirements vary by program. FHA is generally the most flexible, and conventional loans usually look for higher scores. A higher score typically means a better rate. Even if your credit isn't perfect, it's worth a conversation." },
    { id: "docs", chip: "What documents do I need?", keys: ["document", "paperwork", "need to apply", "what do i need", "requirements"],
      a: "Commonly requested items:\n- Photo ID\n- Recent pay stubs (about 30 days)\n- W-2s and/or tax returns (usually 2 years)\n- Recent bank statements (usually 2 months)\n- If self-employed: business returns and a year-to-date profit and loss\nWe'll give you an exact list for your situation." },
    { id: "preapproval", chip: "Pre-approval?", keys: ["pre-approv", "preapprov", "pre approv", "prequal", "pre-qual", "qualify"],
      a: "Pre-qualification is a quick estimate based on what you tell us. Pre-approval goes further: we review your income, assets and credit, so sellers take your offer more seriously. We recommend getting pre-approved before you start making offers." },
    { id: "closing", keys: ["closing cost", "fees", "cost to close", "how much does it cost"],
      a: "Closing costs often run roughly 2% to 5% of the loan amount and include things like appraisal, title, escrow and lender fees. You'll receive an official Loan Estimate itemizing them so you can compare." },
    { id: "time", keys: ["how long", "timeline", "close in", "days to close", "how fast"],
      a: "Many purchase loans close in about 30 to 45 days once you're under contract, depending on the loan type, appraisal and how quickly documents come in." },
    { id: "rates", chip: "What are your rates?", keys: ["rate", "interest", "apr"],
      a: "Rates change daily and depend on the loan type, credit score, down payment, property and loan amount, so we can't quote a single number here. A loan officer can give you a personalized quote, usually the same day." , offerContact: true },
    { id: "hours", keys: ["hour", "open", "when are you", "saturday", "sunday"],
      a: "Our hours: Monday to Friday 9am to 5pm, Saturday by appointment, closed Sunday. You can call us at (310) 415-2039." },
    { id: "where", keys: ["where", "address", "located", "location", "office"],
      a: "We're at 11500 Olympic Blvd, Suite 400, Los Angeles, CA 90064. Phone: (310) 415-2039." },
    { id: "states", keys: ["what states", "which states", "other states", "out of state", "licensed in", "outside california", "other state", "nevada", "arizona", "texas", "florida", "oregon", "washington", "new york", "nationwide", "where do you lend", "do you lend in"],
      a: "We make loans in California only. If your property is in California, we're happy to help: call (310) 415-2039 or ask me anything here." },
    { id: "phone", keys: ["phone", "number", "call you", "telephone"],
      a: "You can reach us at (310) 415-2039, Monday to Friday 9am to 5pm, and Saturday by appointment." },
    { id: "spanish", chip: "¿Hablan español?", keys: ["spanish", "español", "espanol", "habla", "hablan"],
      a: "¡Sí! Hablamos español. Con gusto le ayudamos con su préstamo en español. Llámenos al (310) 415-2039.\n\nYes, we speak Spanish." },
    { id: "dpa", chip: "Down payment assistance?", keys: ["down payment assist", "downpayment assist", "assistance", "dpa", "grant", "help with down"],
      a: "Yes, we offer down payment assistance. Programs vary by location, income and purchase price, and some can be combined with FHA or conventional loans. We'll check which ones you qualify for." },
    { id: "commercial", keys: ["commercial", "investment property", "rental", "investor", "business property"],
      a: "Yes, we do commercial and residential loans, including financing for investment and rental properties. Terms depend on the property type and your plans for it, so a quick conversation is the best place to start." },
    { id: "nmls", keys: ["nmls", "license", "licensed"],
      a: "Del Rey Lending's Company NMLS ID is 2456300. You can verify it at nmlsconsumeraccess.org." },
    { id: "cost", keys: ["free", "charge for a consult", "cost to talk"],
      a: "Talking with us about your options is free, with no obligation." },
    { id: "first", keys: ["first time", "first-time", "first home", "never bought"],
      a: "Welcome! First-time buyers often look at FHA or low-down-payment conventional loans, and there may be down payment assistance programs available. The best first step is a pre-approval so you know your budget." },
  ];
  const CONTACT_KEYS = ["talk to", "speak", "call me", "contact", "human", "person", "loan officer", "apply", "quote", "get started", "reach"];
  const GREETING_KEYS = ["hi", "hello", "hey", "good morning", "good afternoon"];

  const chat = $("#chat"), log = $("#chat-log"), chips = $("#chat-chips"), launch = $("#chat-launch");
  let started = false, answered = 0, leadOpen = false;

  function addMsg(text, who = "bot", note) {
    const div = document.createElement("div");
    div.className = "msg " + who;
    div.textContent = text;
    if (note) { const s = document.createElement("small"); s.textContent = note; div.appendChild(s); }
    log.appendChild(div); log.scrollTop = log.scrollHeight;
    return div;
  }
  function setChips(list) {
    chips.innerHTML = "";
    list.forEach(({ label, run }) => {
      const b = document.createElement("button");
      b.type = "button"; b.className = "chip"; b.textContent = label;
      b.addEventListener("click", () => { addMsg(label, "user"); run(); });
      chips.appendChild(b);
    });
  }
  const contactChip = { label: "Talk to a loan officer", run: () => openLead() };
  const calcChip = { label: "Open the refinance calculator", run: () => { toggleChat(false); openCalc(); } };
  const quoteChip = { label: "Get my rate quote now", run: () => { addMsg("Opening the rate quote form for you."); openQuote(); } };
  function defaultChips() {
    setChips([...FAQ.filter((f) => f.chip).map((f) => ({ label: f.chip, run: () => answer(f) })), contactChip]);
  }
  function answer(f) {
    answered++;
    addMsg(f.a, "bot", NOTE);
    if (f.offerContact || f.calc || answered >= 3) {
      setChips([...(f.calc ? [calcChip] : []), ...(f.offerContact ? [quoteChip] : []), contactChip, { label: "I have another question", run: () => { addMsg("Sure, ask away!"); defaultChips(); } }]);
    } else defaultChips();
  }

  function match(text) {
    const t = " " + text.toLowerCase().replace(/[?!.,]/g, " ") + " ";
    if (CONTACT_KEYS.some((k) => t.includes(k))) return "contact";
    let best = null, bestScore = 0;
    for (const f of FAQ) {
      const score = f.keys.reduce((n, k) => n + (t.includes(k) ? k.length : 0), 0);
      if (score > bestScore) { best = f; bestScore = score; }
    }
    if (best) return best;
    if (GREETING_KEYS.some((k) => t.trim().startsWith(k))) return "greet";
    return null;
  }

  function handleText(text) {
    const m = match(text);
    if (m === "contact") return openLead();
    if (m === "greet") { addMsg("Hi! What would you like to know about home loans?"); return defaultChips(); }
    if (m) return answer(m);
    addMsg("Good question. I may not have a general answer for that one, but a loan officer can help. You can pick a topic below or ask to talk to someone.");
    setChips([contactChip, ...FAQ.filter((f) => f.chip).slice(0, 4).map((f) => ({ label: f.chip, run: () => answer(f) }))]);
  }

  function openLead() {
    if (leadOpen) return;
    leadOpen = true;
    addMsg("Happy to connect you with a loan officer. Share how to reach you and we'll follow up, usually the same business day. Or call us now at (310) 415-2039.");
    const wrap = document.createElement("form");
    wrap.className = "chat-lead";
    wrap.innerHTML =
      '<input name="name" placeholder="Name" autocomplete="name" required>' +
      '<input name="email" type="email" placeholder="Email" autocomplete="email" required>' +
      '<input name="phone" type="tel" placeholder="Phone (optional)" autocomplete="tel">' +
      '<textarea name="message" rows="2" placeholder="Anything we should know? (optional)"></textarea>' +
      '<label><input type="checkbox" name="consent" required> I agree to be contacted by Del Rey Lending about my inquiry.</label>' +
      '<button class="btn" type="submit">Send</button>';
    log.appendChild(wrap); log.scrollTop = log.scrollHeight;
    setChips([{ label: "Never mind, keep asking questions", run: () => { wrap.remove(); leadOpen = false; addMsg("No problem. What else would you like to know?"); defaultChips(); } }]);
    wrap.querySelector("input").focus();
    wrap.addEventListener("submit", async (e) => {
      e.preventDefault();
      const d = Object.fromEntries(new FormData(wrap));
      if (!validEmail(d.email || "")) { addMsg("That email doesn't look right, could you check it?"); return; }
      const transcript = [...log.querySelectorAll(".msg")].map((m) => (m.classList.contains("user") ? "Visitor: " : "Bot: ") + m.firstChild.textContent).join("\n");
      wrap.querySelector("button").disabled = true;
      try {
        await sendLead({ name: d.name, email: d.email, phone: d.phone, message: d.message, source: "Website chat", transcript, elapsedMs: Date.now() - startedAt });
        wrap.remove(); leadOpen = false;
        addMsg(`Thanks, ${d.name.split(" ")[0] || "there"}! A loan officer will reach out soon. Anything else I can answer meanwhile?`);
        defaultChips();
      } catch (err) { wrap.querySelector("button").disabled = false; addMsg(err.message); }
    });
  }

  function toggleChat(open) {
    chat.hidden = !open; launch.setAttribute("aria-expanded", String(open));
    if (open && !started) {
      started = true;
      addMsg("Hi! I'm the Del Rey Lending assistant. Ask me anything about buying, refinancing, FHA, VA or other home loans. No personal info needed to ask questions. Hablamos español.");
      defaultChips();
    }
    if (open) $("#chat-text").focus();
  }
  launch.addEventListener("click", () => toggleChat(chat.hidden));
  $("#chat-close").addEventListener("click", () => toggleChat(false));
  $("#chat-input").addEventListener("submit", (e) => {
    e.preventDefault();
    const input = $("#chat-text"); const text = input.value.trim();
    if (!text) return;
    input.value = ""; addMsg(text, "user"); handleText(text);
  });

  // ---------- Rate quote wizard ----------
  // Collects the scenario first, contact details last; emailed to the team as a "Rate quote" lead.
  const Q = { answers: {}, i: 0 };
  const opt = (key, title, sub, options) => ({ key, title, sub, options });
  const STEPS = [
    { key: "zip", title: "Today's mortgage rates", sub: "Rates change daily and depend on your situation. Start with your ZIP code for a free custom quote.",
      field: { type: "text", label: "Property ZIP code", inputmode: "numeric", maxlength: 5, autocomplete: "postal-code" },
      // California ZIP codes run 90001-96162 (prefixes 900-961).
      valid: (v) => !/^\d{5}$/.test(v) ? "Please enter a 5-digit ZIP code."
        : (+v.slice(0, 3) >= 900 && +v.slice(0, 3) <= 961) ? true
        : "Sorry, we only make loans in California. Please enter a California ZIP code, or call us at (310) 415-2039 with any questions." },
    opt("purpose", "What would you like to do?", "", ["Buy a home", "Refinance", "Cash-out refinance", "Home equity line (HELOC)"]),
    opt("property", "What type of property?", "", ["Single family", "Condo / townhome", "Multi-unit (2-4)", "Commercial"]),
    opt("use", "How will the property be used?", "", ["Primary residence", "Second home", "Investment property"]),
    { key: "value", title: (a) => a.purpose === "Buy a home" ? "Estimated purchase price?" : "Estimated home value?",
      field: { type: "select", label: "Choose a range", options: ["Under $400K", "$400K - $700K", "$700K - $1M", "$1M - $1.5M", "$1.5M - $2.5M", "Over $2.5M"] } },
    { key: "amount", title: (a) => a.purpose === "Buy a home" ? "How much do you plan to put down?" : "About how much do you owe on the home?",
      field: { type: "select", label: "Choose one", options: (a) => a.purpose === "Buy a home"
        ? ["0% (VA or special program)", "3% - 5%", "5% - 10%", "10% - 20%", "20% or more", "Not sure yet"]
        : ["Nothing, it's paid off", "Under $200K", "$200K - $500K", "$500K - $800K", "$800K - $1.2M", "Over $1.2M"] } },
    opt("credit", "Estimated credit score?", "An estimate is fine. Getting a quote does not affect your credit.", ["Excellent (740+)", "Good (680 - 739)", "Fair (620 - 679)", "Below 620", "Not sure"]),
    opt("military", "Have you or your spouse served in the military?", "Eligible veterans may qualify for a VA loan.", ["Yes", "No"]),
    opt("timeline", "When are you looking to move forward?", "", ["Right away", "Within 30 days", "1 - 3 months", "Just researching"]),
    { key: "contact", title: "Where should we send your quote?", sub: "A licensed loan officer will email or call you with your personalized rates, usually the same business day.", contact: true },
  ];
  const qEl = $("#quote"), qStep = $("#quote-step"), qErr = document.querySelector(".quote-error"), qNext = $("#quote-next"), qBack = $("#quote-back");
  const val = (x) => (typeof x === "function" ? x(Q.answers) : x);
  const attr = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
  let lastFocus = null;

  function renderStep() {
    const st = STEPS[Q.i], a = Q.answers;
    qErr.textContent = "";
    $("#quote-bar").style.width = Math.round((Q.i / STEPS.length) * 100) + "%";
    qBack.style.visibility = Q.i === 0 ? "hidden" : "visible";
    qNext.textContent = st.contact ? "Get my quote" : Q.i === 0 ? "Go" : "Next";
    qNext.hidden = !!st.options;
    let html = `<h3 id="quote-title">${val(st.title)}</h3>` + (st.sub ? `<p class="quote-sub">${st.sub}</p>` : "");
    if (st.options) {
      html += '<div class="quote-options">' + st.options.map((o) =>
        `<button type="button" class="quote-option" data-value="${attr(o)}" aria-pressed="${a[st.key] === o}">${o}</button>`).join("") + "</div>";
    } else if (st.field?.type === "select") {
      html += `<label>${st.field.label}<select name="v"><option value="">Select...</option>${val(st.field.options).map((o) =>
        `<option${a[st.key] === o ? " selected" : ""}>${o}</option>`).join("")}</select></label>`;
    } else if (st.field) {
      const f = st.field;
      html += `<label>${f.label}<input name="v" inputmode="${f.inputmode || "text"}" maxlength="${f.maxlength || 200}" autocomplete="${f.autocomplete || "off"}" value="${attr(a[st.key])}"></label>`;
    } else if (st.contact) {
      html += `<label>First and last name<input name="name" autocomplete="name" value="${attr(a.name)}"></label>
        <label>Email<input name="email" type="email" autocomplete="email" value="${attr(a.email)}"></label>
        <label>Phone<input name="phone" type="tel" autocomplete="tel" value="${attr(a.phone)}"></label>
        <label class="check"><input type="checkbox" name="consent"${a.consent ? " checked" : ""}> I agree to be contacted by Del Rey Lending by phone, text or email about my quote. Consent is not a condition of any loan.</label>`;
    }
    qStep.innerHTML = html;
    (qStep.querySelector("input, select, .quote-option") || qNext).focus();
  }

  const advance = () => { if (Q.i < STEPS.length - 1) { Q.i++; renderStep(); } };

  async function submitQuote() {
    const f = new FormData($("#quote-form"));
    const name = String(f.get("name") || "").trim(), email = String(f.get("email") || "").trim(), phone = String(f.get("phone") || "").trim();
    Object.assign(Q.answers, { name, email, phone, consent: !!f.get("consent") });
    if (!name) return (qErr.textContent = "Please enter your name.");
    if (!validEmail(email)) return (qErr.textContent = "Please enter a valid email.");
    if (!f.get("consent")) return (qErr.textContent = "Please check the box so we can send your quote.");
    const labels = { zip: "ZIP code", purpose: "Goal", property: "Property type", use: "Occupancy", value: "Price / value",
      amount: Q.answers.purpose === "Buy a home" ? "Down payment" : "Current loan balance", credit: "Credit", military: "Military service", timeline: "Timeline" };
    const message = Object.entries(labels).filter(([k]) => Q.answers[k]).map(([k, l]) => `${l}: ${Q.answers[k]}`).join("\n");
    qNext.disabled = true; qNext.textContent = "Sending...";
    try {
      await sendLead({ name, email, phone, message, source: "Rate quote", elapsedMs: Date.now() - startedAt });
      qErr.textContent = "";
      $("#quote-bar").style.width = "100%";
      qStep.innerHTML = `<h3 id="quote-title">Thank you, ${attr(name.split(" ")[0])}!</h3><p class="quote-sub">Your request is in. A licensed loan officer will reach out with your personalized rate quote, usually the same business day.</p>`;
      qBack.style.visibility = "hidden"; qNext.textContent = "Close"; qNext.dataset.done = "1";
    } catch (err) { qErr.textContent = err.message; qNext.textContent = "Get my quote"; }
    finally { qNext.disabled = false; }
  }

  function openQuote() {
    lastFocus = document.activeElement;
    Q.i = 0; Q.answers = {}; delete qNext.dataset.done;
    qEl.hidden = false; document.body.style.overflow = "hidden";
    renderStep();
  }
  function closeQuote() { qEl.hidden = true; document.body.style.overflow = ""; lastFocus?.focus(); }

  document.querySelectorAll("[data-quote]").forEach((b) => b.addEventListener("click", openQuote));
  $("#quote-close").addEventListener("click", closeQuote);
  qEl.addEventListener("click", (e) => { if (e.target === qEl) closeQuote(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !qEl.hidden) closeQuote(); });
  qBack.addEventListener("click", () => { if (Q.i > 0) { Q.i--; renderStep(); } });
  qStep.addEventListener("click", (e) => {
    const b = e.target.closest(".quote-option"); if (!b) return;
    Q.answers[STEPS[Q.i].key] = b.dataset.value; advance();
  });
  $("#quote-form").addEventListener("submit", (e) => {
    e.preventDefault();
    if (qNext.dataset.done) return closeQuote();
    const st = STEPS[Q.i];
    if (st.contact) return submitQuote();
    const v = String(new FormData(e.target).get("v") || "").trim();
    const check = st.valid ? st.valid(v) : (v ? true : "Please choose an option.");
    if (check !== true) { qErr.textContent = check; return; }
    Q.answers[st.key] = v; advance();
  });

  // ---------- Refinance calculator popup ----------
  const calcModal = $("#calc-modal"), calcFrame = $("#calc-frame");
  function openCalc(e) {
    e?.preventDefault();
    if (!calcFrame.src) calcFrame.src = "refinance.html?embed=1";
    calcModal.hidden = false; document.body.style.overflow = "hidden";
    $("#calc-close").focus();
  }
  function closeCalc() { calcModal.hidden = true; document.body.style.overflow = ""; }
  document.querySelectorAll("[data-calc]").forEach((a) => a.addEventListener("click", openCalc));
  $("#calc-close").addEventListener("click", closeCalc);
  calcModal.addEventListener("click", (e) => { if (e.target === calcModal) closeCalc(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !calcModal.hidden) closeCalc(); });
  // The calculator page asks the homepage to open the quote wizard.
  window.addEventListener("message", (e) => {
    if (e.origin === location.origin && e.data === "drl-open-quote") { closeCalc(); openQuote(); }
  });
  if (location.hash === "#quote") openQuote();
  if (location.hash === "#refinance") openCalc();
})();
