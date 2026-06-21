import { useEffect, useState } from "react";

const ROLE_OPTIONS = ["admin", "inspector", "viewer", "repair"];
const ROLE_BADGE = {
  admin: "badge-danger",
  inspector: "badge-primary",
  viewer: "badge-info",
  repair: "badge-success",
};

function EmptyUsersHint() {
  return <div>暂无用户，请在表格底部添加用户。</div>;
}

function UserManagerPage({ apiBaseUrl }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [error, setError] = useState("");
  const [newUser, setNewUser] = useState({
    username: "",
    password: "",
    roles: "viewer",
  });

  const buildApiUrl = (path) => new URL(path, apiBaseUrl).toString();

  const loadUsers = async () => {
    setLoading(true);
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

      setUsers(
        (data.users || []).map((user) => ({ ...user, isEditing: false })),
      );
    } catch (fetchError) {
      console.error("load users error:", fetchError);
      setError("网络异常，获取用户列表失败");
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const updateUserField = (id, key, value) => {
    setUsers((prev) =>
      prev.map((user) => (user.id === id ? { ...user, [key]: value } : user)),
    );
  };

  const toggleEdit = (id, isEditing) => {
    setUsers((prev) =>
      prev.map((user) => (user.id === id ? { ...user, isEditing } : user)),
    );
  };

  const saveUser = async (user) => {
    setSavingId(user.id);
    setError("");

    try {
      const response = await fetch(buildApiUrl(`users/${user.id}`), {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          username: user.username,
          password: user.password,
          roles: user.roles,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data?.success) {
        setError(data?.error || "更新用户失败");
        return;
      }

      setUsers((prev) =>
        prev.map((item) =>
          item.id === user.id ? { ...data.user, isEditing: false } : item,
        ),
      );
    } catch (saveError) {
      console.error("update user error:", saveError);
      setError("网络异常，更新用户失败");
    } finally {
      setSavingId(null);
    }
  };

  const deleteUser = async (userId) => {
    const ok = window.confirm(`确定删除用户 ID=${userId} 吗？`);
    if (!ok) {
      return;
    }

    setSavingId(userId);
    setError("");

    try {
      const response = await fetch(buildApiUrl(`users/${userId}`), {
        method: "DELETE",
        credentials: "include",
      });
      const data = await response.json();

      if (!response.ok || !data?.success) {
        setError(data?.error || "删除用户失败");
        return;
      }

      setUsers((prev) => prev.filter((user) => user.id !== userId));
    } catch (deleteError) {
      console.error("delete user error:", deleteError);
      setError("网络异常，删除用户失败");
    } finally {
      setSavingId(null);
    }
  };

  const addUser = async () => {
    const payload = {
      username: newUser.username.trim(),
      password: newUser.password.trim(),
      roles: newUser.roles,
    };

    if (!payload.username || !payload.password) {
      setError("用户名和密码不能为空");
      return;
    }

    setSavingId("new");
    setError("");

    try {
      const response = await fetch(buildApiUrl("users"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const data = await response.json();

      if (!response.ok || !data?.success) {
        setError(data?.error || "新增用户失败");
        return;
      }

      setUsers((prev) => [
        ...prev,
        { ...data.user, password: payload.password, isEditing: false },
      ]);
      setNewUser({ username: "", password: "", roles: "viewer" });
    } catch (createError) {
      console.error("create user error:", createError);
      setError("网络异常，新增用户失败");
    } finally {
      setSavingId(null);
    }
  };

  const adminCount = users.filter((u) => u.roles === "admin").length;
  const inspectorCount = users.filter((u) => u.roles === "inspector").length;
  const viewerCount = users.filter((u) => u.roles === "viewer").length;

  return (
    <>
      <div className="grid grid-4">
        <div className="stat-card">
          <div className="stat-label">用户总数</div>
          <div className="stat-value">{loading ? "—" : users.length}</div>
          <div className="stat-foot">含管理员、巡检员、访客</div>
        </div>
        <div className="stat-card danger">
          <div className="stat-label">管理员</div>
          <div className="stat-value">{loading ? "—" : adminCount}</div>
          <div className="stat-foot">系统管理员</div>
        </div>
        <div className="stat-card primary">
          <div className="stat-label">巡检员</div>
          <div className="stat-value">{loading ? "—" : inspectorCount}</div>
          <div className="stat-foot">移动端登录</div>
        </div>
        <div className="stat-card success">
          <div className="stat-label">访客</div>
          <div className="stat-value">{loading ? "—" : viewerCount}</div>
          <div className="stat-foot">只读监管</div>
        </div>
      </div>

      <div className="toolbar">
        <strong style={{ fontSize: 14 }}>用户管理</strong>
        <span className="badge">共 {users.length} 个账号</span>
        <div className="toolbar-spacer" />
        <button type="button" className="btn btn-sm" onClick={loadUsers}>
          刷新
        </button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="card">
        <div className="card-header">
          <div className="card-title">账号列表</div>
          <span style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
            提示：点击「编辑」可修改用户名 / 密码 / 权限
          </span>
        </div>
        <div className="card-body" style={{ padding: 0 }}>
          {loading && (
            <div className="empty">
              <div className="spinner" />
              <span>用户列表加载中…</span>
            </div>
          )}

          {!loading && users.length === 0 && (
            <div className="empty">
              <div className="empty-icon">
                <svg viewBox="0 0 24 24" width="22" height="22" fill="none">
                  <circle cx="12" cy="8" r="3.2" stroke="currentColor" strokeWidth="1.7" />
                  <path d="M5 19c.6-3 3.2-5 7-5s6.4 2 7 5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                </svg>
              </div>
              <div>暂无用户</div>
              <div style={{ color: "var(--color-text-soft)" }}>请使用下方表格添加用户</div>
            </div>
          )}

          {users.length > 0 && (
            <div style={{ overflowX: "auto" }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>用户名</th>
                    <th>密码</th>
                    <th>权限</th>
                    <th style={{ width: 220 }}>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id}>
                      <td style={{ color: "var(--color-text-soft)" }}>#{user.id}</td>
                      <td>
                        <input
                          type="text"
                          value={user.username}
                          disabled={!user.isEditing}
                          onChange={(event) =>
                            updateUserField(user.id, "username", event.target.value)
                          }
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          value={user.password}
                          disabled={!user.isEditing}
                          onChange={(event) =>
                            updateUserField(user.id, "password", event.target.value)
                          }
                        />
                      </td>
                      <td>
                        {user.isEditing ? (
                          <select
                            value={user.roles}
                            onChange={(event) =>
                              updateUserField(user.id, "roles", event.target.value)
                            }
                          >
                            {ROLE_OPTIONS.map((role) => (
                              <option key={role} value={role}>
                                {role}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span className={"badge " + (ROLE_BADGE[user.roles] || "")}>
                            {user.roles}
                          </span>
                        )}
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          {!user.isEditing && (
                            <button
                              type="button"
                              className="btn btn-sm"
                              onClick={() => toggleEdit(user.id, true)}
                              disabled={savingId === user.id}
                            >
                              编辑
                            </button>
                          )}
                          {user.isEditing && (
                            <>
                              <button
                                type="button"
                                className="btn btn-sm btn-primary"
                                onClick={() => saveUser(user)}
                                disabled={savingId === user.id}
                              >
                                {savingId === user.id ? "保存中…" : "保存"}
                              </button>
                              <button
                                type="button"
                                className="btn btn-sm"
                                onClick={() => toggleEdit(user.id, false)}
                                disabled={savingId === user.id}
                              >
                                取消
                              </button>
                            </>
                          )}
                          <button
                            type="button"
                            className="btn btn-sm btn-danger"
                            onClick={() => deleteUser(user.id)}
                            disabled={savingId === user.id}
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
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">添加新用户</div>
          <span className="badge badge-primary">+ 新增</span>
        </div>
        <div className="card-body">
          <div className="grid grid-4" style={{ alignItems: "end" }}>
            <div className="field" style={{ marginBottom: 0 }}>
              <label className="field-label">用户名</label>
              <input
                className="input"
                type="text"
                value={newUser.username}
                placeholder="请输入用户名"
                onChange={(event) =>
                  setNewUser((prev) => ({
                    ...prev,
                    username: event.target.value,
                  }))
                }
              />
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label className="field-label">密码</label>
              <input
                className="input"
                type="text"
                value={newUser.password}
                placeholder="请输入密码"
                onChange={(event) =>
                  setNewUser((prev) => ({
                    ...prev,
                    password: event.target.value,
                  }))
                }
              />
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label className="field-label">角色</label>
              <select
                className="select"
                value={newUser.roles}
                onChange={(event) =>
                  setNewUser((prev) => ({
                    ...prev,
                    roles: event.target.value,
                  }))
                }
              >
                {ROLE_OPTIONS.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              className="btn btn-primary"
              onClick={addUser}
              disabled={savingId === "new"}
            >
              {savingId === "new" ? "添加中…" : "添加用户"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

export default UserManagerPage;
