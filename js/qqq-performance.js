(function () {
  const body = document.getElementById("qqq-trades-body");
  if (!body) return;

  const config = window.TRADEALPHA_SUPABASE || {};
  const url = config.url;
  const anonKey = config.anonKey;

  const money = (value) => {
    if (value === null || value === undefined || value === "") return "-";
    const number = Number(value);
    if (!Number.isFinite(number)) return String(value);
    return `$${number.toFixed(2)}`;
  };

  const pnl = (value, pct) => {
    if (value === null || value === undefined || value === "") return "-";
    const number = Number(value);
    const sign = Number.isFinite(number) && number > 0 ? "+" : "";
    const pctText = pct === null || pct === undefined || pct === "" ? "" : ` (${Number(pct).toFixed(2)}%)`;
    return `${sign}${money(value)}${pctText}`;
  };

  const dateText = (value) => {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  const renderRows = (trades) => {
    if (!trades.length) {
      body.innerHTML = '<tr><td colspan="7">No QQQ trades are recorded yet.</td></tr>';
      return;
    }

    body.innerHTML = trades.map((trade) => `
      <tr>
        <td>${dateText(trade.datetime)}</td>
        <td>${trade.symbol || "QQQ"}</td>
        <td>${trade.direction || "-"}</td>
        <td>${money(trade.entry)}</td>
        <td>${money(trade.exit_price)}</td>
        <td>${pnl(trade.pnl, trade.pnl_pct)}</td>
        <td>${trade.status || "-"}</td>
      </tr>
    `).join("");
  };

  if (!url || !anonKey) {
    body.innerHTML = '<tr><td colspan="7">QQQ trade history is connected to Supabase and will appear here when the public performance feed is configured.</td></tr>';
    return;
  }

  const endpoint = `${url.replace(/\/$/, "")}/rest/v1/qqq_trades?select=datetime,symbol,direction,entry,exit_price,pnl,pnl_pct,status&order=datetime.desc&limit=25`;

  fetch(endpoint, {
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
    },
  })
    .then((response) => {
      if (!response.ok) throw new Error(`Supabase request failed: ${response.status}`);
      return response.json();
    })
    .then(renderRows)
    .catch(() => {
      body.innerHTML = '<tr><td colspan="7">QQQ trade history is temporarily unavailable.</td></tr>';
    });
})();
