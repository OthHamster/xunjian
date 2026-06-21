import { useEffect, useState } from "react";

/**
 * 我的风险工单列表（App 端维修人员查看并申请关闭）
 * @param {{ apiBaseUrl: string }} props
 */
function MyRisks({ apiBaseUrl }) {
  const [risks, setRisks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionMsg, setActionMsg] = useState("");

  const buildApiUrl = (path) => new URL(path, apiBaseUrl).toString();

  const loadRisks = async () => {
    setLoading(true);
    setError("");

    try {
      const resp = await fetch(buildApiUrl("risks?status=open"), {
        method: "GET",
        credentials: "include",
      });
      const data = await resp.json();

      if (!resp.ok || !data?.success) {
        setError(data?.error || "获取风险列表失败");
        setRisks([]);
        return;
      }

      setRisks(data.risks || []);
    } catch (err) {
      console.error("load risks error:", err);
      setError("网络异常");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRisks();
  }, []);

  const handleRequestClose = async (riskId) => {
    setActionMsg("");

    try {
      const formData = new FormData();
      formData.append("requestClose", "1");
      formData.append("text", "申请关闭工单");

      const resp = await fetch(buildApiUrl(`risks/${riskId}`), {
        method: "PUT",
        credentials: "include",
        body: formData,
      });
      const data = await resp.json();

      if (!resp.ok || !data?.success) {
        throw new Error(data?.error || "申请关闭失败");
      }

      setActionMsg(`工单 #${riskId} 已申请关闭`);
      loadRisks();
    } catch (err) {
      console.error("request close error:", err);
      setActionMsg(`失败：${err.message}`);
    }
  };

  const levelLabel = (lv) =>
    ({ low: "低", medium: "中", high: "高" })[lv] || lv;

  return (
    <div
      style={{
        marginTop: 12,
        padding: 10,
        border: "1px solid #ccc",
        borderRadius: 6,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 8,
        }}
      >
        <strong>待处理工单</strong>
        <button type="button" onClick={loadRisks} disabled={loading}>
          {loading ? "刷新中..." : "刷新"}
        </button>
      </div>

      {error && <div style={{ color: "#d33", marginBottom: 8 }}>{error}</div>}
      {actionMsg && (
        <div
          style={{
            color: actionMsg.startsWith("失败") ? "#d33" : "#2e7d32",
            marginBottom: 8,
          }}
        >
          {actionMsg}
        </div>
      )}

      {!loading && risks.length === 0 && !error && (
        <div style={{ color: "#888" }}>暂无待处理工单</div>
      )}

      {risks.map((risk) => (
        <div
          key={risk.riskId}
          style={{
            border: "1px solid #e0e0e0",
            borderRadius: 4,
            padding: 8,
            marginBottom: 6,
          }}
        >
          <div style={{ fontSize: 13, marginBottom: 4 }}>
            <strong>#{risk.riskId}</strong>{" "}
            <span style={{ color: "#d32f2f" }}>
              [{levelLabel(risk.riskLevel)}]
            </span>{" "}
            {risk.requestClose ? (
              <span style={{ color: "#e65100" }}>等待审核</span>
            ) : (
              <button
                type="button"
                onClick={() => handleRequestClose(risk.riskId)}
                style={{ fontSize: 12, marginLeft: 8 }}
              >
                申请关闭
              </button>
            )}
          </div>
          <div style={{ fontSize: 13, color: "#555" }}>{risk.description}</div>
          <div style={{ fontSize: 11, color: "#999", marginTop: 2 }}>
            上报人：{risk.reporterUserName || risk.reporterUserId} ·{" "}
            {risk.reportedAt ? new Date(risk.reportedAt).toLocaleString() : ""}
          </div>
        </div>
      ))}
    </div>
  );
}

export default MyRisks;
