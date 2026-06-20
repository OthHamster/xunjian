import { useState } from "react";
import { Camera, CameraResultType } from "@capacitor/camera";

const RISK_LEVELS = [
  { value: "low", label: "低" },
  { value: "medium", label: "中" },
  { value: "high", label: "高" },
];

/**
 * 提交风险工单组件
 * @param {{ apiBaseUrl: string; currentLocation?: { latitude: number; longitude: number } | null; onSuccess?: (result: object) => void; onError?: (err: Error) => void }} props
 */
function RiskSubmit({ apiBaseUrl, currentLocation, onSuccess, onError }) {
  const [description, setDescription] = useState("");
  const [riskLevel, setRiskLevel] = useState("medium");
  const [address, setAddress] = useState("");
  const [photos, setPhotos] = useState([]); // [{ blob, name, preview }]
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  const handleCapture = async () => {
    try {
      const photo = await Camera.getPhoto({
        resultType: CameraResultType.Base64,
        quality: 80,
        width: 800,
      });

      const base64Data = photo.base64String;
      if (!base64Data) {
        throw new Error("拍照失败：未获取到照片数据");
      }

      const format = photo.format || "jpeg";
      const byteChars = atob(base64Data);
      const byteNums = new Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) {
        byteNums[i] = byteChars.charCodeAt(i);
      }
      const byteArr = new Uint8Array(byteNums);
      const blob = new Blob([byteArr], { type: `image/${format}` });
      const dataUrl = `data:image/${format};base64,${base64Data}`;

      setPhotos((prev) => [
        ...prev,
        { blob, name: `photo_${Date.now()}.${format}`, preview: dataUrl },
      ]);
    } catch (err) {
      console.error("拍照失败:", err);
      setMessage(`拍照失败：${err.message}`);
    }
  };

  const handleRemovePhoto = (index) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    setMessage("");

    if (!description.trim()) {
      setMessage("请输入风险描述");
      return;
    }

    if (!currentLocation) {
      setMessage("无法获取当前位置");
      return;
    }

    setSubmitting(true);

    try {
      const formData = new FormData();
      formData.append("description", description.trim());
      formData.append("riskLevel", riskLevel);
      formData.append("longitude", String(currentLocation.longitude));
      formData.append("latitude", String(currentLocation.latitude));
      if (address.trim()) {
        formData.append("address", address.trim());
      }

      for (const photo of photos) {
        formData.append("image", photo.blob, photo.name);
      }

      const resp = await fetch(new URL("/risks", apiBaseUrl).toString(), {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(data?.error || "提交失败");
      }

      setMessage(`提交成功！风险ID: ${data.riskId}`);
      setDescription("");
      setAddress("");
      setRiskLevel("medium");
      setPhotos([]);

      if (typeof onSuccess === "function") {
        onSuccess(data);
      }
    } catch (err) {
      console.error("提交风险失败:", err);
      setMessage(`提交失败：${err.message}`);
      if (typeof onError === "function") {
        onError(err);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        marginTop: 12,
        padding: 10,
        border: "1px solid #ccc",
        borderRadius: 6,
      }}
    >
      <h3 style={{ margin: "0 0 10px" }}>提交风险工单</h3>

      {/* 描述 */}
      <div style={{ marginBottom: 8 }}>
        <label>风险描述 *</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="请描述发现的风险..."
          rows={3}
          style={{ width: "100%", boxSizing: "border-box", marginTop: 4 }}
        />
      </div>

      {/* 风险等级 */}
      <div style={{ marginBottom: 8 }}>
        <label>风险等级</label>
        <select
          value={riskLevel}
          onChange={(e) => setRiskLevel(e.target.value)}
          style={{ marginLeft: 8 }}
        >
          {RISK_LEVELS.map((lv) => (
            <option key={lv.value} value={lv.value}>
              {lv.label}
            </option>
          ))}
        </select>
      </div>

      {/* 地址 */}
      <div style={{ marginBottom: 8 }}>
        <label>地址（选填）</label>
        <input
          type="text"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="如：某某路口"
          style={{ width: "100%", boxSizing: "border-box", marginTop: 4 }}
        />
      </div>

      {/* 坐标 */}
      <div style={{ marginBottom: 8, fontSize: 13, color: "#666" }}>
        当前坐标：
        {currentLocation
          ? `${currentLocation.longitude?.toFixed(6)}, ${currentLocation.latitude?.toFixed(6)}`
          : "无"}
      </div>

      {/* 拍照区域 */}
      <div style={{ marginBottom: 8 }}>
        <button
          type="button"
          onClick={handleCapture}
          style={{ marginRight: 8 }}
        >
          拍照
        </button>
        <span style={{ fontSize: 13, color: "#888" }}>
          已拍 {photos.length} 张
        </span>
      </div>

      {/* 照片预览 */}
      {photos.length > 0 && (
        <div
          style={{
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
            marginBottom: 10,
          }}
        >
          {photos.map((p, i) => (
            <div key={i} style={{ position: "relative" }}>
              <img
                src={p.preview}
                alt={`照片${i + 1}`}
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
                  lineHeight: "20px",
                  cursor: "pointer",
                }}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {/* 提交按钮 */}
      <button
        type="button"
        onClick={handleSubmit}
        disabled={submitting}
        style={{ marginTop: 4 }}
      >
        {submitting ? "提交中..." : "提交风险"}
      </button>

      {message && (
        <div
          style={{
            marginTop: 8,
            color: message.startsWith("提交成功") ? "#2e7d32" : "#d33",
          }}
        >
          {message}
        </div>
      )}
    </div>
  );
}

export default RiskSubmit;
