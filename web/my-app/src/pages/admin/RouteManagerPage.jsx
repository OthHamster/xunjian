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
    <div>
      <h3>路线管理</h3>

      {!isEditing && (
        <div style={{ marginBottom: 12 }}>
          <button type="button" onClick={beginCreate} disabled={loading}>
            添加新路线
          </button>
          <button
            type="button"
            onClick={loadRoutes}
            disabled={loading}
            style={{ marginLeft: 8 }}
          >
            {loading ? "刷新中..." : "刷新"}
          </button>
        </div>
      )}

      {isEditing && (
        <div
          style={{ border: "1px solid #ddd", padding: 12, marginBottom: 16 }}
        >
          <div style={{ marginBottom: 12 }}>
            <label htmlFor="routeName">
              路线名称
              <input
                id="routeName"
                type="text"
                value={newRouteName}
                onChange={(event) => setNewRouteName(event.target.value)}
                style={{ marginLeft: 8 }}
                placeholder="请输入路线名称"
                disabled={Number.isInteger(editingRouteId)}
              />
            </label>
            {Number.isInteger(editingRouteId) && (
              <span style={{ marginLeft: 8, color: "#666" }}>
                编辑已存在路线
              </span>
            )}
          </div>

          <MapContainer
            mode="edit"
            currentPath={currentPath}
            pathManager={pathManagerRef.current}
            onPathsChange={handlePathsChange}
          />

          <div style={{ marginTop: 12 }}>
            <strong>当前路径坐标</strong>
          </div>

          {currentPath.length === 0 && (
            <div style={{ marginTop: 8 }}>暂无坐标，请在地图点击添加。</div>
          )}

          {currentPath.length > 0 && (
            <table
              border="1"
              cellPadding="8"
              cellSpacing="0"
              style={{ width: "100%", marginTop: 8 }}
            >
              <thead>
                <tr>
                  <th>#</th>
                  <th>经度</th>
                  <th>纬度</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {currentPath.map((coord, index) => (
                  <tr key={`${coord[0]}-${coord[1]}-${index}`}>
                    <td>{index + 1}</td>
                    <td>{coord[0]}</td>
                    <td>{coord[1]}</td>
                    <td>
                      <button type="button" onClick={() => removePoint(index)}>
                        删除
                      </button>
                      <button
                        type="button"
                        onClick={() => setInsertPointer(index)}
                        style={{ marginLeft: 8 }}
                      >
                        {editIndex === index ? "已选插入点" : "插入到此后"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <div style={{ marginTop: 12 }}>
            <button type="button" onClick={saveRoute} disabled={saving}>
              {saving ? "保存中..." : "保存路线"}
            </button>
            <button
              type="button"
              onClick={cancelCreate}
              style={{ marginLeft: 8 }}
            >
              取消
            </button>
            {editIndex >= 0 && (
              <span style={{ marginLeft: 12 }}>
                当前插入指针: 第 {editIndex + 1} 个节点
              </span>
            )}
            {editIndex >= 0 && (
              <button
                type="button"
                onClick={clearInsertPointer}
                style={{ marginLeft: 8 }}
              >
                清除插入点
              </button>
            )}
          </div>
        </div>
      )}

      {error && (
        <div style={{ color: "#c62828", marginBottom: 12 }}>{error}</div>
      )}

      {!error && lastUpdatedAt && (
        <div style={{ marginBottom: 12 }}>
          最后刷新：{new Date(lastUpdatedAt).toLocaleString()}
        </div>
      )}

      {loading && <div>路线列表加载中...</div>}
      {!loading && !error && routes.length === 0 && <div>暂无路线</div>}

      {!loading && routes.length > 0 && (
        <table
          border="1"
          cellPadding="8"
          cellSpacing="0"
          style={{ width: "100%" }}
        >
          <thead>
            <tr>
              <th>RouteID</th>
              <th>名称</th>
              <th>长度(米)</th>
              <th>点位数</th>
              <th>创建时间</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {routes.map((route) => (
              <tr key={route.routeId}>
                <td>{route.routeId}</td>
                <td>{route.name}</td>
                <td>{route.length ?? "-"}</td>
                <td>{route.pointCount ?? "-"}</td>
                <td>
                  {route.createdAt
                    ? new Date(route.createdAt).toLocaleString()
                    : "-"}
                </td>
                <td>
                  <button
                    type="button"
                    onClick={() => beginEditRoute(route.routeId)}
                    disabled={loading}
                    style={{ marginRight: 8 }}
                  >
                    编辑
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteRoute(route.routeId)}
                    disabled={deletingId === route.routeId}
                  >
                    {deletingId === route.routeId ? "删除中..." : "删除"}
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

export default RouteManagerPage;
