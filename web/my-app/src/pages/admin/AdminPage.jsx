import { Link, Route, Routes } from "react-router-dom";
import UserManagerPage from "./UserManagerPage";
import OnlineUsersPage from "./OnlineUsersPage";
import RouteManagerPage from "./RouteManagerPage";
import RealTimeMonitorPage from "./RealTimeMonitorPage";
import CheckpointManagerPage from "./CheckpointManagerPage";

function AdminPage({ userInfo, role, onLogout, apiBaseUrl }) {
  return (
    <>
      <h2>管理页面</h2>
      <div>欢迎你，{userInfo.username}</div>
      <div>当前角色：{role}</div>
      <div>
        <Link to="/">返回主页</Link>
      </div>
      <button type="button" onClick={onLogout}>
        退出登录
      </button>
      <div>
        <Link to="/admin/usersManager">用户管理</Link>
      </div>
      <div>
        <Link to="/admin/risks">风险处理</Link>
      </div>
      <div>
        <Link to="/admin/online-users">在线用户</Link>
      </div>
      <div>
        <Link to="/admin/monitor">实时监控</Link>
      </div>
      <div>
        <Link to="/admin/routes-manager">路线管理</Link>
      </div>
      <div>
        <Link to="/admin/checkpoints">打卡管理</Link>
      </div>
      <Routes>
        <Route index element={<div>请选择一个管理子页面</div>} />
        <Route
          path="usersManager"
          element={<UserManagerPage apiBaseUrl={apiBaseUrl} />}
        />
        <Route path="risks" element={<div>这是风险处理</div>} />
        <Route
          path="online-users"
          element={<OnlineUsersPage apiBaseUrl={apiBaseUrl} />}
        />
        <Route
          path="monitor"
          element={<RealTimeMonitorPage apiBaseUrl={apiBaseUrl} />}
        />
        <Route
          path="routes-manager"
          element={<RouteManagerPage apiBaseUrl={apiBaseUrl} />}
        />
        <Route
          path="checkpoints"
          element={<CheckpointManagerPage apiBaseUrl={apiBaseUrl} />}
        />
      </Routes>
    </>
  );
}

export default AdminPage;
