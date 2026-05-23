import { Link } from "react-router-dom";
import { useCallback, useEffect, useMemo, useState } from "react";
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
  nextCheckpointId,
  activeTaskRefreshToken,
  taskCompleteNoticeToken,
}) {
  const [stepMeters, setStepMeters] = useState(1);
  const [activeTask, setActiveTask] = useState(null);
  const [activeTaskLoading, setActiveTaskLoading] = useState(true);
  const [activeTaskError, setActiveTaskError] = useState("");
  const [completionNotice, setCompletionNotice] = useState("");

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
      {completionNotice && (
        <div style={{ color: "#2e7d32", marginTop: 8 }}>
          {completionNotice}
        </div>
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
          nextCheckpointId={nextCheckpointId}
        />
      )}
    </>
  );
}

export default InspectorPage;
