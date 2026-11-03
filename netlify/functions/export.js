// Builds an Excel file: "All data" (full history) + one grid sheet per restaurant (newest date).
const ExcelJS = require("exceljs");
const { denied } = require("../../lib/auth");
const { openStore, readAllHistory } = require("../../lib/store");

const MONEY = '0.00"₾"';

function sheetName(name, used) {
  const base = String(name).replace(/[\\/?*[\]:]/g, "-").replace(/^'+|'+$/g, "").trim().slice(0, 31) || "Restaurant";
  let n = base, i = 2;
  while (used.has(n.toLowerCase())) { const suffix = ` (${i++})`; n = base.slice(0, 31 - suffix.length) + suffix; }
  used.add(n.toLowerCase());
  return n;
}
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
function niceDate(iso) {
  const [y, m, d] = String(iso).split("-").map(Number);
  const suffix = d % 100 >= 11 && d % 100 <= 13 ? "th" : ({ 1: "st", 2: "nd", 3: "rd" }[d % 10] || "th");
  return `${d}${suffix} ${MONTHS[m - 1]} ${y}`;
}
// Tomato-red header with white text, to match the site.
function styleHeader(row) {
  row.eachCell((c) => {
    c.font = { bold: true, color: { argb: "FFFFFFFF" } };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFB8321F" } };
    c.alignment = { vertical: "middle" };
  });
  row.height = 22;
}
const CENTER = { horizontal: "center" };
const PRINT = { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 };   // prints one page wide
const asNum = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method not allowed" };
  const deny = denied(event);
  if (deny) return deny;

  try {
    const records = (await readAllHistory(openStore(event))).filter((r) => r.rows.length);
    if (!records.length) return { statusCode: 400, body: JSON.stringify({ error: "No saved prices yet." }) };
    records.sort((a, b) => a.name.localeCompare(b.name));

    const wb = new ExcelJS.Workbook();
    wb.creator = "Price Tracker";
    const used = new Set(["all data"]);

    // Sheet 1: every saved row (filters on, header frozen), newest date first within each restaurant.
    const all = wb.addWorksheet("All data", { views: [{ state: "frozen", ySplit: 1 }] });
    all.columns = [
      { header: "Restaurant", key: "restaurant", width: 20 },
      { header: "Date", key: "date", width: 20 },
      { header: "Pizza", key: "item", width: 42 },
      { header: "Size", key: "size", width: 10 },
      { header: "Sale price", key: "sale", width: 12 },
      { header: "Regular price", key: "reg", width: 14 },
      { header: "Offer", key: "notes", width: 44 }
    ];
    for (const rec of records) {
      const sorted = [...rec.rows].sort((a, b) => b.date.localeCompare(a.date));
      for (const r of sorted)
        all.addRow({ restaurant: rec.name, date: new Date(r.date + "T00:00:00Z"), item: r.item, size: r.size, sale: asNum(r.sale_price), reg: asNum(r.regular_price), notes: r.notes });
    }
    all.getColumn("date").numFmt = "d mmmm yyyy"; // real dates, so Excel can still sort and filter them
    all.getColumn("sale").numFmt = MONEY;
    all.getColumn("reg").numFmt = MONEY;
    styleHeader(all.getRow(1));
    all.pageSetup = PRINT;
    all.autoFilter = "A1:G1";

    // One sheet per restaurant: pizzas as rows, sizes as columns, for that restaurant's newest date.
    for (const rec of records) {
      const newest = rec.rows.map((r) => r.date).sort().pop();
      const rows = rec.rows.filter((r) => r.date === newest);
      const sizes = [...new Set(rows.map((r) => r.size))].sort((a, b) => ((parseFloat(a) || 0) - (parseFloat(b) || 0)) || a.localeCompare(b));
      const pizzas = [...new Set(rows.map((r) => r.item))];
      const cell = new Map(rows.map((r) => [r.item + "\u0000" + r.size, r]));

      const ws = wb.addWorksheet(sheetName(rec.name, used));
      ws.addRow([`${rec.name} · prices on ${niceDate(newest)}`]).font = { bold: true, size: 13 };
      ws.addRow([]);
      const head = ws.addRow(["Pizza", ...sizes]);
      styleHeader(head);
      for (let c = 2; c <= sizes.length + 1; c++) head.getCell(c).alignment = { vertical: "middle", ...CENTER };
      for (const p of pizzas) {
        const row = ws.addRow([p, ...sizes.map((s) => asNum(cell.get(p + "\u0000" + s)?.sale_price))]);
        for (let c = 2; c <= sizes.length + 1; c++) { row.getCell(c).numFmt = MONEY; row.getCell(c).alignment = CENTER; }
      }
      ws.getColumn(1).width = 42;
      for (let c = 2; c <= sizes.length + 1; c++) ws.getColumn(c).width = 12;
      ws.views = [{ state: "frozen", ySplit: 3 }];
      ws.pageSetup = PRINT;
    }

    const buffer = Buffer.from(await wb.xlsx.writeBuffer());
    return { statusCode: 200, body: JSON.stringify({ base64: buffer.toString("base64") }) };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
