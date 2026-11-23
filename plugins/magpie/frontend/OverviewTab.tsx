/** Overview: counts, quota cards and today's usage. */
import { getOverview } from "./api";
import { useTr } from "./i18n";
import { LoadState, Windows, fmtCost, fmtNumber, useLoad } from "./ui";

export function OverviewTab() {
  const { t, locale } = useTr();
  const { data, loading, error, reload } = useLoad(signal => getOverview(signal));
  if (!data) return <LoadState loading={loading} error={error} data={data} retry={reload} />;
  const counts: [string, number][] = [
    [t("供应商"), data.counts.providers], [t("API 密钥"), data.counts.keys], [t("登录账号"), data.counts.accounts],
    [t("模型"), data.counts.models], [t("路由组"), data.counts.groups],
  ];
  const usage = data.usage;
  return <div className="xn-mp-stack">
    <ul className="xn-mp-stats" aria-label={t("数量")}>
      {counts.map(([label, value]) => <li key={label}><strong>{fmtNumber(value, locale)}</strong><span>{label}</span></li>)}
    </ul>
    <section className="xn-mp-card">
      <h4>{t("额度")}</h4>
      {data.quotas.length === 0
        ? <p className="xn-mp-muted">{t("还没有可显示的额度。登录订阅账号后会出现在这里。")}</p>
        : <div className="xn-mp-grid">{data.quotas.map((q, index) => <article key={`${q.provider}-${q.account}-${index}`} className="xn-mp-subcard">
          <header><strong>{q.account}</strong>{q.plan && <span className="xn-mp-chip">{q.plan}</span>}</header>
          <small className="xn-mp-muted">{q.provider}</small>
          <Windows windows={q.windows} />
        </article>)}</div>}
    </section>
    <section className="xn-mp-card">
      <h4>{t("今日用量")}</h4>
      {!usage ? <p className="xn-mp-muted">{t("暂无用量数据。")}</p>
        : <ul className="xn-mp-stats xn-mp-stats--flat">
          <li><strong>{fmtNumber(usage.requests, locale)}</strong><span>{t("请求")}</span></li>
          <li><strong>{fmtNumber(usage.inputTokens, locale)}</strong><span>{t("输入 Token")}</span></li>
          <li><strong>{fmtNumber(usage.outputTokens, locale)}</strong><span>{t("输出 Token")}</span></li>
          <li><strong>{fmtCost(usage, locale)}</strong><span>{t("费用")}</span></li>
        </ul>}
    </section>
  </div>;
}
