import { useEffect, useMemo, useState } from "react";
import ObserverMap from "../../components/ObserverMap";

function TaskExecution({
  task,
  apiBaseUrl,
  nextCheckpointId,
  currentLocation,
}) {
  const [checkpoint, setCheckpoint] = useState(null);
  const [checkpointError, setCheckpointError] = useState("");
  const [routePath, setRoutePath] = useState([]);
  const [routeError, setRouteError] = useState("");
  const [routeCheckpoints, setRouteCheckpoints] = useState([]);

  const buildApiUrl = useMemo(() => {
    if (!apiBaseUrl) {
      return null;
    }
    return (path) => new URL(path, apiBaseUrl).toString();
  }, [apiBaseUrl]);

  useEffect(() => {
    let mounted = true;
    const routeId = Number.parseInt(task?.routeId, 10);

    if (!buildApiUrl || !Number.isInteger(routeId)) {
      setRoutePath([]);
      setRouteCheckpoints([]);
      setRouteError("");
      return () => {
        mounted = false;
      };
    }

    const loadRoute = async () => {
      setRouteError("");

      try {
        const [routeRes, checkpointRes] = await Promise.all([
          fetch(buildApiUrl(`routes/${routeId}`), {
            method: "GET",
            credentials: "include",
          }),
          fetch(buildApiUrl(`routes/${routeId}/checkpoints`), {
            method: "GET",
            credentials: "include",
          }),
        ]);

        const routeData = await routeRes.json();
        const checkpointData = await checkpointRes.json();

        if (!routeRes.ok || !routeData?.success) {
          throw new Error(routeData?.error || "获取路线失败");
        }

        if (!checkpointRes.ok || !checkpointData?.success) {
          throw new Error(checkpointData?.error || "获取打卡点失败");
        }

        if (mounted) {
          setRoutePath(
            Array.isArray(routeData?.wgs84Coordinates)
              ? routeData.wgs84Coordinates
              : [],
          );
          setRouteCheckpoints(
            Array.isArray(checkpointData?.checkpoints)
              ? checkpointData.checkpoints
              : [],
          );
        }
      } catch (error) {
        if (mounted) {
          setRouteError(error?.message || "获取路线失败");
          setRoutePath([]);
          setRouteCheckpoints([]);
        }
      }
    };

    loadRoute();

    return () => {
      mounted = false;
    };
  }, [buildApiUrl, task?.routeId]);

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
      <ObserverMap
        currentLocation={currentLocation}
        path={routePath}
        points={routeCheckpoints}
      />
      {routeError && <div style={{ color: "#d33" }}>{routeError}</div>}
      <div>任务ID: {task.taskId}</div>
      <div>路线ID: {task.routeId}</div>
      <div>分配时间: {task.assignedAt}</div>
      <div style={{ marginTop: 8 }}>
        <strong>下一个打卡点</strong>
      </div>
      {checkpointError && (
        <div style={{ color: "#d33" }}>{checkpointError}</div>
      )}
      {checkpoint || task.currentCheckpoint ? (
        <div>
          <div>名称: {(checkpoint || task.currentCheckpoint).name}</div>
          <div>序号: {(checkpoint || task.currentCheckpoint).seqNo}</div>
          <div>
            坐标: {(checkpoint || task.currentCheckpoint).longitude},
            {(checkpoint || task.currentCheckpoint).latitude}
          </div>
        </div>
      ) : (
        <div>暂无打卡点信息</div>
      )}
    </section>
  );
}

export default TaskExecution;
