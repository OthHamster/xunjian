import { Link, Route, Routes } from "react-router-dom";
import OnlineUsersPage from "../admin/OnlineUsersPage";

function ViewerPage({ userInfo, role, onLogout, apiBaseUrl }) {
  return (
    <>
      <h2>观察页面</h2>
      <div>欢迎你，{userInfo.username}</div>
      <div>当前角色：{role}</div>
      <div>
        <Link to="/">返回主页</Link>
      </div>
      <button type="button" onClick={onLogout}>
        退出登录
      </button>

      <div>
        <Link to="/viewer/online-users">在线用户</Link>
      </div>

      <Routes>
        <Route index element={<div>请选择一个观察子页面</div>} />
        <Route
          path="online-users"
          element={<OnlineUsersPage apiBaseUrl={apiBaseUrl} />}
        />
      </Routes>
    </>
  );
}

export default ViewerPage;
