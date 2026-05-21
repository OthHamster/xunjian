import { useEffect, useRef, useState } from "react";
import MapContainer from "./MapContainer";

const USERS_POLL_INTERVAL_MS = 2000;
const ROUTES_POLL_INTERVAL_MS = 10000;

function RealTimeMonitorPage({ apiBaseUrl }) {
  const [users, setUsers] = useState([]);
  const [userCount, setUserCount] = useState(0);
  const [routes, setRoutes] = useState([]);
  const [routePaths, setRoutePaths] = useState([]);
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
      setLastRoutesUpdatedAt(Date.now());
    } catch (fetchError) {
      console.error("load routes error:", fetchError);
      setError("网络异常，获取路线列表失败");
      setRoutes([]);
      setRoutePaths([]);
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
    <div>
      <MapContainer mode="preview" users={users} paths={routePaths} />
      <h3>实时监控</h3>
      <div style={{ marginBottom: 12 }}>
        <button
          type="button"
          onClick={() => {
            loadOnlineUsers();
            loadRoutesWithPaths();
          }}
          disabled={loadingUsers || loadingRoutes}
        >
          {loadingUsers || loadingRoutes ? "刷新中..." : "刷新"}
        </button>
      </div>

      {error && (
        <div style={{ color: "#c62828", marginBottom: 12 }}>{error}</div>
      )}

      {!error && (
        <div style={{ marginBottom: 12 }}>
          在线人数：{userCount}，路线数量：{routes.length}
        </div>
      )}

      {!error && lastUsersUpdatedAt && (
        <div style={{ marginBottom: 12 }}>
          用户刷新：{new Date(lastUsersUpdatedAt).toLocaleString()}
        </div>
      )}

      {!error && lastRoutesUpdatedAt && (
        <div style={{ marginBottom: 12 }}>
          路线刷新：{new Date(lastRoutesUpdatedAt).toLocaleString()}
        </div>
      )}

      {!loadingUsers && users.length === 0 && !error && <div>暂无在线用户</div>}
      {!loadingRoutes && routes.length === 0 && !error && <div>暂无路线</div>}
    </div>
  );
}

export default RealTimeMonitorPage;
