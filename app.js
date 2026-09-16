const { useState, useMemo, useEffect, useCallback } = React;
const { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area } = Recharts;

const COLORS = {
  paper: "#EDE6D6", paperDark: "#E1D7C0", ink: "#2B2620", inkFaint: "#6B6357",
  stamp: "#B23A2E", jade: "#2F6B5E", gold: "#B8862E", line: "#C9BC9C", card: "#F7F3E9",
};

const STORAGE_KEY = "ledger_records_v3";
const X_STORAGE_KEY = "ledger_x_param_v1";
const GRILL_RATE = 0.55;
const PRINT_RATE = 0.99;
const EXPRESS_PER_PIECE = 0.4;

function pad2(n) { return String(n).padStart(2, "0"); }
function todayStr() { const d = new Date(); return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate()); }
function fmtMoney(n) { return "¥" + (n || 0).toFixed(2); }
function num(v) { if (v === "" || v === undefined || v === null) return 0; const p = parseFloat(v); return isNaN(p) ? 0 : p; }
const WEEKDAYS = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

function emptyEntry(dateStr) {
  return { date: dateStr, expense_cigarette: "", expense_retail: "", expense_daily: "", express_pieces: "", express_send_income: "", income_grill: "", income_revenue: "", income_print: "", note: "" };
}

function loadRecords() { try { const raw = window.localStorage.getItem(STORAGE_KEY); return raw ? JSON.parse(raw) : {}; } catch (e) { return {}; } }
function loadXParam() { try { const raw = window.localStorage.getItem(X_STORAGE_KEY); const v = raw ? parseFloat(raw) : 0.2; if (isNaN(v) || v < 0.15 || v > 0.25) return 0.2; return v; } catch (e) { return 0.2; } }

const FIELD_LIST = [
  { key: "expense_cigarette", label: "香烟支出", group: "expense" },
  { key: "expense_retail", label: "零售支出", group: "expense" },
  { key: "expense_daily", label: "日常支出", group: "expense" },
  { key: "express_pieces", label: "快递收件个数（单价¥0.4/个）", group: "income" },
  { key: "express_send_income", label: "快递寄件收入", group: "income" },
  { key: "income_grill", label: "烤肠收入", group: "income" },
  { key: "income_print", label: "打印业务收入", group: "income" },
  { key: "income_revenue", label: "营业额收入（含烤肠+打印，自动扣除）", group: "income" },
];

function Field(props) {
  const { field, value, onChange } = props;
  const accentColor = field.group === "expense" ? COLORS.stamp : COLORS.jade;
  return (
    <div style={{ padding: "10px 0" }}>
      <label style={{ display: "block", fontSize: 12, marginBottom: 4, color: COLORS.inkFaint }}>{field.label}</label>
      <input type="number" inputMode="decimal" step="0.01" placeholder="0.00" value={value}
        onChange={e => onChange(field.key, e.target.value)}
        style={{ width: "100%", background: "transparent", border: "none", borderBottom: "2px solid " + COLORS.line, padding: "8px 0", fontSize: 18, fontFamily: "monospace", color: accentColor, outline: "none" }} />
    </div>
  );
}

function SummaryRow(props) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "6px 0" }}>
      <div><span style={{ fontSize: 14, fontWeight: props.bold ? 600 : 400 }}>{props.label}</span>
        {props.sub && <span style={{ marginLeft: 6, fontSize: 11, color: "#8A8168" }}>({props.sub})</span>}</div>
      <span style={{ fontFamily: "monospace", color: props.color, fontWeight: props.bold ? 700 : 500 }}>{fmtMoney(props.value)}</span>
    </div>
  );
}

function StatCard(props) {
  return (
    <div style={{ borderRadius: 8, padding: 14, backgroundColor: COLORS.card }}>
      <div style={{ fontSize: 11, marginBottom: 4, color: COLORS.inkFaint }}>{props.label}</div>
      <div style={{ fontSize: 17, fontWeight: 700, fontFamily: "monospace", color: props.color, wordBreak: "break-all" }}>{fmtMoney(props.value)}</div>
    </div>
  );
}

function ChartCard(props) {
  return (
    <div style={{ borderRadius: 8, padding: 16, backgroundColor: COLORS.card }}>
      <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 14, color: COLORS.inkFaint }}>{props.title}</h3>
      {props.children}
    </div>
  );
}

function EmptyChart() {
  return <div style={{ height: 200, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: COLORS.inkFaint, textAlign: "center", padding: "0 16px" }}>暂无数据 — 先在「每日」页保存几天的记录再来看趋势</div>;
}

