import { useEffect, useRef, useState } from "react";
import MapContainer from "./MapContainer";

const POLL_INTERVAL_MS = 2000;

function OnlineUsersPage({ apiBaseUrl }) {
  const [users, setUsers] = useState([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null);
  const isFetchingRef = useRef(false);

  const buildApiUrl = (path) => new URL(path, apiBaseUrl).toString();

  const loadOnlineUsers = async () => {
    if (isFetchingRef.current) {
      return;
    }

    isFetchingRef.current = true;
    setLoading(true);
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
        setCount(0);
        return;
      }

      setUsers(data.users || []);
      setCount(data.count || 0);
      setLastUpdatedAt(Date.now());
    } catch (fetchError) {
      console.error("load online users error:", fetchError);
      setError("网络异常，获取在线用户失败");
      setUsers([]);
      setCount(0);
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  };

  useEffect(() => {
    loadOnlineUsers();

    const timer = setInterval(() => {
      loadOnlineUsers();
    }, POLL_INTERVAL_MS);

    return () => {
      clearInterval(timer);
    };
  }, []);

  return (
    <div>
      <MapContainer mode="preview" users={users} />
      <h3>在线用户</h3>
      <div style={{ marginBottom: 12 }}>
        <button type="button" onClick={loadOnlineUsers} disabled={loading}>
          {loading ? "刷新中..." : "刷新"}
        </button>
      </div>

      {error && (
        <div style={{ color: "#c62828", marginBottom: 12 }}>{error}</div>
      )}

      {!error && <div style={{ marginBottom: 12 }}>当前在线人数：{count}</div>}

      {!error && lastUpdatedAt && (
        <div style={{ marginBottom: 12 }}>
          最后刷新：{new Date(lastUpdatedAt).toLocaleString()}
        </div>
      )}

      {!loading && users.length === 0 && !error && <div>暂无在线用户</div>}

      {!loading && users.length > 0 && (
        <table
          border="1"
          cellPadding="8"
          cellSpacing="0"
          style={{ width: "100%" }}
        >
          <thead>
            <tr>
              <th>SessionID</th>
              <th>ID</th>
              <th>用户名</th>
              <th>权限</th>
              <th>EmployeeID</th>
              <th>定位</th>
              <th>定位更新时间</th>
              <th>登录时间</th>
              <th>上一次心跳</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.sessionId}>
                <td>{user.sessionId}</td>
                <td>{user.id}</td>
                <td>{user.username}</td>
                <td>{user.roles}</td>
                <td>{user.EmployeeID}</td>
                <td>
                  {user.location
                    ? `${user.location.latitude}, ${user.location.longitude}`
                    : "暂无"}
                </td>
                <td>
                  {user.locationUpdatedAt
                    ? new Date(user.locationUpdatedAt).toLocaleString()
                    : "暂无"}
                </td>
                <td>{new Date(user.loginAt).toLocaleString()}</td>
                <td>
                  {user.lastHeartbeatAt
                    ? new Date(user.lastHeartbeatAt).toLocaleString()
                    : "暂无"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default OnlineUsersPage;
