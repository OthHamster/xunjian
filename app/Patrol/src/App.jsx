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

  useEffect(() => {
    const socket = io(apiBaseUrl);
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
      <Textbar socket={socketInstance} />
    </>
  );
}

export default App;
