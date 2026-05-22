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
    <div>
      <h3>任务派发</h3>
      {error && <div style={{ color: "#c62828" }}>{error}</div>}

      <div style={{ marginBottom: 12 }}>
        <button type="button" onClick={loadUsers} disabled={loadingUsers}>
          {loadingUsers ? "用户加载中..." : "刷新成员"}
        </button>
        <button
          type="button"
          onClick={loadRoutes}
          disabled={loadingRoutes}
          style={{ marginLeft: 8 }}
        >
          {loadingRoutes ? "路线加载中..." : "刷新路线"}
        </button>
        <button
          type="button"
          onClick={loadOngoingTasks}
          disabled={loadingTasks}
          style={{ marginLeft: 8 }}
        >
          {loadingTasks ? "任务加载中..." : "刷新任务"}
        </button>
      </div>

      <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
        <div style={{ minWidth: 260 }}>
          <div style={{ marginBottom: 8 }}>
            <strong>成员</strong>
          </div>
          <div style={{ marginBottom: 8 }}>
            <button type="button" onClick={selectAllUsers}>
              全选成员
            </button>
            <button type="button" onClick={clearUsers} style={{ marginLeft: 8 }}>
              清空成员
            </button>
          </div>
          {loadingUsers && <div>成员加载中...</div>}
          {!loadingUsers && assignableUsers.length === 0 && (
            <div>暂无可派发成员（仅 inspector 权限可派发）</div>
          )}
          {!loadingUsers && assignableUsers.length > 0 && (
            <div style={{ maxHeight: 280, overflowY: "auto" }}>
              {assignableUsers.map((user) => (
                <label
                  key={user.id}
                  style={{ display: "block", marginBottom: 6 }}
                >
                  <input
                    type="checkbox"
                    checked={selectedUserIds.has(user.id)}
                    onChange={() => toggleUser(user.id)}
                  />
                  <span style={{ marginLeft: 6 }}>
                    {user.username} (ID: {user.id}, {user.roles})
                  </span>
                </label>
              ))}
            </div>
          )}
        </div>

        <div style={{ minWidth: 260 }}>
          <div style={{ marginBottom: 8 }}>
            <strong>路线</strong>
          </div>
          <div style={{ marginBottom: 8 }}>
            <button type="button" onClick={selectAllRoutes}>
              全选路线
            </button>
            <button type="button" onClick={clearRoutes} style={{ marginLeft: 8 }}>
              清空路线
            </button>
          </div>
          {loadingRoutes && <div>路线加载中...</div>}
          {!loadingRoutes && routes.length === 0 && <div>暂无路线</div>}
          {!loadingRoutes && routes.length > 0 && (
            <div style={{ maxHeight: 280, overflowY: "auto" }}>
              {routes.map((route) => (
                <label
                  key={route.routeId}
                  style={{ display: "block", marginBottom: 6 }}
                >
                  <input
                    type="checkbox"
                    checked={selectedRouteIds.has(route.routeId)}
                    onChange={() => toggleRoute(route.routeId)}
                  />
                  <span style={{ marginLeft: 6 }}>
                    {route.name} (ID: {route.routeId})
                  </span>
                </label>
              ))}
            </div>
          )}
        </div>
      </div>

      <div style={{ marginTop: 16 }}>
        <button type="button" onClick={assignTasks} disabled={assigning}>
          {assigning ? "派发中..." : "派发任务"}
        </button>
        <span style={{ marginLeft: 12, color: "#555" }}>
          已选成员 {selectedUserIds.size} 人，已选路线 {selectedRouteIds.size} 条
        </span>
      </div>

      {result && (
        <div style={{ marginTop: 12 }}>
          <div>
            已派发 {result.successCount}/{result.total} 条任务
          </div>
          {result.failureCount > 0 && (
            <div style={{ color: "#c62828", marginTop: 8 }}>
              <div>失败 {result.failureCount} 条：</div>
              {result.failures.slice(0, 6).map((item, index) => (
                <div key={`${item.userId}-${item.routeId}-${index}`}>
                  成员 {userMap.get(item.userId)?.username || item.userId} / 路线 {routeMap.get(item.routeId)?.name || item.routeId}：{item.error}
                </div>
              ))}
              {result.failureCount > 6 && (
                <div>仅显示前 6 条失败记录</div>
              )}
            </div>
          )}
        </div>
      )}

      <div style={{ marginTop: 20 }}>
        <h4>进行中任务</h4>
        {loadingTasks && <div>进行中任务加载中...</div>}
        {!loadingTasks && ongoingTasks.length === 0 && (
          <div>暂无进行中任务</div>
        )}
        {!loadingTasks && ongoingTasks.length > 0 && (
          <table
            border="1"
            cellPadding="8"
            cellSpacing="0"
            style={{ width: "100%" }}
          >
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
                  <td>{task.taskId}</td>
                  <td>
                    {userMap.get(task.userId)?.username || task.userId} (ID:
                    {task.userId})
                  </td>
                  <td>
                    {routeMap.get(task.routeId)?.name || task.routeId} (ID:
                    {task.routeId})
                  </td>
                  <td>{task.assignedAt}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export default TaskAssignPage;
