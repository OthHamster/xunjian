import "./App.css";
import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { Link, Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { CONFIG } from "./config";
import InspectorPage from "./pages/inspector/InspectorPage";
//测试socketio
function Textbar({ socketRef }) {
  const [text, setText] = useState("");

  const handleChange = (event) => {
    setText(event.target.value);
    const socket = socketRef.current;
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

  if (Array.isArray(user.roles)) {
    return user.roles[0] || "";
  }

  return user.roles || "";
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
  socketRef,
}) {
  const role = getUserRole(userInfo);

  return (
    <>
      <h2>巡检 App 主页</h2>
      <div>API: {CONFIG.VITE_API_BASE_URL}</div>
      <div>Socket: {socketStatus}</div>

      <LoginComponent onLogin={onLogin} loading={loginStatus === "loading"} />

      <div>登录状态: {loginStatus}</div>
      <div>登录信息: {loginMessage}</div>

      {userInfo && (
        <div>
          当前用户: {userInfo.username}（{role}）
        </div>
      )}

      {role === "inspector" && <Link to="/inspector">进入巡检子页面</Link>}

      {userInfo && (
        <div>
          <button type="button" onClick={onLogout}>
            退出登录
          </button>
        </div>
      )}

      <Textbar socketRef={socketRef} />
    </>
  );
}

function App() {
  const navigate = useNavigate();
  const apiBaseUrl = CONFIG.VITE_API_BASE_URL;
  const [socketStatus, setSocketStatus] = useState("disconnected");
  const socketRef = useRef(null);
  const locationWatchIdRef = useRef(null);
  const lastLocationRef = useRef(null);
  const [loginStatus, setLoginStatus] = useState("idle");
  const [loginMessage, setLoginMessage] = useState("未登录");
  const [userInfo, setUserInfo] = useState(null);
  const [sessionId, setSessionId] = useState("");
  const [nextCheckpointId, setNextCheckpointId] = useState(null);
  const [activeTaskRefreshToken, setActiveTaskRefreshToken] = useState(0);
  const [taskCompleteNoticeToken, setTaskCompleteNoticeToken] = useState(0);
  const [moveOffset, setMoveOffset] = useState({ east: 0, north: 0 });
  const moveOffsetRef = useRef(moveOffset);

  useEffect(() => {
    moveOffsetRef.current = moveOffset;
  }, [moveOffset]);

  const buildApiUrl = (path) => {
    return new URL(path, apiBaseUrl).toString();
  };

  const clearLocationWatch = () => {
    if (navigator.geolocation && locationWatchIdRef.current !== null) {
      navigator.geolocation.clearWatch(locationWatchIdRef.current);
    }
    locationWatchIdRef.current = null;
  };

  const moveByMeters = (deltaEast, deltaNorth) => {
    setMoveOffset((prev) => ({
      east: prev.east + deltaEast,
      north: prev.north + deltaNorth,
    }));
  };

  const resetMoveOffset = () => {
    setMoveOffset({ east: 0, north: 0 });
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
    setSessionId("");
    lastLocationRef.current = null;
    clearLocationWatch();
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
        setSessionId(data.sessionId || "");

        if (!data.sessionId) {
          setLoginMessage("登录成功，但未拿到 sessionId，心跳绑定可能失败");
        }

        if (role === "inspector") {
          navigate("/inspector");
          return;
        }

        // 只有巡检员账号有子页面，其他权限返回主页
        navigate("/");
        setLoginMessage("登录成功：当前角色无 App 子页面，已返回主页");
      } else {
        setLoginStatus("failed");
        setLoginMessage(data?.error || "登录失败");
        setUserInfo(null);
        setSessionId("");
      }
    } catch (error) {
      console.error("login error:", error);
      setLoginStatus("failed");
      setLoginMessage("网络异常，登录失败");
      setUserInfo(null);
      setSessionId("");
    }
  };
  //建立socket连接
  useEffect(() => {
    const socket = io(apiBaseUrl, {
      withCredentials: true,
      transports: ["websocket", "polling"],
    });
    socketRef.current = socket;

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

    socket.on("heartbeat_ack", (payload = {}) => {
      const nextId = Number.parseInt(payload?.nextCheckpointId, 10);
      setNextCheckpointId(Number.isInteger(nextId) ? nextId : null);

      if (payload?.completed) {
        setNextCheckpointId(null);
        setActiveTaskRefreshToken((prev) => prev + 1);
        setTaskCompleteNoticeToken((prev) => prev + 1);
      }
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [apiBaseUrl]);

  useEffect(() => {
    if (!userInfo || !socketRef.current) {
      clearLocationWatch();
      return undefined;
    }

    const sendHeartbeat = (location = lastLocationRef.current) => {
      if (!sessionId) {
        return;
      }

      const socket = socketRef.current;
      if (!socket || !socket.connected) {
        return;
      }

      if (!location) {
        socket.emit("heartbeat", { sessionId, location });
        return;
      }

      const { east, north } = moveOffsetRef.current;
      const lat = Number(location.latitude);
      const lng = Number(location.longitude);
      const radLat = (lat * Math.PI) / 180;
      const metersPerDeg = 111320;
      const deltaLat = north / metersPerDeg;
      const deltaLng = east / (metersPerDeg * Math.cos(radLat || 0.000001));

      socket.emit("heartbeat", {
        sessionId,
        location: {
          ...location,
          latitude: lat + deltaLat,
          longitude: lng + deltaLng,
        },
      });
    };

    if (navigator.geolocation && locationWatchIdRef.current === null) {
      locationWatchIdRef.current = navigator.geolocation.watchPosition(
        (position) => {
          const location = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
          };

          lastLocationRef.current = location;
          // 实时位置变化时立即上报
          sendHeartbeat(location);
        },
        (error) => {
          console.error("watchPosition error:", error);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 5000,
        },
      );
    }

    // 登录后先上报一次，再定时兜底上报
    sendHeartbeat();
    const timer = setInterval(() => {
      sendHeartbeat();
    }, 10000);

    return () => {
      clearInterval(timer);
      clearLocationWatch();
    };
  }, [userInfo, sessionId, socketStatus]);

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
            socketRef={socketRef}
          />
        }
      />
      <Route
        path="/inspector"
        element={
          <RequireRole userInfo={userInfo} allowedRoles={["inspector"]}>
            <InspectorPage
              userInfo={userInfo}
              apiBaseUrl={apiBaseUrl}
              onLogout={handleLogout}
              socketStatus={socketStatus}
              socketRef={socketRef}
              moveOffset={moveOffset}
              onMoveBy={moveByMeters}
              onResetOffset={resetMoveOffset}
              nextCheckpointId={nextCheckpointId}
              activeTaskRefreshToken={activeTaskRefreshToken}
              taskCompleteNoticeToken={taskCompleteNoticeToken}
            />
          </RequireRole>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
