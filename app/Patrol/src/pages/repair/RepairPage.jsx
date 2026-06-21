import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";

const LEVEL_LABEL = { low: "低", medium: "中", high: "高" };

function RepairPage({ userInfo, onLogout, apiBaseUrl }) {
  const [risks, setRisks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionMsg, setActionMsg] = useState("");

  const [selectedRisk, setSelectedRisk] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [updateText, setUpdateText] = useState("");
  const [updatePhotos, setUpdatePhotos] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const fileRef = useRef(null);

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

  const openDetail = async (riskId) => {
    setDetailLoading(true);
    setSelectedRisk(null);
    setUpdateText("");
    setUpdatePhotos([]);
    setActionMsg("");
    try {
      const resp = await fetch(buildApiUrl(`risks/${riskId}`), {
        method: "GET",
        credentials: "include",
      });
      const data = await resp.json();
      if (!resp.ok || !data?.success) {
        setActionMsg(data?.error || "获取详情失败");
        return;
      }
      setSelectedRisk(data.risk);
    } catch (err) {
      console.error("load detail error:", err);
      setActionMsg("网络异常");
    } finally {
      setDetailLoading(false);
    }
  };

  const backToList = () => {
    setSelectedRisk(null);
    loadRisks();
  };

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
      if (!resp.ok || !data?.success)
        throw new Error(data?.error || "申请关闭失败");
      setActionMsg("已申请关闭");
      if (selectedRisk && selectedRisk.riskId === riskId)
        setSelectedRisk(data.risk);
      loadRisks();
    } catch (err) {
      console.error("request close error:", err);
      setActionMsg(`失败：${err.message}`);
    }
  };

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
      if (prev[index]?.preview) URL.revokeObjectURL(prev[index].preview);
      return next;
    });
  };

  const handleSubmitUpdate = async () => {
    if (!updateText.trim() && updatePhotos.length === 0) {
      setActionMsg("请填写备注或上传图片");
      return;
    }
    setSubmitting(true);
    setActionMsg("");
    try {
      const formData = new FormData();
      if (updateText.trim()) formData.append("text", updateText.trim());
      for (const photo of updatePhotos)
        formData.append("image", photo.blob, photo.name);
      const resp = await fetch(buildApiUrl(`risks/${selectedRisk.riskId}`), {
        method: "PUT",
        credentials: "include",
        body: formData,
      });
      const data = await resp.json();
      if (!resp.ok || !data?.success)
        throw new Error(data?.error || "更新失败");
      setActionMsg("更新成功");
      setUpdateText("");
      setUpdatePhotos([]);
      setSelectedRisk(data.risk);
    } catch (err) {
      console.error("update risk error:", err);
      setActionMsg(`失败：${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const imgUrl = (url) => {
    if (!url) return "";
    if (url.startsWith("http")) return url;
    return url.startsWith("/") ? `${apiBaseUrl}${url}` : `${apiBaseUrl}/${url}`;
  };

  if (detailLoading) return <div>加载中...</div>;

  // --- 详情视图 ---
  if (selectedRisk) {
    return (
      <>
        <h2>工单详情 #{selectedRisk.riskId}</h2>
        <div style={{ marginBottom: 12 }}>
          <button type="button" onClick={backToList}>
            ← 返回列表
          </button>
        </div>

        {actionMsg && (
          <div
            style={{
              marginBottom: 12,
              color: actionMsg.startsWith("失败") ? "#d33" : "#2e7d32",
            }}
          >
            {actionMsg}
          </div>
        )}

        <div
          style={{
            border: "1px solid #ccc",
            borderRadius: 6,
            padding: 10,
            marginBottom: 12,
            backgroundColor: "#fafafa",
          }}
        >
          <div>
            <strong>等级：</strong>
            {LEVEL_LABEL[selectedRisk.riskLevel]}
          </div>
          <div>
            <strong>状态：</strong>
            <span
              style={{
                color: selectedRisk.status === "open" ? "#d32f2f" : "#2e7d32",
                fontWeight: "bold",
              }}
            >
              {selectedRisk.status === "open" ? "待处理" : "已解决"}
              {selectedRisk.requestClose ? " (已申请关闭)" : ""}
            </span>
          </div>
          <div>
            <strong>地址：</strong>
            {selectedRisk.address || "-"}
          </div>
          <div>
            <strong>上报人：</strong>
            {selectedRisk.reporterUserName || selectedRisk.reporterUserId}
          </div>
          <div>
            <strong>时间：</strong>
            {selectedRisk.reportedAt
              ? new Date(selectedRisk.reportedAt).toLocaleString()
              : "-"}
          </div>
          <div>
            <strong>描述：</strong>
            {selectedRisk.description}
          </div>
          {!selectedRisk.requestClose && selectedRisk.status === "open" && (
            <div style={{ marginTop: 8 }}>
              <button
                type="button"
                onClick={() => handleRequestClose(selectedRisk.riskId)}
              >
                申请关闭
              </button>
            </div>
          )}
        </div>

        <h4>处理记录</h4>
        {(!selectedRisk.logs || selectedRisk.logs.length === 0) && (
          <div style={{ color: "#888", marginBottom: 8 }}>暂无处理记录</div>
        )}
        {selectedRisk.logs &&
          selectedRisk.logs.map((log, i) => (
            <div
              key={i}
              style={{
                border: "1px solid #e0e0e0",
                borderRadius: 4,
                padding: 8,
                marginBottom: 6,
              }}
            >
              <div style={{ fontSize: 12, color: "#888", marginBottom: 4 }}>
                #{i + 1} · {log.username || log.userId || "-"} ·{" "}
                {log.submittedAt
                  ? new Date(log.submittedAt).toLocaleString()
                  : "-"}
              </div>
              <div>{log.text}</div>
              {log.photoUrl && (
                <div
                  style={{
                    display: "flex",
                    gap: 6,
                    flexWrap: "wrap",
                    marginTop: 4,
                  }}
                >
                  {log.photoUrl.split(",").map((url, j) => (
                    <img
                      key={j}
                      src={imgUrl(url)}
                      alt=""
                      style={{
                        width: 80,
                        height: 80,
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

        <div
          style={{
            border: "1px solid #1976d2",
            borderRadius: 6,
            padding: 10,
            marginTop: 12,
            backgroundColor: "#f0f7ff",
          }}
        >
          <h4 style={{ margin: "0 0 8px" }}>添加处理记录</h4>
          <textarea
            value={updateText}
            onChange={(e) => setUpdateText(e.target.value)}
            placeholder="输入处理备注..."
            rows={3}
            style={{ width: "100%", boxSizing: "border-box", marginBottom: 8 }}
          />
          <div style={{ marginBottom: 8 }}>
            <button type="button" onClick={() => fileRef.current?.click()}>
              选择图片
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handlePhotoSelect}
              style={{ display: "none" }}
            />
            <span style={{ marginLeft: 8, fontSize: 12, color: "#888" }}>
              {updatePhotos.length} 张
            </span>
          </div>
          {updatePhotos.length > 0 && (
            <div
              style={{
                display: "flex",
                gap: 6,
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
                      width: 60,
                      height: 60,
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
                      width: 18,
                      height: 18,
                      borderRadius: "50%",
                      border: "none",
                      background: "#d33",
                      color: "#fff",
                      fontSize: 11,
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
        </div>
      </>
    );
  }

  // --- 列表视图 ---
  return (
    <>
      <h2>维护人员页面</h2>
      <div>欢迎你，{userInfo?.username}</div>
      <div>
        <Link to="/">返回主页</Link>
      </div>
      <button type="button" onClick={onLogout}>
        退出登录
      </button>

      <h3 style={{ marginTop: 16 }}>待处理风险工单</h3>
      <div style={{ marginBottom: 12 }}>
        <button type="button" onClick={loadRisks} disabled={loading}>
          {loading ? "刷新中..." : "刷新"}
        </button>
      </div>

      {error && (
        <div style={{ color: "#c62828", marginBottom: 12 }}>{error}</div>
      )}
      {actionMsg && (
        <div
          style={{
            marginBottom: 12,
            color: actionMsg.startsWith("失败") ? "#d33" : "#2e7d32",
          }}
        >
          {actionMsg}
        </div>
      )}

      {!loading && risks.length === 0 && !error && <div>暂无待处理工单</div>}

      {risks.length > 0 && (
        <table
          border="1"
          cellPadding="6"
          cellSpacing="0"
          style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}
        >
          <thead>
            <tr style={{ backgroundColor: "#f5f5f5" }}>
              <th>ID</th>
              <th>等级</th>
              <th>状态</th>
              <th>描述</th>
              <th>上报人</th>
              <th>时间</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {risks.map((risk) => (
              <tr
                key={risk.riskId}
                onClick={() => openDetail(risk.riskId)}
                style={{ cursor: "pointer" }}
              >
                <td>{risk.riskId}</td>
                <td>{LEVEL_LABEL[risk.riskLevel] || risk.riskLevel}</td>
                <td
                  style={{
                    color: risk.requestClose ? "#e65100" : "#d32f2f",
                    fontWeight: "bold",
                  }}
                >
                  {risk.requestClose ? "等待审核" : "待处理"}
                </td>
                <td style={{ maxWidth: 150, wordBreak: "break-word" }}>
                  {risk.description}
                </td>
                <td>{risk.reporterUserName || risk.reporterUserId || "-"}</td>
                <td>
                  {risk.reportedAt
                    ? new Date(risk.reportedAt).toLocaleString()
                    : "-"}
                </td>
                <td>
                  {risk.requestClose ? (
                    <span style={{ color: "#e65100" }}>已申请</span>
                  ) : (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRequestClose(risk.riskId);
                      }}
                    >
                      申请关闭
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}

export default RepairPage;
