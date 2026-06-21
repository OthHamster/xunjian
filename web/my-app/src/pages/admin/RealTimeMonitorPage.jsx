import { useEffect, useRef, useState } from "react";
import MapContainer from "./MapContainer";

const USERS_POLL_INTERVAL_MS = 2000;
const ROUTES_POLL_INTERVAL_MS = 10000;

function RealTimeMonitorPage({ apiBaseUrl }) {
  const [users, setUsers] = useState([]);
  const [userCount, setUserCount] = useState(0);
  const [routes, setRoutes] = useState([]);
  const [routePaths, setRoutePaths] = useState([]);
  const [checkpoints, setCheckpoints] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadingRoutes, setLoadingRoutes] = useState(true);
  const [error, setError] = useState("");
  const [lastUsersUpdatedAt, setLastUsersUpdatedAt] = useState(null);
  const [lastRoutesUpdatedAt, setLastRoutesUpdatedAt] = useState(null);
  const isFetchingUsersRef = useRef(false);
  const isFetchingRoutesRef = useRef(false);

  const buildApiUrl = (path) => new URL(path, apiBaseUrl).toString();

  const loadOnlineUsers = async () => {
    if (isFetchingUsersRef.current) {
      return;
    }

    isFetchingUsersRef.current = true;
    setLoadingUsers(true);
    setError("");

    try {
      const response = await fetch(buildApiUrl("online-users"), {
        method: "GET",
        credentials: "include",
      });
      const data = await response.json();

      if (!response.ok || !data?.success) {
        setError(data?.error || "获取在线用户失败");
        setUsers([]);
        setUserCount(0);
        return;
      }

      setUsers(data.users || []);
      setUserCount(data.count || 0);
      setLastUsersUpdatedAt(Date.now());
    } catch (fetchError) {
      console.error("load online users error:", fetchError);
      setError("网络异常，获取在线用户失败");
      setUsers([]);
      setUserCount(0);
    } finally {
      setLoadingUsers(false);
      isFetchingUsersRef.current = false;
    }
  };

  const loadRoutesWithPaths = async () => {
    if (isFetchingRoutesRef.current) {
      return;
    }

    isFetchingRoutesRef.current = true;
    setLoadingRoutes(true);
    setError("");

    try {
      const listResponse = await fetch(buildApiUrl("routes"), {
        method: "GET",
        credentials: "include",
      });
      const listData = await listResponse.json();

      if (!listResponse.ok || !listData?.success) {
        setError(listData?.error || "获取路线列表失败");
        setRoutes([]);
        setRoutePaths([]);
        return;
      }

      const routeList = listData.routes || [];
      setRoutes(routeList);

      if (routeList.length === 0) {
        setRoutePaths([]);
        setLastRoutesUpdatedAt(Date.now());
        return;
      }

      const detailResponses = await Promise.all(
        routeList.map((route) =>
          fetch(buildApiUrl(`routes/${route.routeId}`), {
            method: "GET",
            credentials: "include",
          })
            .then((response) => response.json())
            .catch(() => null),
        ),
      );

      const paths = detailResponses
        .map((item) => (item?.success ? item.wgs84Coordinates : []))
        .filter((path) => Array.isArray(path) && path.length > 1);

      setRoutePaths(paths);

      const checkpointResponses = await Promise.all(
        routeList.map((route) =>
          fetch(buildApiUrl(`routes/${route.routeId}/checkpoints`), {
            method: "GET",
            credentials: "include",
          })
            .then((response) => response.json())
            .catch(() => null),
        ),
      );

      const points = checkpointResponses
        .map((item) => (item?.success ? item.checkpoints : []))
        .flat()
        .map((point, index) => ({
          ...point,
          name: point.name || `打卡点 ${index + 1}`,
        }));

      setCheckpoints(points);
      setLastRoutesUpdatedAt(Date.now());
    } catch (fetchError) {
      console.error("load routes error:", fetchError);
      setError("网络异常，获取路线列表失败");
      setRoutes([]);
      setRoutePaths([]);
      setCheckpoints([]);
    } finally {
      setLoadingRoutes(false);
      isFetchingRoutesRef.current = false;
    }
  };

  useEffect(() => {
    loadOnlineUsers();
    loadRoutesWithPaths();

    const usersTimer = setInterval(() => {
      loadOnlineUsers();
    }, USERS_POLL_INTERVAL_MS);

    const routesTimer = setInterval(() => {
      loadRoutesWithPaths();
    }, ROUTES_POLL_INTERVAL_MS);

    return () => {
      clearInterval(usersTimer);
      clearInterval(routesTimer);
    };
  }, []);

  return (
    <>
      <div className="grid grid-4">
        <div className="stat-card primary">
          <div className="stat-label">在岗人员</div>
          <div className="stat-value">{loadingUsers ? "—" : userCount}</div>
          <div className="stat-foot">每 2 秒刷新</div>
        </div>
        <div className="stat-card success">
          <div className="stat-label">巡检路线</div>
          <div className="stat-value">{loadingRoutes ? "—" : routes.length}</div>
          <div className="stat-foot">每 10 秒刷新</div>
        </div>
        <div className="stat-card warning">
          <div className="stat-label">打卡点</div>
          <div className="stat-value">{loadingRoutes ? "—" : checkpoints.length}</div>
          <div className="stat-foot">路线检查点</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">系统状态</div>
          <div className="stat-value" style={{ fontSize: 18 }}>
            {error ? (
              <span className="badge badge-danger">异常</span>
            ) : (
              <span className="badge badge-success">运行中</span>
            )}
          </div>
          <div className="stat-foot">实时监控视图</div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">实时地图</div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span className="badge badge-success">
              <span className="badge-dot" /> 实时
            </span>
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => {
                loadOnlineUsers();
                loadRoutesWithPaths();
              }}
              disabled={loadingUsers || loadingRoutes}
            >
              {loadingUsers || loadingRoutes ? "刷新中…" : "刷新"}
            </button>
          </div>
        </div>
        <div className="card-body" style={{ padding: 0 }}>
          <MapContainer
            mode="preview"
            users={users}
            paths={routePaths}
            points={checkpoints}
          />
        </div>
      </div>

      <div className="grid grid-2">
        <div className="card">
          <div className="card-header">
            <div className="card-title">人员动态</div>
            {lastUsersUpdatedAt && (
              <span style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
                {new Date(lastUsersUpdatedAt).toLocaleTimeString()}
              </span>
            )}
          </div>
          <div className="card-body">
            {error && <div className="alert alert-error">{error}</div>}
            {!error && (
              <div style={{ display: "grid", gap: 10 }}>
                <Stat label="在岗人数" value={userCount} />
                <Stat label="路线数量" value={routes.length} />
                <Stat
                  label="最后刷新"
                  value={
                    lastUsersUpdatedAt
                      ? new Date(lastUsersUpdatedAt).toLocaleString()
                      : "—"
                  }
                />
              </div>
            )}
            {!loadingUsers && users.length === 0 && !error && (
              <div className="empty" style={{ padding: 20 }}>
                <div>暂无在线用户</div>
              </div>
            )}
          </div>
        </div>
        <div className="card">
          <div className="card-header">
            <div className="card-title">路线状态</div>
            {lastRoutesUpdatedAt && (
              <span style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
                {new Date(lastRoutesUpdatedAt).toLocaleTimeString()}
              </span>
            )}
          </div>
          <div className="card-body">
            {routes.length === 0 && !loadingRoutes && !error && (
              <div className="empty" style={{ padding: 20 }}>
                <div>暂无路线</div>
              </div>
            )}
            {routes.length > 0 && (
              <div style={{ display: "grid", gap: 8 }}>
                {routes.map((r) => (
                  <div
                    key={r.routeId}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "8px 10px",
                      border: "1px solid var(--color-border)",
                      borderRadius: "var(--radius-sm)",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: "50%",
                          background: "var(--color-primary)",
                        }}
                      />
                      <span style={{ fontWeight: 500 }}>{r.name}</span>
                    </div>
                    <span className="badge">ID #{r.routeId}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function Stat({ label, value }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "8px 0",
        borderBottom: "1px dashed var(--color-border)",
      }}
    >
      <span style={{ color: "var(--color-text-muted)" }}>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export default RealTimeMonitorPage;
