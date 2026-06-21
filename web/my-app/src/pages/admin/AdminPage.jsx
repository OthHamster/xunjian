import { NavLink, Route, Routes, useLocation } from "react-router-dom";
import UserManagerPage from "./UserManagerPage";
import OnlineUsersPage from "./OnlineUsersPage";
import RouteManagerPage from "./RouteManagerPage";
import RealTimeMonitorPage from "./RealTimeMonitorPage";
import CheckpointManagerPage from "./CheckpointManagerPage";
import TaskAssignPage from "./TaskAssignPage";
import "./admin.css";

const NAV_GROUPS = [
  {
    label: "实时态势",
    items: [
      { to: "/admin/monitor", label: "实时监控", icon: "monitor" },
      { to: "/admin/online-users", label: "在线用户", icon: "users" },
    ],
  },
  {
    label: "风险与处置",
    items: [{ to: "/admin/risks", label: "风险处理", icon: "shield" }],
  },
  {
    label: "巡检配置",
    items: [
      { to: "/admin/routes-manager", label: "路线管理", icon: "route" },
      { to: "/admin/checkpoints", label: "打卡管理", icon: "pin" },
      { to: "/admin/tasks-assign", label: "任务派发", icon: "task" },
    ],
  },
  {
    label: "系统",
    items: [{ to: "/admin/usersManager", label: "用户管理", icon: "gear" }],
  },
];

