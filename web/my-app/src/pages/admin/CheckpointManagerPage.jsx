import { useEffect, useRef, useState } from "react";
import MapContainer from "./MapContainer";
import PointManager from "../../utils/pointManager";

function CheckpointManagerPage({ apiBaseUrl }) {
  const [routes, setRoutes] = useState([]);
  const [selectedRouteId, setSelectedRouteId] = useState("");
  const [routePath, setRoutePath] = useState([]);
  const [checkpoints, setCheckpoints] = useState([]);
  const [draftPoints, setDraftPoints] = useState([]);
  const [loadingRoutes, setLoadingRoutes] = useState(true);
  const [loadingCheckpoints, setLoadingCheckpoints] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null);
  const pointManagerRef = useRef(new PointManager());

  const buildApiUrl = (path) => new URL(path, apiBaseUrl).toString();

  const loadRoutes = async () => {
    setLoadingRoutes(true);
    setError("");

    try {
      const response = await fetch(buildApiUrl("routes"), {
        method: "GET",
        credentials: "include",
      });
      const data = await response.json();

      if (!response.ok || !data?.success) {
        setError(data?.error || "获取路线列表失败");
        setRoutes([]);
        return;
      }

      setRoutes(data.routes || []);
    } catch (fetchError) {
      console.error("load routes error:", fetchError);
      setError("网络异常，获取路线列表失败");
      setRoutes([]);
    } finally {
      setLoadingRoutes(false);
    }
  };

  const loadRouteDetail = async (routeId) => {
    const response = await fetch(buildApiUrl(`routes/${routeId}`), {
      method: "GET",
      credentials: "include",
    });
    const data = await response.json();

    if (!response.ok || !data?.success) {
      throw new Error(data?.error || "获取路线详情失败");
    }

    setRoutePath(
      Array.isArray(data.wgs84Coordinates) ? data.wgs84Coordinates : [],
    );
  };

  const loadCheckpoints = async (routeId) => {
    setLoadingCheckpoints(true);
    setError("");

    try {
      const response = await fetch(
        buildApiUrl(`routes/${routeId}/checkpoints`),
        {
          method: "GET",
          credentials: "include",
        },
      );
      const data = await response.json();

      if (!response.ok || !data?.success) {
        setError(data?.error || "获取打卡点失败");
        setCheckpoints([]);
        return;
      }

      setCheckpoints(data.checkpoints || []);
      setLastUpdatedAt(Date.now());
    } catch (fetchError) {
      console.error("load checkpoints error:", fetchError);
      setError("网络异常，获取打卡点失败");
      setCheckpoints([]);
    } finally {
      setLoadingCheckpoints(false);
    }
  };

  const handleRouteChange = async (event) => {
    const routeId = event.target.value;
    setSelectedRouteId(routeId);
    setRoutePath([]);
    setCheckpoints([]);
    setDraftPoints([]);
    pointManagerRef.current.clear();

    if (!routeId) {
      return;
    }

    try {
      await loadRouteDetail(routeId);
      await loadCheckpoints(routeId);
    } catch (err) {
      console.error("load route detail error:", err);
      setError(err.message || "加载路线失败");
    }
  };

  const handlePointsChange = (points) => {
    if (Array.isArray(points)) {
      setDraftPoints(points);
    } else {
      setDraftPoints([]);
    }
  };

  const validatePointDistance = async (point) => {
    if (!selectedRouteId) {
      setError("请先选择路线");
      return { ok: false, error: "未选择路线" };
    }

    try {
      const [longitude, latitude] = point;
      const response = await fetch(
        buildApiUrl(
          `routes/${selectedRouteId}/distance?longitude=${longitude}&latitude=${latitude}`,
        ),
        {
          method: "GET",
          credentials: "include",
        },
      );
      const data = await response.json();

      if (!response.ok || !data?.success) {
        const message = data?.error || "距离校验失败";
        setError(message);
        return { ok: false, error: message };
      }

      if (typeof data.distance === "number" && data.distance > 10) {
        const message = `打卡点需距路线不超过10米，当前约 ${data.distance.toFixed(2)} 米`;
        setError(message);
        return { ok: false, error: message };
      }

      return { ok: true };
    } catch (error) {
      console.error("validate point distance error:", error);
      setError("网络异常，距离校验失败");
      return { ok: false, error: "网络异常" };
    }
  };

  const updateDraftName = (index, name) => {
    try {
      pointManagerRef.current.updatePointName(index, name);
      setDraftPoints(pointManagerRef.current.getCurrentPoints());
    } catch (err) {
      console.error("update point name error:", err);
      setError("更新打卡点名称失败");
    }
  };

  const removeDraftPoint = (index) => {
    try {
      pointManagerRef.current.removePointAt(index);
      setDraftPoints(pointManagerRef.current.getCurrentPoints());
    } catch (err) {
      console.error("remove point error:", err);
      setError("删除打卡点失败");
    }
  };

  const saveDraftPoints = async () => {
    if (!selectedRouteId) {
      setError("请选择路线");
      return;
    }

    if (draftPoints.length === 0) {
      setError("暂无新增打卡点");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const response = await fetch(
        buildApiUrl(`routes/${selectedRouteId}/checkpoints`),
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({
            checkpoints: draftPoints.map((point) => ({
              name: point.name,
              longitude: point.longitude,
              latitude: point.latitude,
            })),
          }),
        },
      );
      const data = await response.json();

      if (!response.ok || !data?.success) {
        setError(data?.error || "新增打卡点失败");
        return;
      }

      pointManagerRef.current.clear();
      setDraftPoints([]);
      await loadCheckpoints(selectedRouteId);
    } catch (saveError) {
      console.error("save checkpoints error:", saveError);
      setError("网络异常，新增打卡点失败");
    } finally {
      setSaving(false);
    }
  };

  const deleteCheckpoint = async (checkpointId) => {
    if (!window.confirm("确定要删除该打卡点吗？")) {
      return;
    }

    setSaving(true);
    setError("");

    try {
      const response = await fetch(buildApiUrl(`checkpoints/${checkpointId}`), {
        method: "DELETE",
        credentials: "include",
      });
      const data = await response.json();

      if (!response.ok || !data?.success) {
        setError(data?.error || "删除打卡点失败");
        return;
      }

      setCheckpoints((prev) =>
        prev.filter((item) => item.checkpointId !== checkpointId),
      );
    } catch (deleteError) {
      console.error("delete checkpoint error:", deleteError);
      setError("网络异常，删除打卡点失败");
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    loadRoutes();
  }, []);

  const displayPoints = [...checkpoints, ...draftPoints];

  return (
    <div>
      <h3>打卡点管理</h3>
      <div style={{ marginBottom: 12 }}>
        <label>
          选择路线
          <select
            value={selectedRouteId}
            onChange={handleRouteChange}
            disabled={loadingRoutes}
            style={{ marginLeft: 8 }}
          >
            <option value="">请选择路线</option>
            {routes.map((route) => (
              <option key={route.routeId} value={route.routeId}>
                {route.name}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={loadRoutes}
          disabled={loadingRoutes}
          style={{ marginLeft: 8 }}
        >
          {loadingRoutes ? "刷新中..." : "刷新路线"}
        </button>
        {selectedRouteId && (
          <button
            type="button"
            onClick={() => loadCheckpoints(selectedRouteId)}
            disabled={loadingCheckpoints}
            style={{ marginLeft: 8 }}
          >
            {loadingCheckpoints ? "刷新中..." : "刷新打卡点"}
          </button>
        )}
      </div>

      {error && (
        <div style={{ color: "#c62828", marginBottom: 12 }}>{error}</div>
      )}

      <MapContainer
        mode="checkpoint-edit"
        path={routePath}
        points={displayPoints}
        pointManager={pointManagerRef.current}
        onPointsChange={handlePointsChange}
        onValidatePoint={validatePointDistance}
      />

      {lastUpdatedAt && (
        <div style={{ marginBottom: 12 }}>
          最后刷新：{new Date(lastUpdatedAt).toLocaleString()}
        </div>
      )}

      <div style={{ marginTop: 12 }}>
        <button type="button" onClick={saveDraftPoints} disabled={saving}>
          {saving ? "保存中..." : "保存新增打卡点"}
        </button>
      </div>

      <div style={{ marginTop: 12 }}>
        <strong>新增打卡点</strong>
      </div>
      {draftPoints.length === 0 && (
        <div style={{ marginTop: 8 }}>暂无新增打卡点</div>
      )}
      {draftPoints.length > 0 && (
        <table
          border="1"
          cellPadding="8"
          cellSpacing="0"
          style={{ width: "100%", marginTop: 8 }}
        >
          <thead>
            <tr>
              <th>#</th>
              <th>名称</th>
              <th>经度</th>
              <th>纬度</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {draftPoints.map((point, index) => (
              <tr key={`draft-${index}`}>
                <td>{index + 1}</td>
                <td>
                  <input
                    type="text"
                    value={point.name}
                    onChange={(event) =>
                      updateDraftName(index, event.target.value)
                    }
                  />
                </td>
                <td>{point.longitude}</td>
                <td>{point.latitude}</td>
                <td>
                  <button type="button" onClick={() => removeDraftPoint(index)}>
                    删除
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div style={{ marginTop: 16 }}>
        <strong>已存在打卡点</strong>
      </div>
      {!loadingCheckpoints && checkpoints.length === 0 && (
        <div style={{ marginTop: 8 }}>暂无打卡点</div>
      )}
      {checkpoints.length > 0 && (
        <table
          border="1"
          cellPadding="8"
          cellSpacing="0"
          style={{ width: "100%", marginTop: 8 }}
        >
          <thead>
            <tr>
              <th>SeqNo</th>
              <th>名称</th>
              <th>经度</th>
              <th>纬度</th>
              <th>状态</th>
              <th>创建时间</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {checkpoints.map((point) => (
              <tr key={point.checkpointId}>
                <td>{point.seqNo}</td>
                <td>{point.name}</td>
                <td>{point.longitude}</td>
                <td>{point.latitude}</td>
                <td>{point.status}</td>
                <td>
                  {point.createdAt
                    ? new Date(point.createdAt).toLocaleString()
                    : "-"}
                </td>
                <td>
                  <button
                    type="button"
                    onClick={() => deleteCheckpoint(point.checkpointId)}
                    disabled={saving}
                  >
                    删除
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default CheckpointManagerPage;
