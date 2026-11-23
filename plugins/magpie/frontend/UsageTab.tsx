/** Usage: totals plus per-model and per-account tables for a period. */
import { useState } from "react";
import { getUsage, type Period, type UsageTotals } from "./api";
import { useTr } from "./i18n";
import { LoadState, fmtCost, fmtNumber, useLoad } from "./ui";

const PERIODS: { id: Period; label: string }[] = [{ id: "today", label: "今天" }, { id: "week", label: "近 7 天" }, { id: "month", label: "近 30 天" }];

function Table({ title, head, rows }: { title: string; head: string; rows: (UsageTotals & { name: string })[] }) {
  const { t, locale } = useTr();
  return <section className="xn-mp-card">
    <h4>{title}</h4>
    {rows.length === 0 ? <p className="xn-mp-muted">{t("这段时间没有记录。")}</p>
      : <table className="xn-mp-table">
        <thead><tr><th scope="col">{head}</th><th scope="col" className="num">{t("请求")}</th><th scope="col" className="num">{t("输入 Token")}</th><th scope="col" className="num">{t("输出 Token")}</th><th scope="col" className="num">{t("费用")}</th></tr></thead>
        <tbody>{rows.map(row => <tr key={row.name}>
          <th scope="row" data-label={head}>{row.name}</th>
          <td className="num" data-label={t("请求")}>{fmtNumber(row.requests, locale)}</td>
          <td className="num" data-label={t("输入 Token")}>{fmtNumber(row.inputTokens, locale)}</td>
          <td className="num" data-label={t("输出 Token")}>{fmtNumber(row.outputTokens, locale)}</td>
          <td className="num" data-label={t("费用")}>{fmtCost(row, locale)}</td>
        </tr>)}</tbody>
      </table>}
  </section>;
}

export function UsageTab() {
  const { t, locale } = useTr();
  const [period, setPeriod] = useState<Period>("today");
  const { data, loading, error, reload } = useLoad(signal => getUsage(period, signal), [period]);
  return <div className="xn-mp-stack">
    <div className="xn-mp-toolbar">
      <label className="xn-mp-field xn-mp-field--inline"><span>{t("时间范围")}</span>
        <select value={period} onChange={event => setPeriod(event.currentTarget.value as Period)}>
          {PERIODS.map(p => <option key={p.id} value={p.id}>{t(p.label)}</option>)}
        </select>
      </label>
    </div>
    {!data ? <LoadState loading={loading} error={error} data={data} retry={reload} /> : <>
      <ul className="xn-mp-stats" aria-label={t("合计")}>
        <li><strong>{fmtNumber(data.totals.requests, locale)}</strong><span>{t("请求")}</span></li>
        <li><strong>{fmtNumber(data.totals.inputTokens, locale)}</strong><span>{t("输入 Token")}</span></li>
        <li><strong>{fmtNumber(data.totals.outputTokens, locale)}</strong><span>{t("输出 Token")}</span></li>
        <li><strong>{fmtCost(data.totals, locale)}</strong><span>{t("费用")}</span></li>
      </ul>
      <Table title={t("按模型")} head={t("模型")} rows={data.byModel.map(r => ({ ...r, name: r.model }))} />
      <Table title={t("按账号")} head={t("账号")} rows={data.byAccount.map(r => ({ ...r, name: r.account }))} />
    </>}
  </div>;
}
