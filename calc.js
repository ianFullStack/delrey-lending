(() => {
  "use strict";
  const $ = (s) => document.querySelector(s);

  // ---------- Refinance calculator ----------
  // Standard amortization: payment = P*r / (1 - (1+r)^-n), r = monthly rate, n = months.
  const calcForm = $("#calc");
  const usd = (n, cents) => n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: cents ? 2 : 0, minimumFractionDigits: cents ? 2 : 0 });
  const num = (v) => { const n = parseFloat(String(v).replace(/[$,%\s]/g, "")); return Number.isFinite(n) ? n : NaN; };
  const payment = (P, annualPct, months) => {
    const r = annualPct / 100 / 12;
    return r === 0 ? P / months : (P * r) / (1 - Math.pow(1 + r, -months));
  };
  function months(m) {
    const y = Math.floor(m / 12), mo = m % 12;
    return [y && `${y} yr${y > 1 ? "s" : ""}`, mo && `${mo} mo`].filter(Boolean).join(" ") || "0 mo";
  }
  function setOut(id, text, cls) { const el = $(id); el.textContent = text; el.className = cls || ""; }

  function calcRefi() {
    const f = new FormData(calcForm);
    const bal = num(f.get("balance")), rate = num(f.get("rate")), yrs = num(f.get("years"));
    const newRate = num(f.get("newRate")), newYrs = num(f.get("newYears"));
    const costs = num(f.get("costs")) || 0, cashOut = num(f.get("cashOut")) || 0, rollIn = !!f.get("rollIn");
    // Taxes, insurance and HOA are the same before and after a refinance, so they raise both payments equally.
    const escrowOn = !!f.get("escrow");
    const escrow = escrowOn ? ((num(f.get("tax")) || 0) + (num(f.get("ins")) || 0)) / 12 + (num(f.get("mi")) || 0) + (num(f.get("hoa")) || 0) : 0;
    $("#escrow-fields").hidden = !escrowOn;
    const ok = bal > 0 && rate >= 0 && rate < 30 && yrs > 0 && yrs <= 40 && newRate >= 0 && newRate < 30 && newYrs > 0 && costs >= 0 && cashOut >= 0;
    if (!ok) {
      ["#r-cur", "#r-new", "#r-diff", "#r-be", "#r-amt", "#r-life"].forEach((id) => setOut(id, "-"));
      setOut("#r-cur-sub", ""); setOut("#r-new-sub", "");
      $("#r-summary").textContent = "Enter your loan balance, rates and terms to see results.";
      return;
    }
    const nCur = Math.round(yrs * 12), nNew = newYrs * 12;
    const amount = bal + cashOut + (rollIn ? costs : 0);
    const cur = payment(bal, rate, nCur), neu = payment(amount, newRate, nNew);
    const diff = cur - neu; // positive = saves money each month
    const curTotal = cur * nCur;
    const newTotal = neu * nNew + (rollIn ? 0 : costs) - cashOut; // cash you receive offsets what you pay
    const life = curTotal - newTotal;

    setOut("#r-cur", usd(cur + escrow, true));
    setOut("#r-new", usd(neu + escrow, true));
    const breakdown = (pi) => escrow ? `${usd(pi, true)} loan + ${usd(escrow, true)} taxes & insurance` : "Principal & interest";
    setOut("#r-cur-sub", breakdown(cur));
    setOut("#r-new-sub", breakdown(neu));
    setOut("#r-diff", (diff >= 0 ? "-" : "+") + usd(Math.abs(diff), true) + "/mo", diff >= 0 ? "good" : "bad");
    setOut("#r-amt", usd(amount));
    setOut("#r-life", (life >= 0 ? "Save " : "Cost ") + usd(Math.abs(life)), life >= 0 ? "good" : "bad");

    let be = "No break-even", beMonths = null;
    if (costs === 0 && diff > 0) be = "Immediate";
    else if (diff > 0) { beMonths = Math.ceil(costs / diff); be = beMonths > nNew ? "Never" : months(beMonths); }
    setOut("#r-be", be);

    const lines = [];
    if (diff > 0) lines.push(`Your principal and interest payment would drop by ${usd(diff)} a month.`);
    else if (diff < 0) lines.push(`Your payment would go up by ${usd(-diff)} a month${cashOut ? `, in exchange for ${usd(cashOut)} cash out` : ""}.`);
    else lines.push("Your payment would stay about the same.");
    if (beMonths && beMonths <= nNew) lines.push(`The savings cover your ${usd(costs)} closing costs after about ${months(beMonths)}. If you plan to stay in the home longer than that, the refinance pays for itself.`);
    if (nNew < nCur) lines.push(`You would also pay the loan off ${months(nCur - nNew)} sooner, which is why the payment is higher but the lifetime cost is lower.`);
    if (nNew > nCur) lines.push(`Note: going from ${months(nCur)} left to a new ${newYrs}-year term lowers the payment partly by stretching it out, so check the lifetime difference too.`);
    if (escrow) lines.push(`Both payments include ${usd(escrow)} a month for taxes, insurance and dues, which stay about the same whether or not you refinance.`);
    lines.push(life >= 0
      ? `Over the life of both loans you'd pay about ${usd(life)} less${cashOut ? " (counting the cash out you receive)" : ""}.`
      : `Over the life of both loans you'd pay about ${usd(-life)} more${cashOut ? " (after counting the cash out you receive)" : ""}.`);
    $("#r-summary").textContent = lines.join(" ");
  }
  calcForm.addEventListener("input", calcRefi);
  calcForm.addEventListener("change", calcRefi);
  calcForm.addEventListener("submit", (e) => e.preventDefault());
  calcRefi();

  // "Get my real rate quote": inside the homepage popup, ask the homepage to open the quote form; standalone, go there.
  document.querySelectorAll("[data-quote]").forEach((b) => b.addEventListener("click", () => {
    if (window.parent !== window) window.parent.postMessage("drl-open-quote", location.origin);
    else location.href = "index.html#quote";
  }));
})();
