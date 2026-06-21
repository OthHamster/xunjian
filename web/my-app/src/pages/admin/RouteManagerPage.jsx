import { useEffect, useRef, useState } from "react";
import MapContainer from "./MapContainer";
import PathManager from "../../utils/pathManager";

function RouteManagerPage({ apiBaseUrl }) {
  const [routes, setRoutes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [newRouteName, setNewRouteName] = useState("");
  const [currentPath, setCurrentPath] = useState([]);
  const [editIndex, setEditIndex] = useState(-1);
  const [editingRouteId, setEditingRouteId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const pathManagerRef = useRef(new PathManager());

  const buildApiUrl = (path) => new URL(path, apiBaseUrl).toString();

  const loadRoutes = async () => {
    setLoading(true);
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
      setLastUpdatedAt(Date.now());
    } catch (fetchError) {
      console.error("load routes error:", fetchError);
      setError("网络异常，获取路线列表失败");
      setRoutes([]);
    } finally {
      setLoading(false);
    }
  };

  const beginCreate = () => {
    const manager = pathManagerRef.current;
    manager.clear();
    manager.setEditIndex(-1);
    setEditIndex(manager.getEditIndex());
    setCurrentPath(manager.getCurrentPath());
    setNewRouteName("");
    setError("");
    setEditingRouteId(null);
    setIsEditing(true);
  };

  const cancelCreate = () => {
    pathManagerRef.current.clear();
    setIsEditing(false);
    setNewRouteName("");
    setCurrentPath([]);
    setEditIndex(-1);
    setEditingRouteId(null);
  };

  const handlePathsChange = (path) => {
    const manager = pathManagerRef.current;
    setEditIndex(manager.getEditIndex());
    if (Array.isArray(path)) {
      setCurrentPath(path);
    } else {
      setCurrentPath([]);
    }
  };

  const removePoint = (index) => {
    try {
      pathManagerRef.current.removeCoordinateAt(index);
      setCurrentPath(pathManagerRef.current.getCurrentPath());
      setEditIndex(pathManagerRef.current.getEditIndex());
    } catch (err) {
      console.error("remove point error:", err);
      setError("删除坐标失败");
    }
  };

  const setInsertPointer = (index) => {
    try {
      pathManagerRef.current.setEditIndex(index);
      setEditIndex(index);
    } catch (err) {
      console.error("set insert pointer error:", err);
      setError("设置插入点失败");
    }
  };

  const clearInsertPointer = () => {
    try {
      pathManagerRef.current.setEditIndex(-1);
      setEditIndex(-1);
    } catch (err) {
      console.error("clear insert pointer error:", err);
      setError("清除插入点失败");
    }
  };

  const beginEditRoute = async (routeId) => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(buildApiUrl(`routes/${routeId}`), {
        method: "GET",
        credentials: "include",
      });
      const data = await response.json();

      if (!response.ok || !data?.success) {
        setError(data?.error || "获取路线详情失败");
        return;
      }

      const manager = pathManagerRef.current;
      manager.setPath(
        Array.isArray(data.wgs84Coordinates) ? data.wgs84Coordinates : [],
      );
      manager.setEditIndex(-1);
      setEditIndex(manager.getEditIndex());
      setCurrentPath(manager.getCurrentPath());
      setNewRouteName(data.name || "");
      setEditingRouteId(routeId);
      setIsEditing(true);
    } catch (fetchError) {
      console.error("get route detail error:", fetchError);
      setError("网络异常，获取路线详情失败");
    } finally {
      setLoading(false);
    }
  };

  const saveRoute = async () => {
    const routeName = newRouteName.trim();
    if (!editingRouteId && !routeName) {
      setError("路线名称不能为空");
      return;
    }

    if (currentPath.length < 2) {
      setError("至少需要两个坐标点");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const isEditingRoute = Number.isInteger(editingRouteId);
      const response = await fetch(
        buildApiUrl(isEditingRoute ? `routes/${editingRouteId}` : "routes"),
        {
          method: isEditingRoute ? "PUT" : "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify(
            isEditingRoute
              ? { coordinates: currentPath }
              : { name: routeName, coordinates: currentPath },
          ),
        },
      );

      const data = await response.json();

      if (!response.ok || !data?.success) {
        setError(
          data?.error || (editingRouteId ? "更新路线失败" : "新增路线失败"),
        );
        return;
      }

      cancelCreate();
      await loadRoutes();
    } catch (saveError) {
      console.error("save route error:", saveError);
      setError(
        editingRouteId ? "网络异常，更新路线失败" : "网络异常，新增路线失败",
      );
    } finally {
      setSaving(false);
    }
  };

  const deleteRoute = async (routeId) => {
    if (!window.confirm("确定要删除该路线吗？此操作不可撤销。")) {
      return;
    }

    setDeletingId(routeId);
    setError("");

    try {
      const response = await fetch(buildApiUrl(`routes/${routeId}`), {
        method: "DELETE",
        credentials: "include",
      });
      const data = await response.json();

      if (!response.ok || !data?.success) {
        setError(data?.error || "删除路线失败");
        return;
      }

      await loadRoutes();
    } catch (deleteError) {
      console.error("delete route error:", deleteError);
      setError("网络异常，删除路线失败");
    } finally {
      setDeletingId(null);
    }
  };

  useEffect(() => {
    loadRoutes();
  }, []);

  return (
    <>
      {!isEditing && (
        <div className="toolbar">
          <strong style={{ fontSize: 14 }}>路线列表</strong>
          <span className="badge">{routes.length} 条</span>
          <div className="toolbar-spacer" />
          <button type="button" className="btn btn-sm" onClick={loadRoutes}>
            {loading ? "刷新中…" : "刷新"}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={beginCreate}
          >
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none">
              <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            添加新路线
          </button>
        </div>
      )}

      {isEditing && (
        <div className="card">
          <div className="card-header">
            <div className="card-title">
              {Number.isInteger(editingRouteId) ? "编辑路线" : "新建路线"}
            </div>
            <span className="badge badge-primary">
              路径编辑模式
            </span>
          </div>
          <div className="card-body" style={{ display: "grid", gap: 16 }}>
            <div className="field" style={{ marginBottom: 0 }}>
              <label className="field-label" htmlFor="routeName">
                路线名称
              </label>
              <input
                id="routeName"
                className="input"
                type="text"
                value={newRouteName}
                onChange={(event) => setNewRouteName(event.target.value)}
                placeholder="请输入路线名称"
                disabled={Number.isInteger(editingRouteId)}
                style={{ maxWidth: 360 }}
              />
              {Number.isInteger(editingRouteId) && (
                <span style={{ fontSize: 12, color: "var(--color-text-soft)" }}>
                  编辑已存在路线（名称不可改）
                </span>
              )}
            </div>

            <div>
              <div className="alert alert-info">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.7" />
                  <path d="M12 8v4M12 16v.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                </svg>
                <span>在地图上点击添加坐标点；右键或选择「插入到此后」可在两节点间插入新点。</span>
              </div>
              <MapContainer
                mode="edit"
                currentPath={currentPath}
                pathManager={pathManagerRef.current}
                onPathsChange={handlePathsChange}
              />
            </div>

            <div>
              <div style={{ display: "flex", alignItems: "center", marginBottom: 8 }}>
                <strong>当前路径坐标</strong>
                <span className="badge" style={{ marginLeft: 10 }}>
                  {currentPath.length} 个点
                </span>
                {editIndex >= 0 && (
                  <span className="badge badge-primary" style={{ marginLeft: 10 }}>
                    插入指针：第 {editIndex + 1} 节点后
                  </span>
                )}
              </div>

              {currentPath.length === 0 && (
                <div className="empty" style={{ padding: 20 }}>
                  <div>暂无坐标，请在地图点击添加。</div>
                </div>
              )}

              {currentPath.length > 0 && (
                <div style={{ overflowX: "auto" }}>
                  <table className="table">
                    <thead>
                      <tr>
                        <th style={{ width: 60 }}>#</th>
                        <th>经度</th>
                        <th>纬度</th>
                        <th style={{ width: 240 }}>操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {currentPath.map((coord, index) => (
                        <tr key={`${coord[0]}-${coord[1]}-${index}`}>
                          <td>{index + 1}</td>
                          <td>
                            <code style={{ fontSize: 12 }}>{Number(coord[0]).toFixed(6)}</code>
                          </td>
                          <td>
                            <code style={{ fontSize: 12 }}>{Number(coord[1]).toFixed(6)}</code>
                          </td>
                          <td>
                            <div style={{ display: "flex", gap: 6 }}>
                              <button
                                type="button"
                                className="btn btn-sm"
                                onClick={() => setInsertPointer(index)}
                              >
                                {editIndex === index ? "已选插入点" : "插入到此后"}
                              </button>
                              <button
                                type="button"
                                className="btn btn-sm btn-danger"
                                onClick={() => removePoint(index)}
                              >
                                删除
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={saveRoute}
                disabled={saving}
              >
                {saving ? "保存中…" : "保存路线"}
              </button>
              <button type="button" className="btn" onClick={cancelCreate}>
                取消
              </button>
              {editIndex >= 0 && (
                <button
                  type="button"
                  className="btn"
                  onClick={clearInsertPointer}
                >
                  清除插入点
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {error && <div className="alert alert-error">{error}</div>}

      {!isEditing && (
        <div className="card">
          <div className="card-header">
            <div className="card-title">路线列表</div>
            {lastUpdatedAt && (
              <span style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
                更新于 {new Date(lastUpdatedAt).toLocaleString()}
              </span>
            )}
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            {loading && (
              <div className="empty">
                <div className="spinner" />
                <span>路线列表加载中…</span>
              </div>
            )}
            {!loading && !error && routes.length === 0 && (
              <div className="empty">
                <div className="empty-icon">
                  <svg viewBox="0 0 24 24" width="22" height="22" fill="none">
                    <circle cx="6" cy="6" r="2.4" stroke="currentColor" strokeWidth="1.7" />
                    <circle cx="18" cy="18" r="2.4" stroke="currentColor" strokeWidth="1.7" />
                    <path d="M8 7c5 0 5 4 8 4M16 17c-5 0-5-4-8-4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                  </svg>
                </div>
                <div>暂无路线</div>
                <div style={{ color: "var(--color-text-soft)" }}>点击「添加新路线」开始</div>
              </div>
            )}

            {routes.length > 0 && (
              <div style={{ overflowX: "auto" }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>RouteID</th>
                      <th>名称</th>
                      <th>长度(米)</th>
                      <th>点位数</th>
                      <th>创建时间</th>
                      <th style={{ width: 200 }}>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {routes.map((route) => (
                      <tr key={route.routeId}>
                        <td style={{ color: "var(--color-text-soft)" }}>#{route.routeId}</td>
                        <td style={{ fontWeight: 500 }}>{route.name}</td>
                        <td>{route.length ?? "—"}</td>
                        <td>{route.pointCount ?? "—"}</td>
                        <td>
                          {route.createdAt
                            ? new Date(route.createdAt).toLocaleString()
                            : "—"}
                        </td>
                        <td>
                          <div style={{ display: "flex", gap: 6 }}>
                            <button
                              type="button"
                              className="btn btn-sm"
                              onClick={() => beginEditRoute(route.routeId)}
                              disabled={loading}
                            >
                              编辑
                            </button>
                            <button
                              type="button"
                              className="btn btn-sm btn-danger"
                              onClick={() => deleteRoute(route.routeId)}
                              disabled={deletingId === route.routeId}
                            >
                              {deletingId === route.routeId ? "删除中…" : "删除"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

export default RouteManagerPage;
