import { useEffect, useMemo, useState } from "react";

function TaskSelection({ apiBaseUrl, userId, onActivate }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tasks, setTasks] = useState([]);
  const [activatingId, setActivatingId] = useState(null);

  const buildApiUrl = useMemo(() => {
    if (!apiBaseUrl) {
      return null;
    }
    return (path) => new URL(path, apiBaseUrl).toString();
  }, [apiBaseUrl]);

  useEffect(() => {
    let mounted = true;

    const loadTasks = async () => {
      if (!buildApiUrl) {
        setError("缺少 API 地址");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError("");

      try {
        const normalizedUserId = Number.parseInt(userId, 10);
        if (!Number.isInteger(normalizedUserId)) {
          throw new Error("用户ID不合法");
        }

        const response = await fetch(
          buildApiUrl(`tasks/ongoing?userId=${normalizedUserId}`),
          {
            method: "GET",
            credentials: "include",
          },
        );

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data?.error || "获取进行中任务失败");
        }

        if (mounted) {
          setTasks(Array.isArray(data?.tasks) ? data.tasks : []);
        }
      } catch (fetchError) {
        if (mounted) {
          setError(fetchError?.message || "获取进行中任务失败");
          setTasks([]);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    loadTasks();

    return () => {
      mounted = false;
    };
  }, [buildApiUrl, userId]);

  const handleActivate = async (taskId) => {
    if (!buildApiUrl) {
      setError("缺少 API 地址");
      return;
    }

    setActivatingId(taskId);
    setError("");

    try {
      const response = await fetch(buildApiUrl("tasks/activate"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ taskId, userId }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "激活任务失败");
      }

      if (typeof onActivate === "function") {
        onActivate(taskId);
      }
    } catch (fetchError) {
      setError(fetchError?.message || "激活任务失败");
    } finally {
      setActivatingId(null);
    }
  };

  return (
    <section style={{ marginTop: 16 }}>
      <h3>进行中任务</h3>
      {loading && <div>任务加载中...</div>}
      {!loading && error && <div style={{ color: "#d33" }}>{error}</div>}
      {!loading && !error && tasks.length === 0 && <div>暂无进行中任务</div>}

      {!loading && !error && tasks.length > 0 && (
        <table
          border="1"
          cellPadding="6"
          style={{ borderCollapse: "collapse" }}
        >
          <thead>
            <tr>
              <th>任务ID</th>
              <th>用户ID</th>
              <th>路线ID</th>
              <th>分配时间</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {tasks.map((task) => (
              <tr key={task.taskId}>
                <td>{task.taskId}</td>
                <td>{task.userId}</td>
                <td>{task.routeId}</td>
                <td>{task.assignedAt}</td>
                <td>
                  <button
                    type="button"
                    onClick={() => handleActivate(task.taskId)}
                    disabled={activatingId === task.taskId}
                  >
                    {activatingId === task.taskId ? "激活中..." : "激活"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

export default TaskSelection;
