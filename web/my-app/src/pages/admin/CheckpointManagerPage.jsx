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
    <>
      <div className="toolbar">
        <strong style={{ fontSize: 14 }}>路线选择</strong>
        <div className="field" style={{ marginBottom: 0, flex: 1, maxWidth: 360 }}>
          <select
            className="select"
            value={selectedRouteId}
            onChange={handleRouteChange}
            disabled={loadingRoutes}
          >
            <option value="">请选择路线</option>
            {routes.map((route) => (
              <option key={route.routeId} value={route.routeId}>
                {route.name}
              </option>
            ))}
          </select>
        </div>
        <span className="badge">共 {routes.length} 条路线</span>
        <div className="toolbar-spacer" />
        <button
          type="button"
          className="btn btn-sm"
          onClick={loadRoutes}
          disabled={loadingRoutes}
        >
          {loadingRoutes ? "刷新中…" : "刷新路线"}
        </button>
        {selectedRouteId && (
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => loadCheckpoints(selectedRouteId)}
            disabled={loadingCheckpoints}
          >
            {loadingCheckpoints ? "刷新中…" : "刷新打卡点"}
          </button>
        )}
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="card">
        <div className="card-header">
          <div className="card-title">地图编辑</div>
          <span className="badge badge-info">
            距离约束 ≤ 10 米
          </span>
        </div>
        <div className="card-body" style={{ padding: 0 }}>
          <MapContainer
            mode="checkpoint-edit"
            path={routePath}
            points={displayPoints}
            pointManager={pointManagerRef.current}
            onPointsChange={handlePointsChange}
            onValidatePoint={validatePointDistance}
          />
        </div>
      </div>

      <div className="grid grid-3">
        <div className="stat-card primary">
          <div className="stat-label">已选路线</div>
          <div className="stat-value" style={{ fontSize: 18 }}>
            {selectedRouteId
              ? routes.find((r) => String(r.routeId) === String(selectedRouteId))?.name ||
                `#${selectedRouteId}`
              : "—"}
          </div>
          <div className="stat-foot">用于在地图上添加打卡点</div>
        </div>
        <div className="stat-card success">
          <div className="stat-label">已有打卡点</div>
          <div className="stat-value">{checkpoints.length}</div>
          <div className="stat-foot">已保存到路线</div>
        </div>
        <div className="stat-card warning">
          <div className="stat-label">新增打卡点</div>
          <div className="stat-value">{draftPoints.length}</div>
          <div className="stat-foot">尚未保存</div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">新增打卡点（待保存）</div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              className="btn btn-sm"
              onClick={saveDraftPoints}
              disabled={saving}
            >
              {saving ? "保存中…" : "保存新增打卡点"}
            </button>
          </div>
        </div>
        <div className="card-body" style={{ padding: 0 }}>
          {draftPoints.length === 0 && (
            <div className="empty" style={{ padding: 24 }}>
              <div>暂无新增打卡点</div>
              <div style={{ color: "var(--color-text-soft)" }}>在地图上点击路线附近添加（≤10米）</div>
            </div>
          )}

          {draftPoints.length > 0 && (
            <div style={{ overflowX: "auto" }}>
              <table className="table">
                <thead>
                  <tr>
                    <th style={{ width: 60 }}>#</th>
                    <th>名称</th>
                    <th>经度</th>
                    <th>纬度</th>
                    <th style={{ width: 100 }}>操作</th>
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
                      <td>
                        <code style={{ fontSize: 12 }}>
                          {Number(point.longitude).toFixed(6)}
                        </code>
                      </td>
                      <td>
                        <code style={{ fontSize: 12 }}>
                          {Number(point.latitude).toFixed(6)}
                        </code>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="btn btn-sm btn-danger"
                          onClick={() => removeDraftPoint(index)}
                        >
                          删除
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">已存在打卡点</div>
          {lastUpdatedAt && (
            <span style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
              更新于 {new Date(lastUpdatedAt).toLocaleString()}
            </span>
          )}
        </div>
        <div className="card-body" style={{ padding: 0 }}>
          {!loadingCheckpoints && checkpoints.length === 0 && (
            <div className="empty" style={{ padding: 24 }}>
              <div>暂无打卡点</div>
            </div>
          )}

          {checkpoints.length > 0 && (
            <div style={{ overflowX: "auto" }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>SeqNo</th>
                    <th>名称</th>
                    <th>经度</th>
                    <th>纬度</th>
                    <th>状态</th>
                    <th>创建时间</th>
                    <th style={{ width: 100 }}>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {checkpoints.map((point) => (
                    <tr key={point.checkpointId}>
                      <td>{point.seqNo}</td>
                      <td style={{ fontWeight: 500 }}>{point.name}</td>
                      <td>
                        <code style={{ fontSize: 12 }}>
                          {Number(point.longitude).toFixed(6)}
                        </code>
                      </td>
                      <td>
                        <code style={{ fontSize: 12 }}>
                          {Number(point.latitude).toFixed(6)}
                        </code>
                      </td>
                      <td>
                        <span
                          className={
                            "badge " +
                            (point.status === "active"
                              ? "badge-success"
                              : "badge-warning")
                          }
                        >
                          {point.status}
                        </span>
                      </td>
                      <td>
                        {point.createdAt
                          ? new Date(point.createdAt).toLocaleString()
                          : "—"}
                      </td>
                      <td>
                        <button
                          type="button"
                          className="btn btn-sm btn-danger"
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
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default CheckpointManagerPage;
