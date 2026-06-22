import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";

const LEVEL_BADGE = {
  low: "badge-info",
  medium: "badge-warning",
  high: "badge-danger",
};
const LEVEL_LABEL = { low: "低", medium: "中", high: "高" };

function RiskDetailPage({ apiBaseUrl }) {
  const { riskId } = useParams();
  const [risk, setRisk] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // 更新表单
  const [updateText, setUpdateText] = useState("");
  const [updatePhotos, setUpdatePhotos] = useState([]); // [{ blob, name, preview }]
  const [submitting, setSubmitting] = useState(false);
  const [updateMsg, setUpdateMsg] = useState("");

  const buildApiUrl = (path) => new URL(path, apiBaseUrl).toString();

  const loadRisk = async () => {
    setLoading(true);
    setError("");

    try {
      const resp = await fetch(buildApiUrl(`risks/${riskId}`), {
        method: "GET",
        credentials: "include",
      });
      const data = await resp.json();

      if (!resp.ok || !data?.success) {
        setError(data?.error || "获取风险详情失败");
        setRisk(null);
        return;
      }

      setRisk(data.risk);
    } catch (err) {
      console.error("load risk error:", err);
      setError("网络异常");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRisk();
  }, [riskId]);

  const handlePhotoSelect = (e) => {
    const files = Array.from(e.target.files || []);
    const newPhotos = files.map((file) => ({
      blob: file,
      name: file.name,
      preview: URL.createObjectURL(file),
    }));
    setUpdatePhotos((prev) => [...prev, ...newPhotos]);
  };

  const handleRemovePhoto = (index) => {
    setUpdatePhotos((prev) => {
      const next = prev.filter((_, i) => i !== index);
      // 释放被移除的预览 URL
      if (prev[index]?.preview) {
        URL.revokeObjectURL(prev[index].preview);
      }
      return next;
    });
  };

  const handleSubmitUpdate = async () => {
    if (!updateText.trim() && updatePhotos.length === 0) {
      setUpdateMsg("请填写备注或上传图片");
      return;
    }

    setSubmitting(true);
    setUpdateMsg("");

    try {
      const formData = new FormData();
      if (updateText.trim()) {
        formData.append("text", updateText.trim());
      }
      for (const photo of updatePhotos) {
        formData.append("image", photo.blob, photo.name);
      }

      const resp = await fetch(buildApiUrl(`risks/${riskId}`), {
        method: "PUT",
        credentials: "include",
        body: formData,
      });
      const data = await resp.json();

      if (!resp.ok || !data?.success) {
        throw new Error(data?.error || "更新失败");
      }

      setUpdateMsg("更新成功");
      setUpdateText("");
      setUpdatePhotos([]);
      setRisk(data.risk);
    } catch (err) {
      console.error("update risk error:", err);
      setUpdateMsg(`更新失败：${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusToggle = async () => {
    const newStatus = risk.status === "open" ? "resolved" : "open";
    setSubmitting(true);
    setUpdateMsg("");

    try {
      const formData = new FormData();
      formData.append("status", newStatus);

      const resp = await fetch(buildApiUrl(`risks/${riskId}`), {
        method: "PUT",
        credentials: "include",
        body: formData,
      });
      const data = await resp.json();

      if (!resp.ok || !data?.success) {
        throw new Error(data?.error || "状态更新失败");
      }

      setRisk(data.risk);
      setUpdateMsg(`状态已更新为${newStatus === "open" ? "待处理" : "已解决"}`);
    } catch (err) {
      console.error("toggle status error:", err);
      setUpdateMsg(`失败：${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="empty">
        <div className="spinner" />
        <span>加载中…</span>
      </div>
    );
  }

  if (error) {
    return (
      <>
        <div className="alert alert-error">{error}</div>
        <Link
          to="/admin/risks"
          className="btn btn-sm"
          style={{ marginTop: 12 }}
        >
          ← 返回风险列表
        </Link>
      </>
    );
  }

  if (!risk) {
    return (
      <>
        <div className="empty">风险工单不存在</div>
        <Link
          to="/admin/risks"
          className="btn btn-sm"
          style={{ marginTop: 12 }}
        >
          ← 返回风险列表
        </Link>
      </>
    );
  }

  const imgUrl = (u) => {
    if (!u) return "";
    if (u.startsWith("http")) return u;
    return u.startsWith("/") ? `${apiBaseUrl}${u}` : `${apiBaseUrl}/${u}`;
  };

  return (
    <>
      <div className="toolbar">
        <Link to="/admin/risks" className="btn btn-sm">
          ← 返回列表
        </Link>
        <strong style={{ fontSize: 14 }}>工单详情 #{risk.riskId}</strong>
        <span className={"badge " + (LEVEL_BADGE[risk.riskLevel] || "")}>
          {LEVEL_LABEL[risk.riskLevel] || risk.riskLevel}
        </span>
        {risk.status === "open" ? (
          <span className="badge badge-danger">待处理</span>
        ) : (
          <span className="badge badge-success">已解决</span>
        )}
        {risk.requestClose ? (
          <span
            className="badge badge-warning"
            style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
          >
            <span className="badge-dot" />
            申请关闭
          </span>
        ) : null}
        <div className="toolbar-spacer" />
        <button
          type="button"
          className="btn btn-sm btn-primary"
          onClick={handleStatusToggle}
          disabled={submitting}
        >
          {risk.status === "open" ? "标记已解决" : "重新打开"}
        </button>
      </div>

      {updateMsg && (
        <div
          className={
            "alert " +
            (updateMsg.startsWith("失败") ? "alert-error" : "alert-success")
          }
        >
          {updateMsg}
        </div>
      )}

      <div className="grid grid-2" style={{ marginTop: 16 }}>
        <div className="card">
          <div className="card-header">
            <div className="card-title">基本信息</div>
          </div>
          <div className="card-body">
            <div style={{ marginBottom: 8 }}>
              <span style={{ color: "var(--color-text-soft)" }}>地址</span>
              <div style={{ marginTop: 2 }}>{risk.address || "—"}</div>
            </div>
            <div style={{ marginBottom: 8 }}>
              <span style={{ color: "var(--color-text-soft)" }}>坐标</span>
              <div style={{ marginTop: 2 }}>
                {risk.longitude?.toFixed(6)}, {risk.latitude?.toFixed(6)}
              </div>
            </div>
            <div style={{ marginBottom: 8 }}>
              <span style={{ color: "var(--color-text-soft)" }}>上报人</span>
              <div style={{ marginTop: 2 }}>
                {risk.reporterUserName || risk.reporterUserId || "—"}
              </div>
            </div>
            <div style={{ marginBottom: 8 }}>
              <span style={{ color: "var(--color-text-soft)" }}>上报时间</span>
              <div style={{ marginTop: 2 }}>
                {risk.reportedAt
                  ? new Date(risk.reportedAt).toLocaleString()
                  : "—"}
              </div>
            </div>
            {risk.resolvedAt && (
              <div style={{ marginBottom: 8 }}>
                <span style={{ color: "var(--color-text-soft)" }}>
                  解决时间
                </span>
                <div style={{ marginTop: 2 }}>
                  {new Date(risk.resolvedAt).toLocaleString()}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div className="card-title">风险描述</div>
          </div>
          <div className="card-body">
            {risk.description}
            {risk.photoUrl && (
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  flexWrap: "wrap",
                  marginTop: 12,
                }}
              >
                {risk.photoUrl.split(",").map((url, i) => (
                  <img
                    key={i}
                    src={imgUrl(url)}
                    alt={`现场图${i + 1}`}
                    style={{
                      width: 100,
                      height: 100,
                      objectFit: "cover",
                      borderRadius: 6,
                      border: "1px solid var(--color-border)",
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-header">
          <div className="card-title">处理记录</div>
          <span style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
            共 {risk.logs ? risk.logs.length : 0} 条
          </span>
        </div>
        <div className="card-body">
          {(!risk.logs || risk.logs.length === 0) && (
            <div className="empty" style={{ padding: "20px 0" }}>
              暂无处理记录
            </div>
          )}
          {risk.logs &&
            risk.logs.map((log, i) => (
              <div
                key={i}
                style={{
                  border: "1px solid var(--color-border)",
                  borderRadius: 6,
                  padding: 10,
                  marginBottom: 8,
                  backgroundColor: "var(--color-bg)",
                }}
              >
                <div
                  style={{
                    fontSize: 12,
                    color: "var(--color-text-soft)",
                    marginBottom: 4,
                  }}
                >
                  #{i + 1} · {log.username || log.userId || "—"} ·{" "}
                  {log.submittedAt
                    ? new Date(log.submittedAt).toLocaleString()
                    : "—"}
                </div>
                <div>{log.text}</div>
                {log.photoUrl && (
                  <div
                    style={{
                      display: "flex",
                      gap: 8,
                      flexWrap: "wrap",
                      marginTop: 8,
                    }}
                  >
                    {log.photoUrl.split(",").map((url, j) => (
                      <img
                        key={j}
                        src={imgUrl(url)}
                        alt={`记录${j + 1}`}
                        style={{
                          width: 100,
                          height: 100,
                          objectFit: "cover",
                          borderRadius: 6,
                          border: "1px solid var(--color-border)",
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>
            ))}
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-header">
          <div className="card-title">添加处理记录</div>
        </div>
        <div className="card-body">
          <textarea
            value={updateText}
            onChange={(e) => setUpdateText(e.target.value)}
            placeholder="输入处理备注..."
            rows={3}
            style={{ width: "100%", boxSizing: "border-box", marginBottom: 8 }}
          />

          <div
            style={{
              marginBottom: 8,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <label className="btn btn-sm" style={{ cursor: "pointer" }}>
              选择图片
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handlePhotoSelect}
                style={{ display: "none" }}
              />
            </label>
            <span style={{ fontSize: 12, color: "var(--color-text-soft)" }}>
              {updatePhotos.length} 张已选
            </span>
          </div>

          {updatePhotos.length > 0 && (
            <div
              style={{
                display: "flex",
                gap: 8,
                flexWrap: "wrap",
                marginBottom: 8,
              }}
            >
              {updatePhotos.map((p, i) => (
                <div key={i} style={{ position: "relative" }}>
                  <img
                    src={p.preview}
                    alt=""
                    style={{
                      width: 80,
                      height: 80,
                      objectFit: "cover",
                      borderRadius: 6,
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => handleRemovePhoto(i)}
                    style={{
                      position: "absolute",
                      top: -6,
                      right: -6,
                      width: 20,
                      height: 20,
                      borderRadius: "50%",
                      border: "none",
                      background: "var(--color-danger)",
                      color: "#fff",
                      fontSize: 12,
                      cursor: "pointer",
                    }}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          <button
            type="button"
            className="btn btn-primary"
            onClick={handleSubmitUpdate}
            disabled={submitting}
          >
            {submitting ? "提交中..." : "提交更新"}
          </button>
        </div>
      </div>
    </>
  );
}

export default RiskDetailPage;
