import { useEffect, useMemo, useState } from "react";

function TaskAssignPage({ apiBaseUrl }) {
  const [users, setUsers] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [selectedUserIds, setSelectedUserIds] = useState(new Set());
  const [selectedRouteIds, setSelectedRouteIds] = useState(new Set());
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadingRoutes, setLoadingRoutes] = useState(true);
  const [loadingTasks, setLoadingTasks] = useState(true);
  const [assigning, setAssigning] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [ongoingTasks, setOngoingTasks] = useState([]);

  const buildApiUrl = (path) => new URL(path, apiBaseUrl).toString();

  const userMap = useMemo(() => {
    const map = new Map();
    users.forEach((user) => map.set(user.id, user));
    return map;
  }, [users]);

  const assignableUsers = useMemo(
    () => users.filter((user) => user.roles === "inspector"),
    [users],
  );

  const routeMap = useMemo(() => {
    const map = new Map();
    routes.forEach((route) => map.set(route.routeId, route));
    return map;
  }, [routes]);

  const loadUsers = async () => {
    setLoadingUsers(true);
    setError("");

    try {
      const response = await fetch(buildApiUrl("users"), {
        method: "GET",
        credentials: "include",
      });
      const data = await response.json();

      if (!response.ok || !data?.success) {
        setError(data?.error || "获取用户列表失败");
        setUsers([]);
        return;
      }

      setUsers(data.users || []);
    } catch (fetchError) {
      console.error("load users error:", fetchError);
      setError("网络异常，获取用户列表失败");
      setUsers([]);
    } finally {
      setLoadingUsers(false);
    }
  };

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

  const loadOngoingTasks = async () => {
    setLoadingTasks(true);
    setError("");

    try {
      const response = await fetch(buildApiUrl("tasks/ongoing"), {
        method: "GET",
        credentials: "include",
      });
      const data = await response.json();

      if (!response.ok || !data?.success) {
        setError(data?.error || "获取进行中任务失败");
        setOngoingTasks([]);
        return;
      }

      setOngoingTasks(data.tasks || []);
    } catch (fetchError) {
      console.error("load ongoing tasks error:", fetchError);
      setError("网络异常，获取进行中任务失败");
      setOngoingTasks([]);
    } finally {
      setLoadingTasks(false);
    }
  };

  useEffect(() => {
    loadUsers();
    loadRoutes();
    loadOngoingTasks();
  }, []);

  const toggleUser = (userId) => {
    setSelectedUserIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  };

  const toggleRoute = (routeId) => {
    setSelectedRouteIds((prev) => {
      const next = new Set(prev);
      if (next.has(routeId)) {
        next.delete(routeId);
      } else {
        next.add(routeId);
      }
      return next;
    });
  };

  const selectAllUsers = () => {
    setSelectedUserIds(new Set(assignableUsers.map((user) => user.id)));
  };

  const clearUsers = () => {
    setSelectedUserIds(new Set());
  };

  const selectAllRoutes = () => {
    setSelectedRouteIds(new Set(routes.map((route) => route.routeId)));
  };

  const clearRoutes = () => {
    setSelectedRouteIds(new Set());
  };

  const assignTasks = async () => {
    if (selectedUserIds.size === 0 || selectedRouteIds.size === 0) {
      setError("请先选择成员和路线");
      return;
    }

    setAssigning(true);
    setError("");
    setResult(null);

    const pairs = [];
    selectedUserIds.forEach((userId) => {
      selectedRouteIds.forEach((routeId) => {
        pairs.push({ userId, routeId });
      });
    });

    try {
      const results = await Promise.all(
        pairs.map(async ({ userId, routeId }) => {
          try {
            const response = await fetch(buildApiUrl("tasks/assign"), {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              credentials: "include",
              body: JSON.stringify({ userId, routeId }),
            });
            const data = await response.json();

            if (!response.ok || !data?.success) {
              return {
                ok: false,
                userId,
                routeId,
                error: data?.error || "分派失败",
              };
            }

            return {
              ok: true,
              userId,
              routeId,
              taskId: data.taskId,
            };
          } catch (requestError) {
            console.error("assign task error:", requestError);
            return {
              ok: false,
              userId,
              routeId,
              error: "网络异常",
            };
          }
        }),
      );

      const successCount = results.filter((item) => item.ok).length;
      const failureCount = results.length - successCount;

      setResult({
        total: results.length,
        successCount,
        failureCount,
        failures: results.filter((item) => !item.ok),
      });
      loadOngoingTasks();
    } finally {
      setAssigning(false);
    }
  };

  return (
    <>
      <div className="toolbar">
        <strong style={{ fontSize: 14 }}>任务派发</strong>
        <span className="badge badge-info">
          已选 {selectedUserIds.size} 人 / {selectedRouteIds.size} 条
        </span>
        <div className="toolbar-spacer" />
        <button
          type="button"
          className="btn btn-sm"
          onClick={loadUsers}
          disabled={loadingUsers}
        >
          {loadingUsers ? "用户加载中…" : "刷新成员"}
        </button>
        <button
          type="button"
          className="btn btn-sm"
          onClick={loadRoutes}
          disabled={loadingRoutes}
        >
          {loadingRoutes ? "路线加载中…" : "刷新路线"}
        </button>
        <button
          type="button"
          className="btn btn-sm"
          onClick={loadOngoingTasks}
          disabled={loadingTasks}
        >
          {loadingTasks ? "任务加载中…" : "刷新任务"}
        </button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {result && (
        <div
          className={
            "alert " + (result.failureCount > 0 ? "alert-warning" : "alert-success")
          }
        >
          已派发 {result.successCount}/{result.total} 条任务
          {result.failureCount > 0 && ` · 失败 ${result.failureCount} 条`}
        </div>
      )}

      <div className="grid grid-2">
        <div className="card">
          <div className="card-header">
            <div className="card-title">选择成员</div>
            <span className="badge">仅 inspector 可派发</span>
          </div>
          <div className="card-body">
            <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
              <button type="button" className="btn btn-sm" onClick={selectAllUsers}>
                全选
              </button>
              <button type="button" className="btn btn-sm" onClick={clearUsers}>
                清空
              </button>
              <span style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
                已选 {selectedUserIds.size} / {assignableUsers.length}
              </span>
            </div>
            <div
              style={{
                maxHeight: 280,
                overflowY: "auto",
                border: "1px solid var(--color-border)",
                borderRadius: "var(--radius-sm)",
              }}
            >
              {loadingUsers && (
                <div className="empty" style={{ padding: 20 }}>
                  <div className="spinner" />
                  <span>成员加载中…</span>
                </div>
              )}
              {!loadingUsers && assignableUsers.length === 0 && (
                <div className="empty" style={{ padding: 20 }}>
                  <div>暂无可派发成员</div>
                </div>
              )}
              {!loadingUsers &&
                assignableUsers.map((user) => (
                  <label
                    key={user.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "8px 12px",
                      borderBottom: "1px solid var(--color-border)",
                      cursor: "pointer",
                      background: selectedUserIds.has(user.id)
                        ? "var(--color-primary-soft)"
                        : "transparent",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={selectedUserIds.has(user.id)}
                      onChange={() => toggleUser(user.id)}
                    />
                    <span style={{ fontWeight: 500 }}>{user.username}</span>
                    <span style={{ fontSize: 12, color: "var(--color-text-soft)" }}>
                      ID: {user.id}
                    </span>
                  </label>
                ))}
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div className="card-title">选择路线</div>
            <span className="badge">共 {routes.length} 条</span>
          </div>
          <div className="card-body">
            <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
              <button type="button" className="btn btn-sm" onClick={selectAllRoutes}>
                全选
              </button>
              <button type="button" className="btn btn-sm" onClick={clearRoutes}>
                清空
              </button>
              <span style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
                已选 {selectedRouteIds.size} / {routes.length}
              </span>
            </div>
            <div
              style={{
                maxHeight: 280,
                overflowY: "auto",
                border: "1px solid var(--color-border)",
                borderRadius: "var(--radius-sm)",
              }}
            >
              {loadingRoutes && (
                <div className="empty" style={{ padding: 20 }}>
                  <div className="spinner" />
                  <span>路线加载中…</span>
                </div>
              )}
              {!loadingRoutes && routes.length === 0 && (
                <div className="empty" style={{ padding: 20 }}>
                  <div>暂无路线</div>
                </div>
              )}
              {!loadingRoutes &&
                routes.map((route) => (
                  <label
                    key={route.routeId}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "8px 12px",
                      borderBottom: "1px solid var(--color-border)",
                      cursor: "pointer",
                      background: selectedRouteIds.has(route.routeId)
                        ? "var(--color-primary-soft)"
                        : "transparent",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={selectedRouteIds.has(route.routeId)}
                      onChange={() => toggleRoute(route.routeId)}
                    />
                    <span style={{ fontWeight: 500 }}>{route.name}</span>
                    <span style={{ fontSize: 12, color: "var(--color-text-soft)" }}>
                      ID: {route.routeId}
                    </span>
                  </label>
                ))}
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-body" style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button
            type="button"
            className="btn btn-primary"
            onClick={assignTasks}
            disabled={assigning}
          >
            {assigning ? "派发中…" : "派发任务"}
          </button>
          <span style={{ fontSize: 13, color: "var(--color-text-muted)" }}>
            将为每位成员派发其选中的全部路线（笛卡尔积）
          </span>
        </div>
      </div>

      {result?.failureCount > 0 && (
        <div className="card">
          <div className="card-header">
            <div className="card-title">派发失败明细</div>
            <span className="badge badge-warning">共 {result.failureCount} 条</span>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            <div style={{ overflowX: "auto" }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>成员</th>
                    <th>路线</th>
                    <th>失败原因</th>
                  </tr>
                </thead>
                <tbody>
                  {result.failures.slice(0, 10).map((item, index) => (
                    <tr key={`${item.userId}-${item.routeId}-${index}`}>
                      <td>
                        {userMap.get(item.userId)?.username || `ID:${item.userId}`}
                      </td>
                      <td>
                        {routeMap.get(item.routeId)?.name || `ID:${item.routeId}`}
                      </td>
                      <td style={{ color: "var(--color-danger)" }}>{item.error}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {result.failureCount > 10 && (
              <div style={{ padding: 12, color: "var(--color-text-soft)", fontSize: 12 }}>
                仅显示前 10 条失败记录
              </div>
            )}
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <div className="card-title">进行中任务</div>
          <span className="badge badge-primary">{ongoingTasks.length} 条</span>
        </div>
        <div className="card-body" style={{ padding: 0 }}>
          {loadingTasks && (
            <div className="empty" style={{ padding: 20 }}>
              <div className="spinner" />
              <span>进行中任务加载中…</span>
            </div>
          )}
          {!loadingTasks && ongoingTasks.length === 0 && (
            <div className="empty" style={{ padding: 24 }}>
              <div className="empty-icon">
                <svg viewBox="0 0 24 24" width="22" height="22" fill="none">
                  <rect x="3" y="4" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.7" />
                  <path d="M8 9h8M8 13h8M8 17h5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                </svg>
              </div>
              <div>暂无进行中任务</div>
            </div>
          )}
          {ongoingTasks.length > 0 && (
            <div style={{ overflowX: "auto" }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>任务ID</th>
                    <th>成员</th>
                    <th>路线</th>
                    <th>派发时间</th>
                  </tr>
                </thead>
                <tbody>
                  {ongoingTasks.map((task) => (
                    <tr key={task.taskId}>
                      <td style={{ color: "var(--color-text-soft)" }}>#{task.taskId}</td>
                      <td>
                        <div style={{ fontWeight: 500 }}>
                          {userMap.get(task.userId)?.username || `ID:${task.userId}`}
                        </div>
                        <div style={{ fontSize: 12, color: "var(--color-text-soft)" }}>
                          ID: {task.userId}
                        </div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 500 }}>
                          {routeMap.get(task.routeId)?.name || `ID:${task.routeId}`}
                        </div>
                        <div style={{ fontSize: 12, color: "var(--color-text-soft)" }}>
                          ID: {task.routeId}
                        </div>
                      </td>
                      <td>{task.assignedAt}</td>
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

export default TaskAssignPage;
