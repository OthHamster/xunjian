import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";

const RISK_LEVEL_LABELS = {
  low: "低",
  medium: "中",
  high: "高",
};

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
    return <div>加载中...</div>;
  }

  if (error) {
    return (
      <div>
        <div style={{ color: "#c62828" }}>{error}</div>
        <Link to="/admin/risks">← 返回风险列表</Link>
      </div>
    );
  }

  if (!risk) {
    return (
      <div>
        <div>风险工单不存在</div>
        <Link to="/admin/risks">← 返回风险列表</Link>
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <Link to="/admin/risks">← 返回风险列表</Link>
      </div>

      <h3>风险工单 #{risk.riskId}</h3>

      {/* 风险基本信息 */}
      <div
        style={{
          border: "1px solid #ccc",
          borderRadius: 6,
          padding: 12,
          marginBottom: 16,
          backgroundColor: "#fafafa",
        }}
      >
        <div style={{ marginBottom: 6 }}>
          <strong>等级：</strong>
          {RISK_LEVEL_LABELS[risk.riskLevel] || risk.riskLevel}
          <span style={{ marginLeft: 16 }}>
            <strong>状态：</strong>
            <span
              style={{
                color: risk.status === "open" ? "#d32f2f" : "#2e7d32",
                fontWeight: "bold",
              }}
            >
              {risk.status === "open" ? "待处理" : "已解决"}
            </span>
            <button
              type="button"
              onClick={handleStatusToggle}
              disabled={submitting}
              style={{ marginLeft: 12, fontSize: 13 }}
            >
              {risk.status === "open" ? "标记已解决" : "重新打开"}
            </button>
            {risk.requestClose ? (
              <span style={{ marginLeft: 12, color: "#e65100", fontSize: 13 }}>
                已申请关闭，等待审核
              </span>
            ) : null}
          </span>
        </div>
        <div style={{ marginBottom: 6 }}>
          <strong>地址：</strong>
          {risk.address || "-"}
        </div>
        <div style={{ marginBottom: 6 }}>
          <strong>坐标：</strong>
          {risk.longitude?.toFixed(6)}, {risk.latitude?.toFixed(6)}
        </div>
        <div style={{ marginBottom: 6 }}>
          <strong>上报时间：</strong>
          {risk.reportedAt ? new Date(risk.reportedAt).toLocaleString() : "-"}
        </div>
        <div>
          <strong>描述：</strong>
          {risk.description}
        </div>
      </div>

      {/* 工单记录 */}
      <h4>处理记录</h4>
      {(!risk.logs || risk.logs.length === 0) && (
        <div style={{ color: "#888", marginBottom: 12 }}>暂无处理记录</div>
      )}
      {risk.logs &&
        risk.logs.map((log, index) => (
          <div
            key={index}
            style={{
              border: "1px solid #e0e0e0",
              borderRadius: 4,
              padding: 10,
              marginBottom: 8,
            }}
          >
            <div style={{ fontSize: 12, color: "#888", marginBottom: 4 }}>
              #{index + 1} · {log.username || log.userId || "-"} ·{" "}
              {log.submittedAt
                ? new Date(log.submittedAt).toLocaleString()
                : "-"}
            </div>
            <div style={{ marginBottom: 4 }}>{log.text}</div>
            {log.photoUrl && (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {log.photoUrl.split(",").map((url, i) => (
                  <img
                    key={i}
                    src={
                      url.startsWith("http://") || url.startsWith("https://")
                        ? url
                        : url.startsWith("/")
                          ? `${apiBaseUrl}${url}`
                          : `${apiBaseUrl}/${url}`
                    }
                    alt={`记录图片${i + 1}`}
                    style={{
                      width: 120,
                      height: 120,
                      objectFit: "cover",
                      borderRadius: 4,
                      border: "1px solid #ddd",
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        ))}

      {/* 更新区域 */}
      <div
        style={{
          border: "1px solid #1976d2",
          borderRadius: 6,
          padding: 12,
          marginTop: 16,
          backgroundColor: "#f0f7ff",
        }}
      >
        <h4 style={{ margin: "0 0 10px" }}>添加处理记录</h4>

        <textarea
          value={updateText}
          onChange={(e) => setUpdateText(e.target.value)}
          placeholder="输入处理备注..."
          rows={3}
          style={{ width: "100%", boxSizing: "border-box", marginBottom: 8 }}
        />

        <div style={{ marginBottom: 8 }}>
          <label
            htmlFor="update-photo-input"
            style={{
              cursor: "pointer",
              color: "#1976d2",
              textDecoration: "underline",
            }}
          >
            添加图片
          </label>
          <input
            id="update-photo-input"
            type="file"
            accept="image/*"
            multiple
            onChange={handlePhotoSelect}
            style={{ display: "none" }}
          />
          <span style={{ marginLeft: 8, fontSize: 13, color: "#888" }}>
            {updatePhotos.length} 张
          </span>
        </div>

        {updatePhotos.length > 0 && (
          <div
            style={{
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
              marginBottom: 10,
            }}
          >
            {updatePhotos.map((p, i) => (
              <div key={i} style={{ position: "relative" }}>
                <img
                  src={p.preview}
                  alt={`预览${i + 1}`}
                  style={{
                    width: 80,
                    height: 80,
                    objectFit: "cover",
                    borderRadius: 4,
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
                    background: "#d33",
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
          onClick={handleSubmitUpdate}
          disabled={submitting}
        >
          {submitting ? "提交中..." : "提交更新"}
        </button>

        {updateMsg && (
          <div
            style={{
              marginTop: 8,
              color: updateMsg.startsWith("更新成功") ? "#2e7d32" : "#d33",
            }}
          >
            {updateMsg}
          </div>
        )}
      </div>
    </div>
  );
}

export default RiskDetailPage;
