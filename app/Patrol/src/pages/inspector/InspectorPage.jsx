import { Link } from "react-router-dom";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Camera, CameraResultType } from "@capacitor/camera";
import TaskSelection from "./TaskSelection";
import TaskExecution from "./TaskExecution";

function getUserRole(user) {
  if (!user) {
    return "";
  }

  if (Array.isArray(user.roles)) {
    return user.roles[0] || "";
  }

  return user.roles || "";
}

function InspectorTextbar({ socketRef }) {
  const [text, setText] = useState("");

  const handleChange = (event) => {
    setText(event.target.value);
    const socket = socketRef.current;
    if (socket) {
      socket.emit("text_update", event.target.value);
    }
  };

  return (
    <>
      <textarea
        value={text}
        onChange={handleChange}
        placeholder="请输入内容..."
        rows={4}
      />
      <div>当前文本: {text}</div>
    </>
  );
}

function InspectorPage({
  userInfo,
  apiBaseUrl,
  onLogout,
  socketStatus,
  socketRef,
  moveOffset,
  onMoveBy,
  onResetOffset,
  currentLocation,
  nextCheckpointId,
  activeTaskRefreshToken,
  taskCompleteNoticeToken,
}) {
  const [stepMeters, setStepMeters] = useState(1);
  const [activeTask, setActiveTask] = useState(null);
  const [activeTaskLoading, setActiveTaskLoading] = useState(true);
  const [activeTaskError, setActiveTaskError] = useState("");
  const [completionNotice, setCompletionNotice] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState("");

  const buildApiUrl = useMemo(() => {
    if (!apiBaseUrl) {
      return null;
    }
    return (path) => new URL(path, apiBaseUrl).toString();
  }, [apiBaseUrl]);

  const handleStepChange = (event) => {
    const next = Number(event.target.value);
    setStepMeters(Number.isFinite(next) && next > 0 ? next : 1);
  };

  const handleMove = (deltaEast, deltaNorth) => {
    if (typeof onMoveBy === "function") {
      onMoveBy(deltaEast, deltaNorth);
    }
  };

  const handleCaptureAndUpload = async () => {
    setUploadResult("");
    setUploading(true);

    try {
      // 调用手机摄像头拍照
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
      const blob = new Blob([byteArr], { type: `image/${photo.format || "jpeg"}` });

      // 构造 FormData 上传到 riskId=1
      const formData = new FormData();
      formData.append("image", blob, `photo_${Date.now()}.${photo.format || "jpg"}`);

      const resp = await fetch(
        new URL("/risks/1/photo", apiBaseUrl).toString(),
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

      setUploadResult(`上传成功：${data.url}`);
    } catch (err) {
      console.error("拍照上传失败:", err);
      setUploadResult(`失败：${err.message}`);
    } finally {
      setUploading(false);
    }
  };

  const loadActiveTask = useCallback(() => {
    let mounted = true;

    const fetchActiveTask = async () => {
      const normalizedUserId = Number.parseInt(userInfo?.id, 10);
      if (!buildApiUrl) {
        setActiveTaskError("缺少 API 地址");
        setActiveTaskLoading(false);
        return;
      }

      if (!Number.isInteger(normalizedUserId)) {
        setActiveTaskError("用户ID不合法");
        setActiveTaskLoading(false);
        return;
      }

      setActiveTaskLoading(true);
      setActiveTaskError("");

      try {
        const response = await fetch(
          buildApiUrl(`tasks/active?userId=${normalizedUserId}`),
          {
            method: "GET",
            credentials: "include",
          },
        );

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data?.error || "获取激活任务失败");
        }

        if (mounted) {
          setActiveTask(data?.task || null);
        }
      } catch (fetchError) {
        if (mounted) {
          setActiveTaskError(fetchError?.message || "获取激活任务失败");
          setActiveTask(null);
        }
      } finally {
        if (mounted) {
          setActiveTaskLoading(false);
        }
      }
    };

    fetchActiveTask();

    return () => {
      mounted = false;
    };
  }, [buildApiUrl, userInfo?.id]);

  useEffect(() => {
    const cleanup = loadActiveTask();
    return () => {
      if (typeof cleanup === "function") {
        cleanup();
      }
    };
  }, [loadActiveTask, activeTaskRefreshToken]);

  useEffect(() => {
    if (!taskCompleteNoticeToken) {
      return undefined;
    }

    setCompletionNotice("任务已完成，可重新选择任务");
    const timer = setTimeout(() => {
      setCompletionNotice("");
    }, 4000);

    return () => {
      clearTimeout(timer);
    };
  }, [taskCompleteNoticeToken]);

  return (
    <>
      <h2>巡检子页面</h2>
      <div>欢迎你，{userInfo.username}</div>
      <div>当前角色：{getUserRole(userInfo)}</div>
      <div>Socket: {socketStatus}</div>

      <div>
        <Link to="/">返回主页</Link>
      </div>
      <button type="button" onClick={onLogout}>
        退出登录
      </button>

      <div style={{ marginTop: 16 }}>
        <div style={{ marginBottom: 8 }}>虚拟摇杆</div>
        <label>
          步长(米)
          <input
            type="number"
            min="0.1"
            step="0.1"
            value={stepMeters}
            onChange={handleStepChange}
            style={{ marginLeft: 8, width: 90 }}
          />
        </label>
        <div style={{ marginTop: 12, display: "inline-block" }}>
          <div style={{ textAlign: "center" }}>
            <button type="button" onClick={() => handleMove(0, stepMeters)}>
              ↑
            </button>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button type="button" onClick={() => handleMove(-stepMeters, 0)}>
              ←
            </button>
            <button type="button" onClick={() => handleMove(0, 0)} disabled>
              ●
            </button>
            <button type="button" onClick={() => handleMove(stepMeters, 0)}>
              →
            </button>
          </div>
          <div style={{ textAlign: "center", marginTop: 8 }}>
            <button type="button" onClick={() => handleMove(0, -stepMeters)}>
              ↓
            </button>
          </div>
        </div>
        <div style={{ marginTop: 12 }}>
          累计偏移：东 {moveOffset?.east ?? 0}m，北 {moveOffset?.north ?? 0}m
        </div>
        <button type="button" onClick={onResetOffset} style={{ marginTop: 8 }}>
          重置偏移
        </button>
      </div>

      <InspectorTextbar socketRef={socketRef} />

      <div style={{ marginTop: 12, padding: 10, border: "1px dashed #999" }}>
        <div><strong>测试：拍照上传 (RiskID=1)</strong></div>
        <button
          type="button"
          onClick={handleCaptureAndUpload}
          disabled={uploading}
          style={{ marginTop: 6 }}
        >
          {uploading ? "上传中..." : "拍照并上传"}
        </button>
        {uploadResult && <div style={{ marginTop: 4 }}>{uploadResult}</div>}
      </div>

      {completionNotice && (
        <div style={{ color: "#2e7d32", marginTop: 8 }}>{completionNotice}</div>
      )}
      {activeTaskLoading && <div>激活任务加载中...</div>}
      {!activeTaskLoading && activeTaskError && (
        <div style={{ color: "#d33" }}>{activeTaskError}</div>
      )}
      {!activeTaskLoading && !activeTaskError && !activeTask && (
        <TaskSelection
          apiBaseUrl={apiBaseUrl}
          userId={userInfo?.id}
          onActivate={loadActiveTask}
        />
      )}
      {!activeTaskLoading && !activeTaskError && activeTask && (
        <TaskExecution
          task={activeTask}
          apiBaseUrl={apiBaseUrl}
          currentLocation={currentLocation}
          nextCheckpointId={nextCheckpointId}
        />
      )}
    </>
  );
}

export default InspectorPage;
