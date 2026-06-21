import { useEffect, useState } from "react";
import { NavLink, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import OnlineUsersPage from "../admin/OnlineUsersPage";
import MapContainer from "../admin/MapContainer";
import "../admin/admin.css";

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

const ICONS = {
  dashboard: (
    <svg viewBox="0 0 24 24" fill="none" className="nav-icon">
      <rect x="3" y="3" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.7" />
      <rect x="13" y="3" width="8" height="5" rx="1.5" stroke="currentColor" strokeWidth="1.7" />
      <rect x="13" y="10" width="8" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.7" />
      <rect x="3" y="13" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  ),
  users: (
    <svg viewBox="0 0 24 24" fill="none" className="nav-icon">
      <circle cx="9" cy="9" r="3.2" stroke="currentColor" strokeWidth="1.7" />
      <path d="M3.5 19c.6-3 3-5 5.5-5s4.9 2 5.5 5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  ),
};

const NAV_ITEMS = [
  { to: "/viewer", label: "区域总览", icon: "dashboard" },
  { to: "/viewer/online-users", label: "在线用户", icon: "users" },
];

function ViewerSidebar({ userInfo, onLogout }) {
  return (
    <aside className="app-sidebar">
      <div className="app-sidebar-brand">
        <BrandMark />
        <span>访客仪表盘</span>
      </div>
      <div className="app-sidebar-section">监管视图</div>
      <nav className="app-nav">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/viewer"}
            className={({ isActive }) =>
              "app-nav-item" + (isActive ? " active" : "")
            }
          >
            {ICONS[item.icon]}
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
      <div className="app-sidebar-foot">
        <div className="app-sidebar-user">
          <div className="avatar">
            {(userInfo?.username || "?").slice(0, 1).toUpperCase()}
          </div>
          <div style={{ minWidth: 0 }}>
            <div className="name">{userInfo?.username || "未登录"}</div>
            <div className="role">访客</div>
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

function ViewerTopbar() {
  const location = useLocation();
  const title =
    location.pathname === "/viewer/online-users" ? "在线用户" : "区域总览";
  return (
    <header className="app-topbar">
      <div className="crumbs">
        <span>访客仪表盘</span>
        <span style={{ color: "var(--color-text-soft)" }}>/</span>
        <strong>{title}</strong>
      </div>
      <div className="right">
        <span className="badge badge-info">
          <span className="badge-dot" /> 只读视图
        </span>
      </div>
    </header>
  );
}

function OverviewPage({ apiBaseUrl }) {
  const [stats, setStats] = useState({
    online: 0,
    routes: 0,
    checkpoints: 0,
    risks: 0,
  });
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const build = (p) => new URL(p, apiBaseUrl).toString();
        const [users, routes, risks] = await Promise.all([
          fetch(build("online-users"), { credentials: "include" })
            .then((r) => r.json())
            .catch(() => null),
          fetch(build("routes"), { credentials: "include" })
            .then((r) => r.json())
            .catch(() => null),
          fetch(build("risks"), { credentials: "include" })
            .then((r) => r.json())
            .catch(() => null),
        ]);
        if (cancelled) return;
        const routeList = routes?.routes || [];
        let checkpointCount = 0;
        if (routeList.length > 0) {
          const details = await Promise.all(
            routeList.map((r) =>
              fetch(build(`routes/${r.routeId}/checkpoints`), {
                credentials: "include",
              })
                .then((res) => res.json())
                .catch(() => null),
            ),
          );
          checkpointCount = details
            .map((d) => (d?.checkpoints ? d.checkpoints.length : 0))
            .reduce((a, b) => a + b, 0);
        }
        if (cancelled) return;
        const openRisks = (risks?.risks || []).filter(
          (r) => r.status === "open" || r.Status === "open" || !r.status,
        ).length;
        setStats({
          online: users?.count || 0,
          routes: routeList.length,
          checkpoints: checkpointCount,
          risks: openRisks,
        });
        setLastUpdate(Date.now());
      } catch (e) {
        // 静默失败，仪表盘可继续显示 0
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    const t = setInterval(load, 15000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [apiBaseUrl]);

  return (
    <>
      <div className="grid grid-4">
        <div className="stat-card primary">
          <div className="stat-label">在岗巡检员</div>
          <div className="stat-value">{loading ? "—" : stats.online}</div>
          <div className="stat-foot">实时在线人数</div>
        </div>
        <div className="stat-card success">
          <div className="stat-label">巡检路线</div>
          <div className="stat-value">{loading ? "—" : stats.routes}</div>
          <div className="stat-foot">已配置路线数</div>
        </div>
        <div className="stat-card warning">
          <div className="stat-label">打卡点</div>
          <div className="stat-value">{loading ? "—" : stats.checkpoints}</div>
          <div className="stat-foot">累计检查点</div>
        </div>
        <div className="stat-card danger">
          <div className="stat-label">未解决风险</div>
          <div className="stat-value">{loading ? "—" : stats.risks}</div>
          <div className="stat-foot">待处置事件</div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">区域地图</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {lastUpdate && (
              <span style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
                更新于 {new Date(lastUpdate).toLocaleTimeString()}
              </span>
            )}
            <span className="badge badge-success">
              <span className="badge-dot" /> 实时
            </span>
          </div>
        </div>
        <div className="card-body" style={{ padding: 0 }}>
          <MapContainer mode="preview" users={[]} paths={[]} points={[]} />
        </div>
      </div>

      <div className="grid grid-3">
        <div className="card">
          <div className="card-header">
            <div className="card-title">关于本系统</div>
          </div>
          <div className="card-body" style={{ color: "var(--color-text-muted)", lineHeight: 1.7 }}>
            本仪表盘面向监管层（访客）提供只读视图，展示区域地图、巡检路线、在岗人员与历史风险点分布，
            实现安全防控工作的透明化监督。
          </div>
        </div>
        <div className="card">
          <div className="card-header">
            <div className="card-title">地图要素</div>
          </div>
          <div className="card-body" style={{ display: "grid", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ width: 10, height: 10, background: "#1677ff", borderRadius: 2 }} />
              <span>巡检路线</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ width: 10, height: 10, background: "#16a34a", borderRadius: "50%" }} />
              <span>打卡点</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ width: 10, height: 10, background: "#dc2626", borderRadius: "50%" }} />
              <span>风险点</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ width: 10, height: 10, background: "#0ea5e9", borderRadius: "50%" }} />
              <span>在岗人员</span>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="card-header">
            <div className="card-title">数据更新</div>
          </div>
          <div className="card-body" style={{ color: "var(--color-text-muted)" }}>
            <div>数据每 15 秒自动刷新</div>
            <div style={{ marginTop: 4 }}>
              {lastUpdate ? `最近：${new Date(lastUpdate).toLocaleString()}` : "等待数据…"}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function ViewerPage({ userInfo, role, onLogout, apiBaseUrl }) {
  return (
    <div className="app-shell">
      <ViewerSidebar userInfo={userInfo} onLogout={onLogout} />
      <div className="app-main">
        <ViewerTopbar />
        <div className="app-content">
          <Routes>
            <Route index element={<OverviewPage apiBaseUrl={apiBaseUrl} />} />
            <Route
              path="online-users"
              element={<OnlineUsersPage apiBaseUrl={apiBaseUrl} />}
            />
            <Route
              path="*"
              element={<OverviewPage apiBaseUrl={apiBaseUrl} />}
            />
          </Routes>
        </div>
      </div>
    </div>
  );
}

export default ViewerPage;
