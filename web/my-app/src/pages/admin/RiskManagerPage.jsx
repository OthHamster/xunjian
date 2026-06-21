import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

const RISK_LEVEL_LABELS = {
  low: "低",
  medium: "中",
  high: "高",
};

function RiskManagerPage({ apiBaseUrl }) {
  const navigate = useNavigate();
  const [risks, setRisks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null);

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
      setLastUpdatedAt(Date.now());
    } catch (fetchError) {
      console.error("load risks error:", fetchError);
      setError("网络异常，获取风险列表失败");
      setRisks([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRisks();
  }, []);

  const statusStyle = (status) => {
    if (status === "open") {
      return { color: "#d32f2f", fontWeight: "bold" };
    }
    return { color: "#2e7d32" };
  };

  return (
    <div>
      <h3>风险管理</h3>

      <div style={{ marginBottom: 12 }}>
        <button type="button" onClick={loadRisks} disabled={loading}>
          {loading ? "刷新中..." : "刷新"}
        </button>
      </div>

      {error && (
        <div style={{ color: "#c62828", marginBottom: 12 }}>{error}</div>
      )}

      {!error && lastUpdatedAt && (
        <div style={{ marginBottom: 12 }}>
          最后刷新：{new Date(lastUpdatedAt).toLocaleString()}
        </div>
      )}

      {!loading && risks.length === 0 && !error && <div>暂无风险工单</div>}

      {risks.length > 0 && (
        <table
          border="1"
          cellPadding="8"
          cellSpacing="0"
          style={{ width: "100%", borderCollapse: "collapse" }}
        >
          <thead>
            <tr style={{ backgroundColor: "#f5f5f5" }}>
              <th>ID</th>
              <th>等级</th>
              <th>状态</th>
              <th>描述</th>
              <th>地址</th>
              <th>坐标</th>
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
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = "#f0f0f0";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "";
                }}
              >
                <td>{risk.riskId}</td>
                <td>{RISK_LEVEL_LABELS[risk.riskLevel] || risk.riskLevel}</td>
                <td style={statusStyle(risk.status)}>
                  {risk.status === "open" ? "待处理" : "已解决"}
                  {risk.requestClose ? " (申请关闭)" : ""}
                </td>
                <td style={{ maxWidth: 200, wordBreak: "break-word" }}>
                  {risk.description}
                </td>
                <td>{risk.address || "-"}</td>
                <td>
                  {risk.longitude?.toFixed(6)}, {risk.latitude?.toFixed(6)}
                </td>
                <td>
                  {risk.photoUrl ? risk.photoUrl.split(",").length : 0} 张
                </td>
                <td>
                  {risk.reportedAt
                    ? new Date(risk.reportedAt).toLocaleString()
                    : "-"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default RiskManagerPage;
