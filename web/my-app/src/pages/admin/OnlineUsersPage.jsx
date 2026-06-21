import { useEffect, useRef, useState } from "react";
import MapContainer from "./MapContainer";

const POLL_INTERVAL_MS = 2000;

const ROLE_BADGE = {
  admin: "badge-danger",
  inspector: "badge-primary",
  viewer: "badge-info",
};

function fmtTime(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

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
    <>
      <div className="grid grid-3">
        <div className="stat-card primary">
          <div className="stat-label">在岗人数</div>
          <div className="stat-value">{loading ? "—" : count}</div>
          <div className="stat-foot">实时刷新（每 2 秒）</div>
        </div>
        <div className="stat-card success">
          <div className="stat-label">最后更新</div>
          <div className="stat-value" style={{ fontSize: 18 }}>
            {lastUpdatedAt ? new Date(lastUpdatedAt).toLocaleTimeString() : "—"}
          </div>
          <div className="stat-foot">自动轮询中</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">状态</div>
          <div className="stat-value" style={{ fontSize: 18 }}>
            {error ? (
              <span className="badge badge-danger">异常</span>
            ) : (
              <span className="badge badge-success">运行中</span>
            )}
          </div>
          <div className="stat-foot">Socket.IO 在线检测</div>
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
              onClick={loadOnlineUsers}
              disabled={loading}
            >
              {loading ? "刷新中…" : "刷新"}
            </button>
          </div>
        </div>
        <div className="card-body" style={{ padding: 0 }}>
          <MapContainer mode="preview" users={users} />
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">在线用户列表</div>
          <span className="badge">{users.length} 人</span>
        </div>
        <div className="card-body" style={{ padding: 0 }}>
          {error && (
            <div className="alert alert-error" style={{ margin: 16 }}>
              {error}
            </div>
          )}

          {!loading && users.length === 0 && !error && (
            <div className="empty">
              <div className="empty-icon">
                <svg viewBox="0 0 24 24" width="22" height="22" fill="none">
                  <circle cx="12" cy="9" r="3.2" stroke="currentColor" strokeWidth="1.7" />
                  <path d="M5 19c.6-3 3.2-5 7-5s6.4 2 7 5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                </svg>
              </div>
              <div>暂无在线用户</div>
            </div>
          )}

          {users.length > 0 && (
            <div style={{ overflowX: "auto" }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>用户</th>
                    <th>角色</th>
                    <th>EmployeeID</th>
                    <th>位置</th>
                    <th>位置更新时间</th>
                    <th>登录时间</th>
                    <th>最近心跳</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.sessionId}>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div
                            style={{
                              width: 30,
                              height: 30,
                              borderRadius: "50%",
                              background:
                                "linear-gradient(135deg,#1677ff 0%,#0ea5e9 100%)",
                              color: "#fff",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: 12,
                              fontWeight: 600,
                            }}
                          >
                            {(user.username || "?").slice(0, 1).toUpperCase()}
                          </div>
                          <div>
                            <div style={{ fontWeight: 500 }}>{user.username}</div>
                            <div style={{ fontSize: 12, color: "var(--color-text-soft)" }}>
                              ID: {user.id}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className={"badge " + (ROLE_BADGE[user.roles] || "")}>
                          {user.roles}
                        </span>
                      </td>
                      <td>{user.EmployeeID || "—"}</td>
                      <td>
                        {user.location ? (
                          <code style={{ fontSize: 12 }}>
                            {user.location.latitude.toFixed(5)},{" "}
                            {user.location.longitude.toFixed(5)}
                          </code>
                        ) : (
                          <span style={{ color: "var(--color-text-soft)" }}>暂无</span>
                        )}
                      </td>
                      <td>{fmtTime(user.locationUpdatedAt)}</td>
                      <td>{fmtTime(user.loginAt)}</td>
                      <td>
                        <span
                          className={
                            "status-dot " +
                            (user.lastHeartbeatAt ? "online" : "offline")
                          }
                          style={{ marginRight: 4 }}
                        />
                        {fmtTime(user.lastHeartbeatAt)}
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

export default OnlineUsersPage;