function YearMonthPicker(props) {
  const { years, pickYear, setPickYear, pickMonth, setPickMonth, showMonth = true } = props;
  const selectStyle = { borderRadius: 6, border: "1px solid " + COLORS.line, padding: "8px 10px", fontSize: 13, fontFamily: "monospace", backgroundColor: COLORS.card, color: COLORS.ink, flex: 1 };
  return (
    <div style={{ display: "flex", gap: 8, width: "100%" }}>
      <select value={pickYear} onChange={e => setPickYear(Number(e.target.value))} style={selectStyle}>
        {years.map(y => <option key={y} value={y}>{y}年</option>)}
      </select>
      {showMonth && (
        <select value={pickMonth} onChange={e => setPickMonth(Number(e.target.value))} style={selectStyle}>
          {[1,2,3,4,5,6,7,8,9,10,11,12].map(m => <option key={m} value={m}>{m}月</option>)}
        </select>
      )}
    </div>
  );
}

function XSlider(props) {
  const { x, setX } = props;
  return (
    <div style={{ borderRadius: 8, padding: 14, backgroundColor: COLORS.paperDark }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: COLORS.inkFaint }}>净营业额利润系数 x</span>
        <span style={{ fontFamily: "monospace", fontSize: 18, fontWeight: 700, color: COLORS.gold }}>{x.toFixed(3)}</span>
      </div>
      <input type="range" min="0.15" max="0.25" step="0.001" value={x} onChange={e => setX(parseFloat(e.target.value))} style={{ width: "100%" }} />
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: COLORS.inkFaint, marginTop: 2 }}>
        <span>0.15</span><span>0.25</span>
      </div>
    </div>
  );
}

function ExportModal(props) {
  const { show, onClose, records, xParam } = props;
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [format, setFormat] = useState("excel");

  const handleExport = () => {
    if (!startDate || !endDate) { alert("请选择日期范围"); return; }
    if (new Date(startDate) > new Date(endDate)) { alert("开始日期不能晚于结束日期"); return; }
    const filtered = Object.values(records).filter(r => r.date >= startDate && r.date <= endDate).sort((a, b) => a.date.localeCompare(b.date));
    if (filtered.length === 0) { alert("选定日期范围内没有记录"); return; }
    if (format === "excel") { exportToExcel(filtered, xParam); } else { exportToPDF(filtered, xParam); }
    onClose();
  };

  if (!show) return null;
  return (
    <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
      <div style={{ backgroundColor: COLORS.card, borderRadius: 12, padding: 24, maxWidth: 360, width: "90%" }}>
        <h2 style={{ margin: "0 0 16px 0", fontSize: 18, fontWeight: 700, color: COLORS.ink }}>导出数据</h2>
        <label style={{ display: "block", fontSize: 12, marginBottom: 4, color: COLORS.inkFaint }}>开始日期</label>
        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={{ width: "100%", marginBottom: 12, padding: 8, border: "1px solid " + COLORS.line, borderRadius: 6, fontSize: 14 }} />
        <label style={{ display: "block", fontSize: 12, marginBottom: 4, color: COLORS.inkFaint }}>结束日期</label>
        <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={{ width: "100%", marginBottom: 12, padding: 8, border: "1px solid " + COLORS.line, borderRadius: 6, fontSize: 14 }} />
        <label style={{ display: "block", fontSize: 12, marginBottom: 4, color: COLORS.inkFaint }}>导出格式</label>
        <select value={format} onChange={e => setFormat(e.target.value)} style={{ width: "100%", marginBottom: 16, padding: 8, border: "1px solid " + COLORS.line, borderRadius: 6, fontSize: 14 }}>
          <option value="excel">Excel (.xlsx)</option>
          <option value="pdf">PDF</option>
        </select>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onClose} style={{ flex: 1, padding: 10, borderRadius: 6, border: "1px solid " + COLORS.line, background: "transparent", cursor: "pointer", fontSize: 14 }}>取消</button>
          <button onClick={handleExport} style={{ flex: 1, padding: 10, borderRadius: 6, border: "none", backgroundColor: COLORS.ink, color: COLORS.paper, cursor: "pointer", fontSize: 14, fontWeight: 600 }}>导出</button>
        </div>
      </div>
    </div>
  );
}

function computeDerived(raw, x) {
  const expressIncome = num(raw.express_pieces) * EXPRESS_PER_PIECE + num(raw.express_send_income);
  const netRevenue = num(raw.income_revenue) - num(raw.income_grill) - num(raw.income_print);
  const grillNet = num(raw.income_grill) * GRILL_RATE;
  const printIncome = num(raw.income_print);
  const totalExpense = num(raw.expense_cigarette) + num(raw.expense_retail) + num(raw.expense_daily);
  const netProfit = netRevenue * x + grillNet + printIncome * PRINT_RATE + expressIncome;
  return { expressIncome, netRevenue, grillNet, printIncome, totalExpense, netProfit };
}