const ICONS = {
  monitor: (
    <svg viewBox="0 0 24 24" fill="none" className="nav-icon">
      <rect x="3" y="4" width="18" height="13" rx="2" stroke="currentColor" strokeWidth="1.7" />
      <path d="M8 21h8M12 17v4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  ),
  users: (
    <svg viewBox="0 0 24 24" fill="none" className="nav-icon">
      <circle cx="9" cy="9" r="3.2" stroke="currentColor" strokeWidth="1.7" />
      <path d="M3.5 19c.6-3 3-5 5.5-5s4.9 2 5.5 5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <circle cx="17" cy="8.5" r="2.4" stroke="currentColor" strokeWidth="1.7" />
      <path d="M15 14.5c2.6.2 4.5 1.8 5 4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  ),
  shield: (
    <svg viewBox="0 0 24 24" fill="none" className="nav-icon">
      <path d="M12 3l8 3v6c0 4.5-3.4 8.5-8 9.5-4.6-1-8-5-8-9.5V6l8-3z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  route: (
    <svg viewBox="0 0 24 24" fill="none" className="nav-icon">
      <circle cx="6" cy="6" r="2.4" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="18" cy="18" r="2.4" stroke="currentColor" strokeWidth="1.7" />
      <path d="M8 7c5 0 5 4 8 4M16 17c-5 0-5-4-8-4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  ),
  pin: (
    <svg viewBox="0 0 24 24" fill="none" className="nav-icon">
      <path d="M12 22s7-6.5 7-12a7 7 0 10-14 0c0 5.5 7 12 7 12z" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="12" cy="10" r="2.6" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  ),
  task: (
    <svg viewBox="0 0 24 24" fill="none" className="nav-icon">
      <rect x="3" y="4" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.7" />
      <path d="M8 9h8M8 13h8M8 17h5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  ),
  gear: (
    <svg viewBox="0 0 24 24" fill="none" className="nav-icon">
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1-1.5 1.7 1.7 0 00-1.8.3l-.1.1A2 2 0 014 17l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1 1.7 1.7 0 00-.3-1.8l-.1-.1A2 2 0 117 4l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1A2 2 0 1120 7l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  ),
};

function BrandMark() {
  return (
    <div className="brand-mark">
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none">
        <path
          d="M12 2L3 6v6c0 5 3.8 9.4 9 10 5.2-.6 9-5 9-10V6l-9-4z"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
        <path
          d="M8.5 12.5l2.5 2.5 4.5-5"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

function Sidebar({ userInfo, onLogout }) {
  return (
    <aside className="app-sidebar">
      <div className="app-sidebar-brand">
        <BrandMark />
        <span>智能巡检管理</span>
      </div>

      {NAV_GROUPS.map((group) => (
        <div key={group.label}>
          <div className="app-sidebar-section">{group.label}</div>
          <nav className="app-nav">
            {group.items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  "app-nav-item" + (isActive ? " active" : "")
                }
                end={false}
              >
                {ICONS[item.icon]}
                <span>{item.label}</span>
              </NavLink>
            ))}
          </nav>
        </div>
      ))}

      <div className="app-sidebar-foot">
        <div className="app-sidebar-user">
          <div className="avatar">
            {(userInfo?.username || "?").slice(0, 1).toUpperCase()}
          </div>
          <div style={{ minWidth: 0 }}>
            <div className="name">{userInfo?.username || "未登录"}</div>
            <div className="role">管理员</div>
          </div>
        </div>
        <button
          type="button"
          className="btn-icon"
          title="退出登录"
          onClick={onLogout}
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none">
            <path
              d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>
    </aside>
  );
}

const PAGE_META = {
  "/admin": { title: "工作台", subtitle: "管理员控制台" },
  "/admin/monitor": { title: "实时监控", subtitle: "巡检员位置与路线" },
  "/admin/online-users": { title: "在线用户", subtitle: "在岗巡检员与状态" },
  "/admin/risks": { title: "风险处理", subtitle: "上报 · 处置 · 归档" },
  "/admin/routes-manager": { title: "路线管理", subtitle: "巡检路径与坐标" },
  "/admin/checkpoints": { title: "打卡管理", subtitle: "检查点配置" },
  "/admin/tasks-assign": { title: "任务派发", subtitle: "巡检任务分配" },
  "/admin/usersManager": { title: "用户管理", subtitle: "账号与角色" },
};

function Topbar() {
  const location = useLocation();
  const meta = PAGE_META[location.pathname] || {
    title: "管理后台",
    subtitle: "",
  };
  return (
    <header className="app-topbar">
      <div className="crumbs">
        <span>管理后台</span>
        <span style={{ color: "var(--color-text-soft)" }}>/</span>
        <strong>{meta.title}</strong>
        {meta.subtitle && (
          <span style={{ color: "var(--color-text-soft)" }}>· {meta.subtitle}</span>
        )}
      </div>
      <div className="right">
        <span className="badge badge-info">
          <span className="badge-dot" /> 实时
        </span>
      </div>
    </header>
  );
}

function RisksStub() {
  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title">风险处理</div>
        <span className="badge badge-warning">开发中</span>
      </div>
      <div className="card-body">
        <div className="empty">
          <div className="empty-icon">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none">
              <path d="M12 9v4M12 17v.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              <path d="M10.3 3.9L2.6 17a2 2 0 001.7 3h15.4a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
            </svg>
          </div>
          <div>风险处理模块即将上线</div>
          <div style={{ color: "var(--color-text-soft)", fontSize: 12 }}>
            即将支持：风险上报、审核、关联、关闭、归档
          </div>
        </div>
      </div>
    </div>
  );
}

function AdminPage({ userInfo, onLogout, apiBaseUrl }) {
  return (
    <div className="app-shell">
      <Sidebar userInfo={userInfo} onLogout={onLogout} />
      <div className="app-main">
        <Topbar />
        <div className="app-content">
          <Routes>
            <Route
              index
              element={
                <div className="card">
                  <div className="card-header">
                    <div className="card-title">欢迎回来，{userInfo?.username}</div>
                    <span className="badge badge-primary">管理员</span>
                  </div>
                  <div className="card-body" style={{ color: "var(--color-text-muted)" }}>
                    请使用左侧导航进入具体管理模块：实时监控、风险处理、路线 / 打卡点 / 任务管理、用户管理等。
                  </div>
                </div>
              }
            />
            <Route
              path="usersManager"
              element={<UserManagerPage apiBaseUrl={apiBaseUrl} />}
            />
            <Route path="risks" element={<RisksStub />} />
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
            <Route
              path="tasks-assign"
              element={<TaskAssignPage apiBaseUrl={apiBaseUrl} />}
            />
            <Route path="*" element={<RisksStub />} />
          </Routes>
        </div>
      </div>
    </div>
  );
}

export default AdminPage;
