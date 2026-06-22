import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

const LEVEL_BADGE = {
  low: "badge-info",
  medium: "badge-warning",
  high: "badge-danger",
};
const LEVEL_LABEL = { low: "低", medium: "中", high: "高" };

function RiskManagerPage({ apiBaseUrl }) {
  const navigate = useNavigate();
  const [risks, setRisks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const buildApiUrl = (path) => new URL(path, apiBaseUrl).toString();

  const loadRisks = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(buildApiUrl("risks"), {
        method: "GET",
        credentials: "include",
      });
      const data = await response.json();
      if (!response.ok || !data?.success) {
        setError(data?.error || "获取风险列表失败");
        setRisks([]);
        return;
      }
      setRisks(data.risks || []);
    } catch (fetchError) {
      console.error("load risks error:", fetchError);
      setError("网络异常");
      setRisks([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRisks();
  }, []);

  const openCount = risks.filter((r) => r.status === "open").length;
  const requestCloseCount = risks.filter((r) => r.requestClose).length;
  const resolvedCount = risks.filter((r) => r.status === "resolved").length;

  return (
    <>
      <div className="grid grid-4">
        <div className="stat-card">
          <div className="stat-label">工单总数</div>
          <div className="stat-value">{loading ? "—" : risks.length}</div>
          <div className="stat-foot">全部风险工单</div>
        </div>
        <div className="stat-card danger">
          <div className="stat-label">待处理</div>
          <div className="stat-value">{loading ? "—" : openCount}</div>
          <div className="stat-foot">含申请关闭</div>
        </div>
        <div className="stat-card warning">
          <div className="stat-label">申请关闭</div>
          <div className="stat-value">{loading ? "—" : requestCloseCount}</div>
          <div className="stat-foot">等待审核</div>
        </div>
        <div className="stat-card success">
          <div className="stat-label">已解决</div>
          <div className="stat-value">{loading ? "—" : resolvedCount}</div>
          <div className="stat-foot">已完成处理</div>
        </div>
      </div>

      <div className="toolbar">
        <strong style={{ fontSize: 14 }}>风险管理</strong>
        <span className="badge">共 {risks.length} 个工单</span>
        <div className="toolbar-spacer" />
        <button type="button" className="btn btn-sm" onClick={loadRisks}>
          刷新
        </button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="card">
        <div className="card-header">
          <div className="card-title">风险工单列表</div>
          <span style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
            点击行查看工单详情
          </span>
        </div>
        <div className="card-body" style={{ padding: 0 }}>
          {loading && (
            <div className="empty">
              <div className="spinner" />
              <span>工单列表加载中…</span>
            </div>
          )}

          {!loading && risks.length === 0 && !error && (
            <div className="empty">
              <div className="empty-icon">
                <svg viewBox="0 0 24 24" width="22" height="22" fill="none">
                  <path
                    d="M9 12l2 2 4-4"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                  />
                  <rect
                    x="3"
                    y="3"
                    width="18"
                    height="18"
                    rx="3"
                    stroke="currentColor"
                    strokeWidth="1.7"
                  />
                </svg>
              </div>
              <div>暂无风险工单</div>
              <div style={{ color: "var(--color-text-soft)" }}>
                巡检员上报后这里会显示工单
              </div>
            </div>
          )}

          {risks.length > 0 && (
            <div style={{ overflowX: "auto" }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>等级</th>
                    <th>状态</th>
                    <th>描述</th>
                    <th>上报人</th>
                    <th>地址</th>
                    <th>图片</th>
                    <th>上报时间</th>
                  </tr>
                </thead>
                <tbody>
                  {risks.map((risk) => (
                    <tr
                      key={risk.riskId}
                      onClick={() => navigate(`/admin/risks/${risk.riskId}`)}
                      style={{ cursor: "pointer" }}
                    >
                      <td style={{ color: "var(--color-text-soft)" }}>
                        #{risk.riskId}
                      </td>
                      <td>
                        <span
                          className={
                            "badge " + (LEVEL_BADGE[risk.riskLevel] || "")
                          }
                        >
                          {LEVEL_LABEL[risk.riskLevel] || risk.riskLevel}
                        </span>
                      </td>
                      <td>
                        {risk.requestClose ? (
                          <span
                            className="badge badge-warning"
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 4,
                            }}
                          >
                            <span className="badge-dot" />
                            申请关闭
                          </span>
                        ) : risk.status === "open" ? (
                          <span className="badge badge-danger">待处理</span>
                        ) : (
                          <span className="badge badge-success">已解决</span>
                        )}
                      </td>
                      <td style={{ maxWidth: 200, wordBreak: "break-word" }}>
                        {risk.description}
                      </td>
                      <td>
                        {risk.reporterUserName || risk.reporterUserId || "-"}
                      </td>
                      <td style={{ maxWidth: 120, wordBreak: "break-word" }}>
                        {risk.address || "-"}
                      </td>
                      <td>
                        {risk.photoUrl ? risk.photoUrl.split(",").length : 0} 张
                      </td>
                      <td style={{ fontSize: 12, whiteSpace: "nowrap" }}>
                        {risk.reportedAt
                          ? new Date(risk.reportedAt).toLocaleString()
                          : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default RiskManagerPage;
