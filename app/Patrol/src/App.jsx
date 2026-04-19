import "./App.css";
import { useEffect, useState } from "react";
import { io } from "socket.io-client";
import { CONFIG } from "./config";

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

function App() {
  const apiBaseUrl = CONFIG.VITE_API_BASE_URL;
  const [socketStatus, setSocketStatus] = useState("disconnected");
  const [socketInstance, setSocketInstance] = useState(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loginStatus, setLoginStatus] = useState("idle");
  const [loginMessage, setLoginMessage] = useState("未登录");
  const [userInfo, setUserInfo] = useState(null);

  const buildApiUrl = (path) => {
    return new URL(path, apiBaseUrl).toString();
  };

  const handleLogin = async (event) => {
    event.preventDefault();

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
        setLoginStatus("success");
        setLoginMessage("登录成功");
        setUserInfo(data.user || null);
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
    <>
      <div>bababoi</div>
      <div>API: {apiBaseUrl}</div>
      <div>Socket: {socketStatus}</div>

      <form onSubmit={handleLogin}>
        <div>
          <label htmlFor="username">用户名</label>
          <input
            id="username"
            type="text"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            placeholder="请输入用户名"
          />
        </div>

        <div>
          <label htmlFor="password">密码</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="请输入密码"
          />
        </div>

        <button type="submit" disabled={loginStatus === "loading"}>
          {loginStatus === "loading" ? "登录中..." : "登录"}
        </button>
      </form>

      <div>登录状态: {loginStatus}</div>
      <div>登录信息: {loginMessage}</div>
      {userInfo && (
        <div>
          当前用户: {userInfo.username}（{userInfo.roles}）
        </div>
      )}

      <Textbar socket={socketInstance} />
    </>
  );
}

export default App;