function aggregateRaw(entries) {
  const sum = { expense_cigarette: 0, expense_retail: 0, expense_daily: 0, express_pieces: 0, express_send_income: 0, income_grill: 0, income_revenue: 0, income_print: 0 };
  entries.forEach(e => {
    sum.expense_cigarette += num(e.expense_cigarette);
    sum.expense_retail += num(e.expense_retail);
    sum.expense_daily += num(e.expense_daily);
    sum.express_pieces += num(e.express_pieces);
    sum.express_send_income += num(e.express_send_income);
    sum.income_grill += num(e.income_grill);
    sum.income_revenue += num(e.income_revenue);
    sum.income_print += num(e.income_print);
  });
  return sum;
}

function exportToExcel(filteredRecords, xParam) {
  if (typeof XLSX === "undefined") { alert("导出库加载中，请稍候再试"); return; }
  const wb = XLSX.utils.book_new();
  const dayData = [["日期", "香烟支出", "零售支出", "日常支出", "快递个数", "快递寄件", "烤肠收入", "打印收入", "营业额", "快递收入", "净营业额", "烤肠净收入", "支出合计", "净利润"]];
  filteredRecords.forEach(r => {
    const d = computeDerived(r, xParam);
    dayData.push([r.date, num(r.expense_cigarette), num(r.expense_retail), num(r.expense_daily), num(r.express_pieces), num(r.express_send_income), num(r.income_grill), num(r.income_print), num(r.income_revenue), d.expressIncome, d.netRevenue, d.grillNet, d.totalExpense, d.netProfit]);
  });
  const ws1 = XLSX.utils.aoa_to_sheet(dayData);
  ws1["!cols"] = [{ wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 10 }, { wch: 10 }];
  XLSX.utils.book_append_sheet(wb, ws1, "日度数据");
  const monthMap = {};
  filteredRecords.forEach(r => { const ym = r.date.substring(0, 7); if (!monthMap[ym]) monthMap[ym] = []; monthMap[ym].push(r); });
  const monthData = [["月份", "净营业额", "快递收入", "烤肠净收入", "打印收入", "支出合计", "净利润"]];
  Object.keys(monthMap).sort().forEach(ym => { const raw = aggregateRaw(monthMap[ym]); const d = computeDerived(raw, xParam); monthData.push([ym, d.netRevenue, d.expressIncome, d.grillNet, d.printIncome, d.totalExpense, d.netProfit]); });
  const ws2 = XLSX.utils.aoa_to_sheet(monthData);
  ws2["!cols"] = [{ wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }];
  XLSX.utils.book_append_sheet(wb, ws2, "月度汇总");
  const yearMap = {};
  filteredRecords.forEach(r => { const y = r.date.substring(0, 4); if (!yearMap[y]) yearMap[y] = []; yearMap[y].push(r); });
  const yearData = [["年份", "净营业额", "快递收入", "烤肠净收入", "打印收入", "支出合计", "净利润"]];
  Object.keys(yearMap).sort().forEach(y => { const raw = aggregateRaw(yearMap[y]); const d = computeDerived(raw, xParam); yearData.push([y, d.netRevenue, d.expressIncome, d.grillNet, d.printIncome, d.totalExpense, d.netProfit]); });
  const ws3 = XLSX.utils.aoa_to_sheet(yearData);
  ws3["!cols"] = [{ wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }];
  XLSX.utils.book_append_sheet(wb, ws3, "年度汇总");
  const filename = "便利店台账_" + new Date().toISOString().split("T")[0] + ".xlsx";
  XLSX.writeFile(wb, filename);
}

