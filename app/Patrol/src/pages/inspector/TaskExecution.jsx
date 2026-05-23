import { useEffect, useMemo, useState } from "react";

function TaskExecution({ task, apiBaseUrl, nextCheckpointId }) {
  const [checkpoint, setCheckpoint] = useState(null);
  const [checkpointError, setCheckpointError] = useState("");

  const buildApiUrl = useMemo(() => {
    if (!apiBaseUrl) {
      return null;
    }
    return (path) => new URL(path, apiBaseUrl).toString();
  }, [apiBaseUrl]);

  useEffect(() => {
    let mounted = true;
    const normalizedCheckpointId = Number.parseInt(nextCheckpointId, 10);

    if (!buildApiUrl) {
      setCheckpointError("缺少 API 地址");
      setCheckpoint(null);
      return () => {
        mounted = false;
      };
    }

    if (!Number.isInteger(normalizedCheckpointId)) {
      setCheckpointError("");
      setCheckpoint(null);
      return () => {
        mounted = false;
      };
    }

    const loadCheckpoint = async () => {
      setCheckpointError("");
      try {
        const response = await fetch(
          buildApiUrl(`checkpoints/${normalizedCheckpointId}`),
          {
            method: "GET",
            credentials: "include",
          },
        );

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data?.error || "获取打卡点失败");
        }

        if (mounted) {
          setCheckpoint(data?.checkpoint || null);
        }
      } catch (error) {
        if (mounted) {
          setCheckpointError(error?.message || "获取打卡点失败");
          setCheckpoint(null);
        }
      }
    };

    loadCheckpoint();

    return () => {
      mounted = false;
    };
  }, [buildApiUrl, nextCheckpointId]);

  if (!task) {
    return null;
  }

  return (
    <section style={{ marginTop: 16 }}>
      <h3>任务执行</h3>
      <div>任务ID: {task.taskId}</div>
      <div>路线ID: {task.routeId}</div>
      <div>分配时间: {task.assignedAt}</div>
      <div style={{ marginTop: 8 }}>
        <strong>下一个打卡点</strong>
      </div>
      {checkpointError && <div style={{ color: "#d33" }}>{checkpointError}</div>}
      {checkpoint ? (
        <div>
          <div>名称: {checkpoint.name}</div>
          <div>序号: {checkpoint.seqNo}</div>
          <div>
            坐标: {checkpoint.longitude},
            {checkpoint.latitude}
          </div>
        </div>
      ) : (
        <div>暂无打卡点信息</div>
      )}
    </section>
  );
}

export default TaskExecution;
