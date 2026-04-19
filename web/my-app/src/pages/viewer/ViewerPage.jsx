import { Link } from "react-router-dom";

function ViewerPage({ userInfo, role, onLogout }) {
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
    </>
  );
}

export default ViewerPage;
