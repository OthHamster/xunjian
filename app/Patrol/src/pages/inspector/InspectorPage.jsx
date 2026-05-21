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

function InspectorPage({
  userInfo,
  onLogout,
  socketStatus,
  socketRef,
  moveOffset,
  onMoveBy,
  onResetOffset,
}) {
  const [stepMeters, setStepMeters] = useState(1);

  const handleStepChange = (event) => {
    const next = Number(event.target.value);
    setStepMeters(Number.isFinite(next) && next > 0 ? next : 1);
  };

  const handleMove = (deltaEast, deltaNorth) => {
    if (typeof onMoveBy === "function") {
      onMoveBy(deltaEast, deltaNorth);
    }
  };

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

      <div style={{ marginTop: 16 }}>
        <div style={{ marginBottom: 8 }}>虚拟摇杆</div>
        <label>
          步长(米)
          <input
            type="number"
            min="0.1"
            step="0.1"
            value={stepMeters}
            onChange={handleStepChange}
            style={{ marginLeft: 8, width: 90 }}
          />
        </label>
        <div style={{ marginTop: 12, display: "inline-block" }}>
          <div style={{ textAlign: "center" }}>
            <button type="button" onClick={() => handleMove(0, stepMeters)}>
              ↑
            </button>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button type="button" onClick={() => handleMove(-stepMeters, 0)}>
              ←
            </button>
            <button type="button" onClick={() => handleMove(0, 0)} disabled>
              ●
            </button>
            <button type="button" onClick={() => handleMove(stepMeters, 0)}>
              →
            </button>
          </div>
          <div style={{ textAlign: "center", marginTop: 8 }}>
            <button type="button" onClick={() => handleMove(0, -stepMeters)}>
              ↓
            </button>
          </div>
        </div>
        <div style={{ marginTop: 12 }}>
          累计偏移：东 {moveOffset?.east ?? 0}m，北 {moveOffset?.north ?? 0}m
        </div>
        <button type="button" onClick={onResetOffset} style={{ marginTop: 8 }}>
          重置偏移
        </button>
      </div>

      <InspectorTextbar socketRef={socketRef} />
    </>
  );
}

export default InspectorPage;