function exportToPDF(filteredRecords, xParam) {
  if (typeof html2pdf === "undefined") { alert("PDF库加载中，请稍候再试"); return; }
  const docTitle = "便利店台账 " + filteredRecords[0].date + " 至 " + filteredRecords[filteredRecords.length - 1].date;
  let htmlContent = "<html><head><meta charset='utf-8'><style>";
  htmlContent += "body { font-family: 'SimSun', serif; margin: 20px; color: #2B2620; }";
  htmlContent += "h1 { text-align: center; font-size: 24px; margin-bottom: 10px; }";
  htmlContent += "h2 { font-size: 18px; margin-top: 20px; margin-bottom: 10px; border-bottom: 2px solid #B23A2E; padding-bottom: 5px; }";
  htmlContent += "table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 11px; }";
  htmlContent += "th, td { border: 1px solid #C9BC9C; padding: 6px; text-align: right; }";
  htmlContent += "th { background-color: #E1D7C0; font-weight: bold; text-align: left; }";
  htmlContent += "tr:nth-child(even) { background-color: #F7F3E9; }";
  htmlContent += ".label { text-align: left; font-weight: bold; }";
  htmlContent += ".page-break { page-break-after: always; margin-top: 20px; }";
  htmlContent += "</style></head><body>";
  htmlContent += "<h1>" + docTitle + "</h1>";
  htmlContent += "<h2>日度数据</h2><table><tr><th>日期</th><th>香烟</th><th>零售</th><th>日常</th><th>快递件</th><th>快递寄</th><th>烤肠</th><th>打印</th><th>营业额</th><th>快递收入</th><th>净营业额</th><th>烤肠净</th><th>支出</th><th>利润</th></tr>";
  filteredRecords.forEach(r => {
    const d = computeDerived(r, xParam);
    htmlContent += "<tr><td class='label'>" + r.date + "</td><td>" + fmtMoney(num(r.expense_cigarette)) + "</td><td>" + fmtMoney(num(r.expense_retail)) + "</td><td>" + fmtMoney(num(r.expense_daily)) + "</td><td>" + num(r.express_pieces) + "</td><td>" + fmtMoney(num(r.express_send_income)) + "</td><td>" + fmtMoney(num(r.income_grill)) + "</td><td>" + fmtMoney(num(r.income_print)) + "</td><td>" + fmtMoney(num(r.income_revenue)) + "</td><td>" + fmtMoney(d.expressIncome) + "</td><td>" + fmtMoney(d.netRevenue) + "</td><td>" + fmtMoney(d.grillNet) + "</td><td>" + fmtMoney(d.totalExpense) + "</td><td>" + fmtMoney(d.netProfit) + "</td></tr>";
  });
  htmlContent += "</table>";
  const monthMap = {};
  filteredRecords.forEach(r => { const ym = r.date.substring(0, 7); if (!monthMap[ym]) monthMap[ym] = []; monthMap[ym].push(r); });
  htmlContent += "<div class='page-break'><h2>月度汇总</h2><table><tr><th>月份</th><th>净营业额</th><th>快递收入</th><th>烤肠净收入</th><th>打印收入</th><th>支出合计</th><th>净利润</th></tr>";
  Object.keys(monthMap).sort().forEach(ym => { const raw = aggregateRaw(monthMap[ym]); const d = computeDerived(raw, xParam); htmlContent += "<tr><td class='label'>" + ym + "</td><td>" + fmtMoney(d.netRevenue) + "</td><td>" + fmtMoney(d.expressIncome) + "</td><td>" + fmtMoney(d.grillNet) + "</td><td>" + fmtMoney(d.printIncome) + "</td><td>" + fmtMoney(d.totalExpense) + "</td><td>" + fmtMoney(d.netProfit) + "</td></tr>"; });
  htmlContent += "</table></div>";
  const yearMap = {};
  filteredRecords.forEach(r => { const y = r.date.substring(0, 4); if (!yearMap[y]) yearMap[y] = []; yearMap[y].push(r); });
  htmlContent += "<div class='page-break'><h2>年度汇总</h2><table><tr><th>年份</th><th>净营业额</th><th>快递收入</th><th>烤肠净收入</th><th>打印收入</th><th>支出合计</th><th>净利润</th></tr>";
  Object.keys(yearMap).sort().forEach(y => { const raw = aggregateRaw(yearMap[y]); const d = computeDerived(raw, xParam); htmlContent += "<tr><td class='label'>" + y + "</td><td>" + fmtMoney(d.netRevenue) + "</td><td>" + fmtMoney(d.expressIncome) + "</td><td>" + fmtMoney(d.grillNet) + "</td><td>" + fmtMoney(d.printIncome) + "</td><td>" + fmtMoney(d.totalExpense) + "</td><td>" + fmtMoney(d.netProfit) + "</td></tr>"; });
  htmlContent += "</table></div></body></html>";
  const element = document.createElement("div");
  element.innerHTML = htmlContent;
  const opt = { margin: 10, filename: "便利店台账_" + new Date().toISOString().split("T")[0] + ".pdf", image: { type: "jpeg", quality: 0.98 }, html2canvas: { scale: 2 }, jsPDF: { orientation: "l", unit: "mm", format: "a4" } };
  html2pdf().set(opt).from(element).save();
}

