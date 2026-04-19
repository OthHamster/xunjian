import "./App.css";
import { useEffect, useState } from "react";
import { io } from "socket.io-client";
import { Link, Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { CONFIG } from "./config";
import AdminPage from "./pages/admin/AdminPage";
import ViewerPage from "./pages/viewer/ViewerPage";
//测试socketio
function Textbar({ socket }) {
  const [text, setText] = useState("");

  const handleChange = (event) => {
    setText(event.target.value);
    if (socket) {
      socket.emit("text_update", event.target.value);
    }
  };

  return (
    <>
      <textarea
        value={text}
        onChange={handleChange}
        placeholder="请输入内容..."
        rows={4}
      />
      <div>当前文本: {text}</div>
    </>
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
      <div>
        <label htmlFor="username">用户名</label>
        <input
          id="username"
          name="username"
          type="text"
          placeholder="请输入用户名"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
        />
      </div>

      <div>
        <label htmlFor="password">密码</label>
        <input
          id="password"
          name="password"
          type="password"
          placeholder="请输入密码"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </div>

      <button type="submit" disabled={loading}>
        {loading ? "登录中..." : "登录"}
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

  return (
    <>
      <h2>主页</h2>
      <div>Socket: {socketStatus}</div>
      <LoginComponent onLogin={onLogin} loading={loginStatus === "loading"} />

      <div>登录状态: {loginStatus}</div>
      <div>登录信息: {loginMessage}</div>

      {userInfo && (
        <div>
          当前用户: {userInfo.username}（{role}）
        </div>
      )}

      {role === "admin" && <Link to="/admin">进入管理页面</Link>}
      {role === "viewer" && <Link to="/viewer">进入观察页面</Link>}
      {userInfo && (
        <div>
          <button type="button" onClick={onLogout}>
            退出登录
          </button>
        </div>
      )}

      <Textbar socket={socketInstance} />
    </>
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

  //登录函数
  const handleLogin = async (username, password) => {
    if (!username.trim() || !password.trim()) {
      setLoginStatus("failed");
      setLoginMessage("用户名和密码不能为空");
      return;
    }

    setLoginStatus("loading");
    setLoginMessage("登录中...");

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
  //建立socket连接
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
            />
          </RequireRole>
        }
      />
      <Route
        path="/viewer"
        element={
          <RequireRole userInfo={userInfo} allowedRoles={["viewer"]}>
            <ViewerPage
              userInfo={userInfo}
              role={getUserRole(userInfo)}
              onLogout={handleLogout}
            />
          </RequireRole>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
