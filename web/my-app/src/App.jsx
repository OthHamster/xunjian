import "./App.css";
import { useEffect, useMemo, useState } from "react";
import { io } from "socket.io-client";
import { Link, Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { CONFIG } from "./config";
import AdminPage from "./pages/admin/AdminPage";
import ViewerPage from "./pages/viewer/ViewerPage";

/* =================================================================
   业务逻辑（保持原样）：登录 / 鉴权 / Socket
   ================================================================= */

function Textbar({ socket }) {
  const [text, setText] = useState("");

  const handleChange = (event) => {
    setText(event.target.value);
    if (socket) {
      socket.emit("text_update", event.target.value);
    }
  };

  return (
    <div className="field" style={{ marginTop: 0 }}>
      <label className="field-label" htmlFor="socket-textbar">
        实时通信测试
      </label>
      <textarea
        id="socket-textbar"
        className="textarea"
        value={text}
        onChange={handleChange}
        placeholder="输入内容会通过 Socket.IO 实时广播…"
      />
      <div style={{ fontSize: 12, color: "var(--color-text-soft)" }}>
        当前文本：{text || "（空）"}
      </div>
    </div>
  );
}

function getUserRole(user) {
  if (!user) {
    return "";
  }
  return user.roles;
}

function LoginComponent({ onLogin, loading }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onLogin(username, password);
      }}
    >
      <div className="field">
        <label className="field-label" htmlFor="username">
          用户名
        </label>
        <input
          id="username"
          name="username"
          type="text"
          className="input"
          placeholder="请输入用户名"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          autoComplete="username"
        />
      </div>

      <div className="field">
        <label className="field-label" htmlFor="password">
          密码
        </label>
        <input
          id="password"
          name="password"
          type="password"
          className="input"
          placeholder="请输入密码"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="current-password"
        />
      </div>

      <button
        type="submit"
        className="btn btn-primary login-submit"
        disabled={loading}
      >
        {loading ? (
          <>
            <span className="spinner" style={{ borderTopColor: "#fff" }} />
            登录中…
          </>
        ) : (
          "登录"
        )}
      </button>
    </form>
  );
}

function RequireRole({ userInfo, allowedRoles, children }) {
  const role = getUserRole(userInfo);

  if (!userInfo || !allowedRoles.includes(role)) {
    return <Navigate to="/" replace />;
  }

  return children;
}