function LedgerApp() {
  const [records, setRecords] = useState(() => loadRecords());
  const [selectedDate, setSelectedDate] = useState(todayStr());
  const [view, setView] = useState("day");
  const [draft, setDraft] = useState(() => {
    const r = loadRecords();
    const t = todayStr();
    return r[t] ? Object.assign({}, emptyEntry(t), r[t]) : emptyEntry(t);
  });
  const [savedFlash, setSavedFlash] = useState(false);
  const [xParam, setXParam] = useState(() => loadXParam());
  const [showExportModal, setShowExportModal] = useState(false);

  const nowDate = new Date();
  const [pickYear, setPickYear] = useState(nowDate.getFullYear());
  const [pickMonth, setPickMonth] = useState(nowDate.getMonth() + 1);

  useEffect(() => { try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(records)); } catch (e) {} }, [records]);
  useEffect(() => { try { window.localStorage.setItem(X_STORAGE_KEY, String(xParam)); } catch (e) {} }, [xParam]);

  const currentSaved = records[selectedDate];

  function loadDate(dateStr) {
    setSelectedDate(dateStr);
    setDraft(records[dateStr] ? Object.assign({}, emptyEntry(dateStr), records[dateStr]) : emptyEntry(dateStr));
  }

  function shiftDate(deltaDays) {
    const d = new Date(selectedDate + "T00:00:00");
    d.setDate(d.getDate() + deltaDays);
    loadDate(d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate()));
  }

  const handleFieldChange = useCallback((field, value) => { setDraft(d => { const next = Object.assign({}, d); next[field] = value; return next; }); }, []);

  function handleSave() {
    setRecords(prev => { const next = Object.assign({}, prev); next[selectedDate] = Object.assign({}, draft, { date: selectedDate }); return next; });
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1400);
  }

  const derived = useMemo(() => computeDerived(draft, xParam), [draft, xParam]);

  const dateObj = new Date(selectedDate + "T00:00:00");
  const weekday = WEEKDAYS[dateObj.getDay()];

  const availableYears = useMemo(() => {
    const ys = {};
    ys[nowDate.getFullYear()] = true;
    Object.keys(records).forEach(d => { ys[Number(d.split("-")[0])] = true; });
    return Object.keys(ys).map(Number).sort((a, b) => b - a);
  }, [records]);

  const dayListEntries = useMemo(() => Object.values(records).filter(r => { const parts = r.date.split("-"); return Number(parts[0]) === pickYear && Number(parts[1]) === pickMonth; }).sort((a, b) => b.date.localeCompare(a.date)), [records, pickYear, pickMonth]);
  const monthEntries = useMemo(() => Object.values(records).filter(r => { const parts = r.date.split("-"); return Number(parts[0]) === pickYear && Number(parts[1]) === pickMonth; }).sort((a, b) => a.date.localeCompare(b.date)), [records, pickYear, pickMonth]);
  const yearEntries = useMemo(() => Object.values(records).filter(r => r.date.split("-")[0] === String(pickYear)).sort((a, b) => a.date.localeCompare(b.date)), [records, pickYear]);

  const monthRaw = aggregateRaw(monthEntries);
  const yearRaw = aggregateRaw(yearEntries);
  const monthAgg = computeDerived(monthRaw, xParam);
  const yearAgg = computeDerived(yearRaw, xParam);

  const monthTrend = monthEntries.map(e => { const d = computeDerived(e, xParam); return { day: e.date.split("-")[2], 净营业额: d.netRevenue, 净利润: d.netProfit, 快递: d.expressIncome, 支出: d.totalExpense }; });
  const yearTrend = useMemo(() => [1,2,3,4,5,6,7,8,9,10,11,12].map(m => { const entries = yearEntries.filter(e => Number(e.date.split("-")[1]) === m); const raw = aggregateRaw(entries); const d = computeDerived(raw, xParam); return { month: m + "月", 净营业额: d.netRevenue, 支出: d.totalExpense, 净利润: d.netProfit }; }), [yearEntries, xParam]);

  const TABS = [{ key: "day", label: "每日" }, { key: "daylist", label: "日度查询" }, { key: "month", label: "月度" }, { key: "year", label: "年度" }];
  const expenseFields = FIELD_LIST.filter(f => f.group === "expense");
  const incomeFields = FIELD_LIST.filter(f => f.group === "income");
  const isMobile = window.innerWidth < 640;

  return (
    <div style={{ minHeight: "100vh", width: "100%", paddingBottom: isMobile ? 76 : 24, backgroundColor: COLORS.paper, color: COLORS.ink }}>
      <div style={{ maxWidth: 960, margin: "0 auto", padding: isMobile ? "16px 14px" : "24px 20px" }}>
        <header style={{ marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "2px solid " + COLORS.ink, paddingBottom: 12 }}>
          <div>
            <h1 style={{ fontSize: isMobile ? 19 : 24, fontWeight: 700, margin: 0, fontFamily: "Georgia, serif" }}>便利店台账</h1>
            <p style={{ fontSize: 11, marginTop: 2, color: COLORS.inkFaint }}>自动化日/月/年经营记账</p>
          </div>
          {!isMobile && (
            <nav style={{ display: "flex", gap: 4, borderRadius: 999, padding: 4, backgroundColor: COLORS.paperDark }}>
              {TABS.map(t => { const active = view === t.key; return <button key={t.key} onClick={() => setView(t.key)} style={{ borderRadius: 999, padding: "6px 16px", fontSize: 14, fontWeight: 500, border: "none", cursor: "pointer", backgroundColor: active ? COLORS.ink : "transparent", color: active ? COLORS.paper : COLORS.inkFaint }}>{t.label}</button>; })}
            </nav>
          )}
        </header>

        <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 200 }}><XSlider x={xParam} setX={setXParam} /></div>
          <button onClick={() => setShowExportModal(true)} style={{ padding: "14px 20px", borderRadius: 8, border: "none", backgroundColor: COLORS.gold, color: COLORS.paper, cursor: "pointer", fontWeight: 600, fontSize: 14, whiteSpace: "nowrap" }}>📥 导出数据</button>
        </div>

        <ExportModal show={showExportModal} onClose={() => setShowExportModal(false)} records={records} xParam={xParam} />

        {view === "day" && (
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "3fr 2fr", gap: 16 }}>
            <div style={{ borderRadius: 8, padding: isMobile ? 16 : 24, backgroundColor: COLORS.card }}>
              <div style={{ marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <button onClick={() => shiftDate(-1)} style={{ border: "none", background: "none", fontSize: 22, cursor: "pointer", padding: 10 }}>‹</button>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 12, color: COLORS.inkFaint }}>{weekday} {currentSaved && <span style={{ marginLeft: 8, borderRadius: 999, padding: "2px 8px", fontSize: 10, backgroundColor: COLORS.jade + "22", color: COLORS.jade }}>已记账</span>}</div>
                  <input type="date" value={selectedDate} onChange={e => loadDate(e.target.value)} style={{ marginTop: 4, background: "transparent", border: "none", fontSize: isMobile ? 18 : 22, fontWeight: 700, fontFamily: "Georgia, serif", color: COLORS.ink }} />
                </div>
                <button onClick={() => shiftDate(1)} style={{ border: "none", background: "none", fontSize: 22, cursor: "pointer", padding: 10 }}>›</button>
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.stamp, marginBottom: 2 }}>支出</div>
              <div>{expenseFields.map(f => <Field key={f.key} field={f} value={draft[f.key]} onChange={handleFieldChange} />)}</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.jade, marginTop: 16, marginBottom: 2 }}>收入</div>
              <div>{incomeFields.map(f => <Field key={f.key} field={f} value={draft[f.key]} onChange={handleFieldChange} />)}</div>
              <textarea placeholder="备注（选填）" value={draft.note} onChange={e => setDraft(d => Object.assign({}, d, { note: e.target.value }))} rows={2} style={{ marginTop: 14, width: "100%", borderRadius: 6, border: "1px solid " + COLORS.line, padding: 10, fontSize: 13, backgroundColor: COLORS.paper, outline: "none", resize: "vertical" }} />
              <button onClick={handleSave} style={{ marginTop: 14, width: "100%", borderRadius: 6, padding: "13px 0", fontWeight: 500, border: "none", cursor: "pointer", backgroundColor: COLORS.ink, color: COLORS.paper, fontSize: 15 }}>{savedFlash ? "已保存 ✓" : "保存当日记录"}</button>
            </div>
            <div style={{ borderRadius: 8, padding: isMobile ? 16 : 24, backgroundColor: COLORS.paperDark }}>
              <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, color: COLORS.inkFaint }}>当日小结</h3>
              <SummaryRow label="净营业额" sub="营业额−烤肠−打印" value={derived.netRevenue} color={COLORS.jade} />
              <SummaryRow label="快递收入" sub="个数×0.4+寄件" value={derived.expressIncome} color={COLORS.jade} />
              <SummaryRow label="烤肠净收入" sub="烤肠×55%" value={derived.grillNet} color={COLORS.jade} />
              <SummaryRow label="打印收入" value={derived.printIncome} color={COLORS.jade} />
              <div style={{ margin: "10px 0", borderTop: "1px solid " + COLORS.line }} />
              <SummaryRow label="总支出" value={derived.totalExpense} color={COLORS.stamp} bold />
              <div style={{ margin: "10px 0", borderTop: "1px solid " + COLORS.line }} />
              <div style={{ borderRadius: 6, padding: 14, backgroundColor: (derived.netProfit >= 0 ? COLORS.jade : COLORS.stamp) + "15" }}>
                <div style={{ fontSize: 11, color: COLORS.inkFaint }}>当日净利润</div>
                <div style={{ fontSize: 24, fontWeight: 700, fontFamily: "monospace", marginTop: 4, color: derived.netProfit >= 0 ? COLORS.jade : COLORS.stamp, wordBreak: "break-all" }}>{fmtMoney(derived.netProfit)}</div>
              </div>
            </div>
          </div>
        )}

        {view === "daylist" && (
          <div>
            <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", alignItems: isMobile ? "stretch" : "center", justifyContent: "space-between", gap: 10, marginBottom: 14 }}>
              <h2 style={{ fontSize: 13, fontWeight: 600, color: COLORS.inkFaint, margin: 0 }}>{pickYear}年{pickMonth}月 · 逐日记录（{dayListEntries.length}天）</h2>
              <YearMonthPicker years={availableYears} pickYear={pickYear} setPickYear={setPickYear} pickMonth={pickMonth} setPickMonth={setPickMonth} />
            </div>
            {dayListEntries.length === 0 ? (
              <div style={{ borderRadius: 8, padding: 36, textAlign: "center", fontSize: 13, backgroundColor: COLORS.card, color: COLORS.inkFaint }}>这个月还没有记录</div>
            ) : (
              <div style={{ borderRadius: 8, overflowX: "auto", backgroundColor: COLORS.card }}>
                <table style={{ width: "100%", fontSize: 12, minWidth: 560, borderCollapse: "collapse" }}>
                  <thead><tr style={{ borderBottom: "1px solid " + COLORS.line }}><th style={{ padding: "9px 10px", textAlign: "left", color: COLORS.inkFaint }}>日期</th><th style={{ padding: "9px 10px", textAlign: "right", color: COLORS.stamp }}>支出</th><th style={{ padding: "9px 10px", textAlign: "right", color: COLORS.jade }}>快递</th><th style={{ padding: "9px 10px", textAlign: "right", color: COLORS.jade }}>净营业额</th><th style={{ padding: "9px 10px", textAlign: "right" }}>净利润</th></tr></thead>
                  <tbody>{dayListEntries.map(e => { const d = computeDerived(e, xParam); return <tr key={e.date} onClick={() => { loadDate(e.date); setView("day"); }} style={{ borderBottom: "1px solid " + COLORS.line, cursor: "pointer" }}><td style={{ padding: "9px 10px", fontFamily: "monospace" }}>{e.date}</td><td style={{ padding: "9px 10px", textAlign: "right", fontFamily: "monospace", color: COLORS.stamp }}>{fmtMoney(d.totalExpense)}</td><td style={{ padding: "9px 10px", textAlign: "right", fontFamily: "monospace" }}>{fmtMoney(d.expressIncome)}</td><td style={{ padding: "9px 10px", textAlign: "right", fontFamily: "monospace", color: COLORS.jade }}>{fmtMoney(d.netRevenue)}</td><td style={{ padding: "9px 10px", textAlign: "right", fontFamily: "monospace", fontWeight: 600, color: d.netProfit >= 0 ? COLORS.jade : COLORS.stamp }}>{fmtMoney(d.netProfit)}</td></tr>; })}</tbody>
                </table>
              </div>
            )}
            <p style={{ fontSize: 11, color: COLORS.inkFaint, marginTop: 10 }}>点击任意一行可跳转到该日进行编辑</p>
          </div>
        )}

        {view === "month" && (
          <div>
            <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", alignItems: isMobile ? "stretch" : "center", justifyContent: "space-between", gap: 10, marginBottom: 14 }}>
              <h2 style={{ fontSize: 13, fontWeight: 600, color: COLORS.inkFaint, margin: 0 }}>{pickYear}年{pickMonth}月 汇总</h2>
              <YearMonthPicker years={availableYears} pickYear={pickYear} setPickYear={setPickYear} pickMonth={pickMonth} setPickMonth={setPickMonth} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, 1fr)", gap: 10, marginBottom: 14 }}>
              <StatCard label="净营业额" value={monthAgg.netRevenue} color={COLORS.jade} />
              <StatCard label="快递收入" value={monthAgg.expressIncome} color={COLORS.jade} />
              <StatCard label="烤肠净收入" value={monthAgg.grillNet} color={COLORS.jade} />
              <StatCard label="总支出" value={monthAgg.totalExpense} color={COLORS.stamp} />
            </div>
            <div style={{ borderRadius: 8, padding: 18, backgroundColor: COLORS.card, marginBottom: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>本月净利润</div>
              <div style={{ fontSize: 24, fontWeight: 700, fontFamily: "monospace", color: monthAgg.netProfit >= 0 ? COLORS.jade : COLORS.stamp, wordBreak: "break-all" }}>{fmtMoney(monthAgg.netProfit)}</div>
            </div>
            <ChartCard title="本月每日趋势">{monthTrend.length === 0 ? <EmptyChart /> : <ResponsiveContainer width="100%" height={240}><AreaChart data={monthTrend}><CartesianGrid strokeDasharray="3 3" stroke={COLORS.line} /><XAxis dataKey="day" stroke={COLORS.inkFaint} fontSize={10} /><YAxis stroke={COLORS.inkFaint} fontSize={10} /><Tooltip /><Legend wrapperStyle={{ fontSize: 11 }} /><Area type="monotone" dataKey="净营业额" stroke={COLORS.jade} fill={COLORS.jade} fillOpacity={0.15} strokeWidth={2} /><Area type="monotone" dataKey="净利润" stroke={COLORS.gold} fill={COLORS.gold} fillOpacity={0.1} strokeWidth={2} /><Area type="monotone" dataKey="快递" stroke="#4A7FB5" fill="#4A7FB5" fillOpacity={0.1} strokeWidth={2} /><Area type="monotone" dataKey="支出" stroke={COLORS.stamp} fill={COLORS.stamp} fillOpacity={0.1} strokeWidth={2} /></AreaChart></ResponsiveContainer>}</ChartCard>
          </div>
        )}

        {view === "year" && (
          <div>
            <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", alignItems: isMobile ? "stretch" : "center", justifyContent: "space-between", gap: 10, marginBottom: 14 }}>
              <h2 style={{ fontSize: 13, fontWeight: 600, color: COLORS.inkFaint, margin: 0 }}>{pickYear}年 汇总</h2>
              <YearMonthPicker years={availableYears} pickYear={pickYear} setPickYear={setPickYear} showMonth={false} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, 1fr)", gap: 10, marginBottom: 14 }}>
              <StatCard label="净营业额" value={yearAgg.netRevenue} color={COLORS.jade} />
              <StatCard label="快递收入" value={yearAgg.expressIncome} color={COLORS.jade} />
              <StatCard label="烤肠净收入" value={yearAgg.grillNet} color={COLORS.jade} />
              <StatCard label="总支出" value={yearAgg.totalExpense} color={COLORS.stamp} />
            </div>
            <div style={{ borderRadius: 8, padding: 18, backgroundColor: COLORS.card, marginBottom: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>本年净利润</div>
              <div style={{ fontSize: 24, fontWeight: 700, fontFamily: "monospace", color: yearAgg.netProfit >= 0 ? COLORS.jade : COLORS.stamp, wordBreak: "break-all" }}>{fmtMoney(yearAgg.netProfit)}</div>
            </div>
            <ChartCard title="全年12个月对比">{yearEntries.length === 0 ? <EmptyChart /> : <ResponsiveContainer width="100%" height={260}><BarChart data={yearTrend}><CartesianGrid strokeDasharray="3 3" stroke={COLORS.line} /><XAxis dataKey="month" stroke={COLORS.inkFaint} fontSize={10} /><YAxis stroke={COLORS.inkFaint} fontSize={10} /><Tooltip /><Legend wrapperStyle={{ fontSize: 11 }} /><Bar dataKey="净营业额" fill={COLORS.jade} radius={[3, 3, 0, 0]} /><Bar dataKey="支出" fill={COLORS.stamp} radius={[3, 3, 0, 0]} /></BarChart></ResponsiveContainer>}</ChartCard>
            <div style={{ height: 14 }} />
            <ChartCard title="全年净利润趋势">{yearEntries.length === 0 ? <EmptyChart /> : <ResponsiveContainer width="100%" height={200}><LineChart data={yearTrend}><CartesianGrid strokeDasharray="3 3" stroke={COLORS.line} /><XAxis dataKey="month" stroke={COLORS.inkFaint} fontSize={10} /><YAxis stroke={COLORS.inkFaint} fontSize={10} /><Tooltip /><Line type="monotone" dataKey="净利润" stroke={COLORS.gold} strokeWidth={3} dot={{ r: 3 }} /></LineChart></ResponsiveContainer>}</ChartCard>
          </div>
        )}
      </div>

      {isMobile && (
        <nav style={{ position: "fixed", bottom: 0, left: 0, right: 0, display: "flex", justifyContent: "space-around", borderTop: "1px solid " + COLORS.line, backgroundColor: COLORS.card, paddingTop: 6, paddingBottom: "calc(6px + env(safe-area-inset-bottom))" }}>
          {TABS.map(t => { const active = view === t.key; return <button key={t.key} onClick={() => setView(t.key)} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, padding: "4px 12px", border: "none", background: "none" }}><span style={{ fontSize: 10, color: active ? COLORS.stamp : COLORS.inkFaint, fontWeight: active ? 700 : 400 }}>{t.label}</span></button>; })}
        </nav>
      )}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<LedgerApp />);
