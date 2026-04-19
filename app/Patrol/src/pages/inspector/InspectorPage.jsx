import { Link } from "react-router-dom";
import { useState } from "react";

function getUserRole(user) {
  if (!user) {
    return "";
  }

  if (Array.isArray(user.roles)) {
    return user.roles[0] || "";
  }

  return user.roles || "";
}

function InspectorTextbar({ socketRef }) {
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

function InspectorPage({ userInfo, onLogout, socketStatus, socketRef }) {
  return (
    <>
      <h2>巡检子页面</h2>
      <div>欢迎你，{userInfo.username}</div>
      <div>当前角色：{getUserRole(userInfo)}</div>
      <div>Socket: {socketStatus}</div>

      <div>
        <Link to="/">返回主页</Link>
      </div>
      <button type="button" onClick={onLogout}>
        退出登录
      </button>

      <InspectorTextbar socketRef={socketRef} />
    </>
  );
}

export default InspectorPage;