function BrandMark({ size = 32 }) {
  return (
    <div
      className="login-brand-mark"
      style={{ width: size, height: size, borderRadius: size * 0.25 }}
    >
      <svg viewBox="0 0 24 24" width={size * 0.55} height={size * 0.55} fill="none">
        <path
          d="M12 2L3 6v6c0 5 3.8 9.4 9 10 5.2-.6 9-5 9-10V6l-9-4z"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
        <path
          d="M8.5 12.5l2.5 2.5 4.5-5"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

function LoginHero() {
  return (
    <aside className="login-hero">
      <div className="login-brand">
        <BrandMark size={40} />
        <span>智能巡检管理系统</span>
      </div>

      <div className="login-headline">
        <h1>让每一次巡检<br />都可被追溯、被监管</h1>
        <p>
          打通一线巡检员、后台管理员与监管访客之间的信息壁垒，实时呈现人员位置、路线执行与风险事件，
          为区域安全防控提供数据化决策支持。
        </p>

        <div className="login-feature-list">
          <div className="login-feature">
            <div className="login-feature-icon">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none">
                <path
                  d="M12 22s7-5.5 7-12a7 7 0 10-14 0c0 6.5 7 12 7 12z"
                  stroke="currentColor"
                  strokeWidth="1.8"
                />
                <circle cx="12" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.8" />
              </svg>
            </div>
            <div>
              <div className="login-feature-title">实时位置追踪</div>
              <div className="login-feature-desc">巡检员动态 + 路线轨迹</div>
            </div>
          </div>
          <div className="login-feature">
            <div className="login-feature-icon">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none">
                <path
                  d="M12 3l9 4-9 4-9-4 9-4z"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinejoin="round"
                />
                <path
                  d="M3 12l9 4 9-4M3 17l9 4 9-4"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <div>
              <div className="login-feature-title">风险闭环管理</div>
              <div className="login-feature-desc">上报 · 处置 · 归档</div>
            </div>
          </div>
          <div className="login-feature">
            <div className="login-feature-icon">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none">
                <rect
                  x="3"
                  y="4"
                  width="18"
                  height="16"
                  rx="2"
                  stroke="currentColor"
                  strokeWidth="1.8"
                />
                <path
                  d="M3 9h18M8 14h8"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </svg>
            </div>
            <div>
              <div className="login-feature-title">打卡点管理</div>
              <div className="login-feature-desc">GIS 校验 · 路径约束</div>
            </div>
          </div>
          <div className="login-feature">
            <div className="login-feature-icon">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none">
                <path
                  d="M16 11a4 4 0 10-8 0 4 4 0 008 0z"
                  stroke="currentColor"
                  strokeWidth="1.8"
                />
                <path
                  d="M3 21c.6-3.4 3.7-6 8-6 1.4 0 2.7.3 3.9.8"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
                <path
                  d="M19 16v5M16.5 18.5h5"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </svg>
            </div>
            <div>
              <div className="login-feature-title">多角色协同</div>
              <div className="login-feature-desc">管理员 · 巡检员 · 访客</div>
            </div>
          </div>
        </div>
      </div>

      <div className="login-foot">
        © {new Date().getFullYear()} 智能巡检管理系统 · Powered by 高德地图 & Socket.IO
      </div>
    </aside>
  );
}

function LoginPage({
  loginStatus,
  loginMessage,
  onLogin,
  socketStatus,
  onEnterApp,
}) {
  return (
    <div className="login-page">
      <LoginHero />

      <main className="login-panel">
        <div className="login-card">
          <h2>欢迎登录</h2>
          <p className="sub">请使用您的账号进入巡检管理平台</p>

          <LoginComponent onLogin={onLogin} loading={loginStatus === "loading"} />

          {loginStatus === "failed" && loginMessage && (
            <div className="alert alert-error" style={{ marginTop: 16 }}>
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.8" />
                <path d="M12 7v6M12 16v.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
              <span>{loginMessage}</span>
            </div>
          )}
          {loginStatus === "success" && loginMessage && (
            <div className="alert alert-success" style={{ marginTop: 16 }}>
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none">
                <path
                  d="M5 12l4 4 10-10"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span>{loginMessage}</span>
            </div>
          )}

          <div className="login-meta">
            <span>
              <span
                className={
                  "status-dot " +
                  (socketStatus === "connected" ? "online" : "offline")
                }
              />
              Socket：{socketStatus}
            </span>
            {onEnterApp && (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={onEnterApp}
              >
                直接进入 →
              </button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

function HomePage({
  loginStatus,
  loginMessage,
  userInfo,
  onLogin,
  onLogout,
  socketStatus,
  socketInstance,
}) {
  const role = getUserRole(userInfo);

  // 未登录：展示登录页
  if (!userInfo) {
    return (
      <LoginPage
        loginStatus={loginStatus}
        loginMessage={loginMessage}
        onLogin={onLogin}
        socketStatus={socketStatus}
      />
    );
  }

  // 已登录：展示工作台入口
  return (
    <div className="home-page">
      <header className="home-header">
        <div className="brand">
          <BrandMark size={32} />
          <span>智能巡检管理系统 · 工作台</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
            <span
              className={
                "status-dot " +
                (socketStatus === "connected" ? "online" : "offline")
              }
            />
            {socketStatus === "connected" ? "已连接" : "未连接"}
          </span>
          <div className="user-chip">
            <div className="user-avatar">
              {(userInfo.username || "?").slice(0, 1).toUpperCase()}
            </div>
            <div>
              <div className="user-chip-name">{userInfo.username}</div>
              <div className="user-chip-role">角色：{role}</div>
            </div>
          </div>
          <button type="button" className="btn btn-sm" onClick={onLogout}>
            退出登录
          </button>
        </div>
      </header>

      <div className="home-body">
        <div className="home-welcome">
          <div className="home-welcome-text">
            <h2>你好，{userInfo.username}</h2>
            <p>
              欢迎进入巡检管理工作台。请选择下方工作区开始操作。
            </p>
          </div>
          <div className="home-welcome-actions">
            <span className="badge badge-primary">身份：{role}</span>
            <span className="badge">工号：{userInfo.EmployeeID || "-"}</span>
          </div>
        </div>

        <div className="home-cards">
          <Link to="/admin" className="home-role-card">
            <div className="home-role-icon admin">
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none">
                <path
                  d="M12 2l8 4v6c0 5-3.5 9-8 10-4.5-1-8-5-8-10V6l8-4z"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinejoin="round"
                />
                <path
                  d="M8.5 12.5l2.5 2.5 4.5-5"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <h3>管理员工作台</h3>
            <p>
              用户管理、风险处理、在线巡检员、实时监控、路线与打卡点管理、任务派发等后台能力。
            </p>
            <div className="home-role-foot">进入工作台 →</div>
          </Link>

          <Link to="/viewer" className="home-role-card">
            <div className="home-role-icon viewer">
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none">
                <path
                  d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"
                  stroke="currentColor"
                  strokeWidth="1.8"
                />
                <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
              </svg>
            </div>
            <h3>访客仪表盘</h3>
            <p>
              区域地图、巡检路线、在岗人员、历史风险点分布 — 实时透明的监管视图。
            </p>
            <div className="home-role-foot">查看仪表盘 →</div>
          </Link>
        </div>

        <div className="home-extra">
          <div className="card">
            <div className="card-header">
              <div className="card-title">实时通信测试</div>
              <span className="badge">Socket.IO</span>
            </div>
            <div className="card-body">
              在此输入内容会通过 Socket.IO 实时广播到其他在线终端。
              <Textbar socket={socketInstance} />
            </div>
          </div>
          <div className="card">
            <div className="card-header">
              <div className="card-title">系统状态</div>
              <span
                className={
                  "badge " +
                  (loginStatus === "success" ? "badge-success" : "badge-warning")
                }
              >
                {loginStatus === "success" ? "已登录" : loginStatus}
              </span>
            </div>
            <div className="card-body">
              <div style={{ display: "grid", gap: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>登录状态</span>
                  <strong>{loginStatus}</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>登录消息</span>
                  <span style={{ color: "var(--color-text-muted)" }}>
                    {loginMessage || "—"}
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>Socket</span>
                  <strong>{socketStatus}</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>当前用户</span>
                  <strong>
                    {userInfo.username}（{role}）
                  </strong>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function App() {
  const navigate = useNavigate();
  const apiBaseUrl = CONFIG.VITE_API_BASE_URL;
  const [socketStatus, setSocketStatus] = useState("disconnected");
  const [socketInstance, setSocketInstance] = useState(null);
  const [loginStatus, setLoginStatus] = useState("idle");
  const [loginMessage, setLoginMessage] = useState("未登录");
  const [userInfo, setUserInfo] = useState(null);

  const buildApiUrl = (path) => {
    return new URL(path, apiBaseUrl).toString();
  };
  const handleLogout = async () => {
    try {
      await fetch(buildApiUrl("logout"), {
        method: "POST",
        credentials: "include",
      });
    } catch (error) {
      console.error("logout error:", error);
    }

    setUserInfo(null);
    setLoginStatus("idle");
    setLoginMessage("已退出登录");
    navigate("/");
  };

  // 登录函数
  const handleLogin = async (username, password) => {
    if (!username.trim() || !password.trim()) {
      setLoginStatus("failed");
      setLoginMessage("用户名和密码不能为空");
      return;
    }

    setLoginStatus("loading");
    setLoginMessage("登录中…");

    try {
      const response = await fetch(buildApiUrl("login"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          username: username.trim(),
          password,
        }),
      });

      const data = await response.json();

      if (response.ok && data?.success) {
        const nextUser = data.user || null;
        const role = getUserRole(nextUser);

        setLoginStatus("success");
        setLoginMessage("登录成功");
        setUserInfo(nextUser);

        if (role === "admin") {
          navigate("/admin");
          return;
        }

        if (role === "viewer") {
          navigate("/viewer");
          return;
        }

        if (role === "inspector") {
          alert("权限不足，无法进入系统，将自动退出登录。");
          await handleLogout();
          return;
        }

        setLoginStatus("failed");
        setLoginMessage(`未知角色: ${role || "未设置"}`);
        await handleLogout();
      } else {
        setLoginStatus("failed");
        setLoginMessage(data?.error || "登录失败");
        setUserInfo(null);
      }
    } catch (error) {
      console.error("login error:", error);
      setLoginStatus("failed");
      setLoginMessage("网络异常，登录失败");
      setUserInfo(null);
    }
  };
  // 建立 socket 连接
  useEffect(() => {
    const socket = io(apiBaseUrl, {
      withCredentials: true,
      transports: ["websocket", "polling"],
    });
    setSocketInstance(socket);

    socket.on("connect", () => {
      setSocketStatus("connected");
    });

    socket.on("connect_error", (err) => {
      console.error("socket connect_error:", err.message);
      setSocketStatus("connect_error");
    });

    socket.on("disconnect", () => {
      setSocketStatus("disconnected");
    });

    return () => {
      socket.disconnect();
      setSocketInstance(null);
    };
  }, [apiBaseUrl]);

  return (
    <Routes>
      <Route
        path="/"
        element={
          <HomePage
            loginStatus={loginStatus}
            loginMessage={loginMessage}
            userInfo={userInfo}
            onLogin={handleLogin}
            onLogout={handleLogout}
            socketStatus={socketStatus}
            socketInstance={socketInstance}
          />
        }
      />
      <Route
        path="/admin/*"
        element={
          <RequireRole userInfo={userInfo} allowedRoles={["admin"]}>
            <AdminPage
              userInfo={userInfo}
              role={getUserRole(userInfo)}
              onLogout={handleLogout}
              apiBaseUrl={apiBaseUrl}
            />
          </RequireRole>
        }
      />
      <Route
        path="/viewer/*"
        element={
          <RequireRole userInfo={userInfo} allowedRoles={["viewer"]}>
            <ViewerPage
              userInfo={userInfo}
              role={getUserRole(userInfo)}
              onLogout={handleLogout}
              apiBaseUrl={apiBaseUrl}
            />
          </RequireRole>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
