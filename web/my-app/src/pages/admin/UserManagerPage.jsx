import { useEffect, useMemo, useState } from "react";

const ROLE_OPTIONS = ["admin", "inspector", "viewer"];

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

  const hasUsers =users.length > 0;

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

  return (
    <div>
      <h3>用户管理</h3>
      {error && (
        <div style={{ color: "#c62828", marginBottom: 12 }}>{error}</div>
      )}
      {loading && <div>用户列表加载中...</div>}
      {!loading && !hasUsers && <EmptyUsersHint />}

      {!loading && (
        <table
          border="1"
          cellPadding="8"
          cellSpacing="0"
          style={{ width: "100%" }}
        >
          <thead>
            <tr>
              <th>ID</th>
              <th>用户名</th>
              <th>密码</th>
              <th>权限</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <td>{user.id}</td>
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
                  <select
                    value={user.roles}
                    disabled={!user.isEditing}
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
                </td>
                <td>
                  {!user.isEditing && (
                    <button
                      type="button"
                      onClick={() => toggleEdit(user.id, true)}
                      disabled={savingId === user.id}
                    >
                      修改
                    </button>
                  )}
                  {user.isEditing && (
                    <button
                      type="button"
                      onClick={() => saveUser(user)}
                      disabled={savingId === user.id}
                    >
                      保存
                    </button>
                  )}
                  {user.isEditing && (
                    <button
                      type="button"
                      onClick={() => toggleEdit(user.id, false)}
                      disabled={savingId === user.id}
                    >
                      取消
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => deleteUser(user.id)}
                    disabled={savingId === user.id}
                  >
                    删除
                  </button>
                </td>
              </tr>
            ))}
            <tr>
              <td>新增</td>
              <td>
                <input
                  type="text"
                  value={newUser.username}
                  placeholder="用户名"
                  onChange={(event) =>
                    setNewUser((prev) => ({
                      ...prev,
                      username: event.target.value,
                    }))
                  }
                />
              </td>
              <td>
                <input
                  type="text"
                  value={newUser.password}
                  placeholder="密码"
                  onChange={(event) =>
                    setNewUser((prev) => ({
                      ...prev,
                      password: event.target.value,
                    }))
                  }
                />
              </td>
              <td>
                <select
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
              </td>
              <td>
                <button
                  type="button"
                  onClick={addUser}
                  disabled={savingId === "new"}
                >
                  添加用户
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      )}
    </div>
  );
}

export default UserManagerPage;
