import { Link, Route, Routes } from "react-router-dom";

function AdminPage({ userInfo, role, onLogout }) {
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
      <Routes>
        <Route index element={<div>请选择一个管理子页面</div>} />
        <Route path="usersManager" element={<div>这是用户管理</div>} />
        <Route path="risks" element={<div>这是风险处理</div>} />
      </Routes>
    </>
  );
}

export default AdminPage;
