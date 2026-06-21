import { useState } from "react";
import { Camera, CameraResultType } from "@capacitor/camera";

/**
 * 拍照并上传到指定风险工单的组件
 * @param {{ riskId: number; apiBaseUrl: string; label?: string; onSuccess?: (result: object) => void; onError?: (err: Error) => void }} props
 */
function PhotoCapture({
  riskId,
  apiBaseUrl,
  label = "拍照并上传",
  onSuccess,
  onError,
}) {
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");

  const handleCaptureAndUpload = async () => {
    setMessage("");
    setUploading(true);

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

      // base64 → Blob
      const byteChars = atob(base64Data);
      const byteNums = new Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) {
        byteNums[i] = byteChars.charCodeAt(i);
      }
      const byteArr = new Uint8Array(byteNums);
      const blob = new Blob([byteArr], {
        type: `image/${photo.format || "jpeg"}`,
      });

      const formData = new FormData();
      formData.append(
        "image",
        blob,
        `photo_${Date.now()}.${photo.format || "jpg"}`,
      );

      const resp = await fetch(
        new URL(`/risks/${riskId}/photo`, apiBaseUrl).toString(),
        {
          method: "POST",
          credentials: "include",
          body: formData,
        },
      );

      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(data?.error || "上传失败");
      }

      setMessage(`上传成功：${data.url}`);
      if (typeof onSuccess === "function") {
        onSuccess(data);
      }
    } catch (err) {
      console.error("拍照上传失败:", err);
      setMessage(`失败：${err.message}`);
      if (typeof onError === "function") {
        onError(err);
      }
    } finally {
      setUploading(false);
    }
  };

  return (
    <div style={{ marginTop: 12, padding: 10, border: "1px dashed #999" }}>
      <div>
        <strong>拍照上传 (RiskID={riskId})</strong>
      </div>
      <button
        type="button"
        onClick={handleCaptureAndUpload}
        disabled={uploading}
        style={{ marginTop: 6 }}
      >
        {uploading ? "上传中..." : label}
      </button>
      {message && <div style={{ marginTop: 4 }}>{message}</div>}
    </div>
  );
}

export default PhotoCapture;
