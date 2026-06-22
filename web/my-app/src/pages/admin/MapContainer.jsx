import { useEffect, useRef, useState, useCallback } from "react";
import "./MapContainer.css";
import AMapLoader from "@amap/amap-jsapi-loader";

const EARTH_RADIUS = 6378245.0;
const EE = 0.00669342162296594323;

const outOfChina = (lat, lng) =>
  lng < 72.004 || lng > 137.8347 || lat < 0.8293 || lat > 55.8271;

const transformLat = (x, y) => {
  let ret =
    -100.0 +
    2.0 * x +
    3.0 * y +
    0.2 * y * y +
    0.1 * x * y +
    0.2 * Math.sqrt(Math.abs(x));
  ret +=
    ((20.0 * Math.sin(6.0 * x * Math.PI) + 20.0 * Math.sin(2.0 * x * Math.PI)) *
      2.0) /
    3.0;
  ret +=
    ((20.0 * Math.sin(y * Math.PI) + 40.0 * Math.sin((y / 3.0) * Math.PI)) *
      2.0) /
    3.0;
  ret +=
    ((160.0 * Math.sin((y / 12.0) * Math.PI) +
      320 * Math.sin((y * Math.PI) / 30.0)) *
      2.0) /
    3.0;
  return ret;
};

const transformLng = (x, y) => {
  let ret =
    300.0 +
    x +
    2.0 * y +
    0.1 * x * x +
    0.1 * x * y +
    0.1 * Math.sqrt(Math.abs(x));
  ret +=
    ((20.0 * Math.sin(6.0 * x * Math.PI) + 20.0 * Math.sin(2.0 * x * Math.PI)) *
      2.0) /
    3.0;
  ret +=
    ((20.0 * Math.sin(x * Math.PI) + 40.0 * Math.sin((x / 3.0) * Math.PI)) *
      2.0) /
    3.0;
  ret +=
    ((150.0 * Math.sin((x / 12.0) * Math.PI) +
      300.0 * Math.sin((x / 30.0) * Math.PI)) *
      2.0) /
    3.0;
  return ret;
};

export const wgs84ToGcj02Point = (point) => {
  if (!Array.isArray(point) || point.length < 2) {
    return point;
  }

  const lng = Number(point[0]);
  const lat = Number(point[1]);

  if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
    return point;
  }

  if (outOfChina(lat, lng)) {
    return [lng, lat];
  }

  let dLat = transformLat(lng - 105.0, lat - 35.0);
  let dLng = transformLng(lng - 105.0, lat - 35.0);
  const radLat = (lat / 180.0) * Math.PI;
  let magic = Math.sin(radLat);
  magic = 1 - EE * magic * magic;
  const sqrtMagic = Math.sqrt(magic);
  dLat =
    (dLat * 180.0) /
    (((EARTH_RADIUS * (1 - EE)) / (magic * sqrtMagic)) * Math.PI);
  dLng =
    (dLng * 180.0) / ((EARTH_RADIUS / sqrtMagic) * Math.cos(radLat) * Math.PI);
  return [lng + dLng, lat + dLat];
};

export const gcj02ToWgs84Point = (point) => {
  if (!Array.isArray(point) || point.length < 2) {
    return point;
  }

  const lng = Number(point[0]);
  const lat = Number(point[1]);

  if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
    return point;
  }

  if (outOfChina(lat, lng)) {
    return [lng, lat];
  }

  const [gLng, gLat] = wgs84ToGcj02Point([lng, lat]);
  return [lng * 2 - gLng, lat * 2 - gLat];
};

export const wgs84ToGcj02Path = (path) =>
  Array.isArray(path) ? path.map(wgs84ToGcj02Point) : [];

export const gcj02ToWgs84Path = (path) =>
  Array.isArray(path) ? path.map(gcj02ToWgs84Point) : [];
/**
 * 简单的地图容器组件
 *
 * @param {{mode?: string}} props
 * @param {string} [props.mode='preview'] - 地图模式，'preview' 只展示，'edit' 为路线编辑，'checkpoint-edit' 为打卡点编辑
 * @param {Array<[number, number]>} [props.currentPath] - 当前路径坐标
 * @param {Array<[number, number]>} [props.path] - 打卡点关联路径坐标
 * @param {Array<Array<[number, number]>>} [props.paths] - 多条路线坐标
 * @param {Array<{ name?: string, longitude: number, latitude: number }>} [props.points] - 打卡点列表
 * @param {Array<Object>} [props.users] - 在线用户列表
 * @param {(point: [number, number]) => Promise<{ ok: boolean, error?: string }>} [props.onValidatePoint] - 打卡点校验回调
 */
export default function MapContainer({
  mode = "preview",
  currentPath = [],
  path = [],
  paths = [],
  points = [],
  users = [],
  pathManager = null,
  pointManager = null,
  onPick = null,
  onPathsChange = null,
  onPointsChange = null,
  onValidatePoint = null,
}) {
  const mapRef = useRef(null);
  const onPickRef = useRef(onPick);
  const onPathsChangeRef = useRef(onPathsChange);
  const onPointsChangeRef = useRef(onPointsChange);
  const onValidatePointRef = useRef(onValidatePoint);
  const pathManagerRef = useRef(pathManager);
  const pointManagerRef = useRef(pointManager);
  const modeRef = useRef(mode);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const toggleFullscreen = useCallback(() => {
    setIsFullscreen((v) => !v);
  }, []);

  // ESC 退出全屏
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") setIsFullscreen(false);
    };
    if (isFullscreen) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isFullscreen]);

  // 全屏切换时触发地图 resize
  useEffect(() => {
    const timer = setTimeout(() => {
      const ref = mapRef.current;
      if (ref?.map && typeof ref.map.resize === "function") {
        try { ref.map.resize(); } catch (_) { /* ignore */ }
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [isFullscreen]);

  useEffect(() => {
    onPickRef.current = onPick;
  }, [onPick]);

  useEffect(() => {
    onPathsChangeRef.current = onPathsChange;
  }, [onPathsChange]);

  useEffect(() => {
    onPointsChangeRef.current = onPointsChange;
  }, [onPointsChange]);

  useEffect(() => {
    onValidatePointRef.current = onValidatePoint;
  }, [onValidatePoint]);

  useEffect(() => {
    pathManagerRef.current = pathManager;
  }, [pathManager]);

  useEffect(() => {
    pointManagerRef.current = pointManager;
  }, [pointManager]);

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  const updateRoutesOverlays = (list) => {
    const ref = mapRef.current;
    if (!ref?.map || !ref?.AMap) {
      return;
    }

    const { map, AMap, routeOverlays } = ref;
    const nextPaths = Array.isArray(list) ? list : [];

    if (routeOverlays?.length) {
      map.remove(routeOverlays);
    }

    const palette = ["#1976d2", "#00897b", "#8e24aa", "#f9a825", "#6d4c41"];
    const overlays = [];

    nextPaths.forEach((path, index) => {
      const gcjPath = wgs84ToGcj02Path(Array.isArray(path) ? path : []);
      if (gcjPath.length < 2) {
        return;
      }

      const closedPath = [...gcjPath, gcjPath[0]];
      overlays.push(
        new AMap.Polyline({
          path: closedPath,
          strokeColor: palette[index % palette.length],
          strokeOpacity: 0.75,
          strokeWeight: 3,
        }),
      );
    });

    if (overlays.length) {
      map.add(overlays);
    }

    ref.routeOverlays = overlays;
  };

  const updatePathOverlays = (path) => {
    const ref = mapRef.current;
    if (!ref?.map || !ref?.AMap) {
      return;
    }

    const { map, AMap, overlays } = ref;
    const nextPath = wgs84ToGcj02Path(Array.isArray(path) ? path : []);

    if (overlays?.markers?.length) {
      map.remove(overlays.markers);
    }
    if (overlays?.polyline) {
      map.remove(overlays.polyline);
    }
    if (overlays?.polygon) {
      map.remove(overlays.polygon);
    }

    if (nextPath.length === 0) {
      ref.overlays = { markers: [], polyline: null, polygon: null };
      return;
    }

    const markerColor = mode === "edit" ? "#f2552c" : "#1f78d1";
    const lineColor = mode === "edit" ? "#f2552c" : "#1f78d1";
    const fillColor = mode === "edit" ? "#f2552c" : "#1f78d1";

    const markers = nextPath.map(
      (point, index) =>
        new AMap.Marker({
          position: point,
          anchor: "center",
          offset: new AMap.Pixel(0, 0),
          content: `<div style=\"display:flex;align-items:center;justify-content:center;width:20px;height:20px;border-radius:50%;background:${markerColor};color:#fff;font-size:11px;font-weight:600;border:2px solid #fff;box-shadow:0 0 4px rgba(0,0,0,0.3);\">${
            index + 1
          }</div>`,
          title: `点位 ${index + 1}`,
        }),
    );

    const closedPath =
      nextPath.length >= 2 ? [...nextPath, nextPath[0]] : nextPath;

    const polyline =
      closedPath.length >= 2
        ? new AMap.Polyline({
            path: closedPath,
            strokeColor: lineColor,
            strokeOpacity: 0.9,
            strokeWeight: 4,
          })
        : null;

    map.add(markers);
    if (polyline) {
      map.add(polyline);
    }

    ref.overlays = { markers, polyline, polygon: null };
  };

  const updateUserMarkers = (list) => {
    const ref = mapRef.current;
    if (!ref?.map || !ref?.AMap) {
      return;
    }

    const { map, AMap, userMarkers } = ref;
    const nextUsers = Array.isArray(list) ? list : [];

    if (userMarkers?.length) {
      map.remove(userMarkers);
    }

    const markers = nextUsers
      .filter((user) => user?.location)
      .map((user) => {
        const lng = Number(user.location?.longitude);
        const lat = Number(user.location?.latitude);
        if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
          return null;
        }
        const [gcjLng, gcjLat] = wgs84ToGcj02Point([lng, lat]);
        const label = user.username || user.id || "在线";
        return new AMap.Marker({
          position: [gcjLng, gcjLat],
          anchor: "bottom-center",
          offset: new AMap.Pixel(0, -7),
          content:
            `<div style=\"display:flex;flex-direction:column;align-items:center;gap:4px;\">` +
            `<div style=\"background:#2f7d32;color:#fff;padding:2px 6px;border-radius:10px;font-size:11px;box-shadow:0 2px 6px rgba(0,0,0,0.25);\">${label}</div>` +
            `<div style=\"width:10px;height:10px;border-radius:50%;background:#2f7d32;border:2px solid #fff;box-shadow:0 0 4px rgba(0,0,0,0.3);\"></div>` +
            `</div>`,
        });
      })
      .filter(Boolean);

    if (markers.length) {
      map.add(markers);
    }

    ref.userMarkers = markers;
  };

  const updatePointMarkers = (list) => {
    const ref = mapRef.current;
    if (!ref?.map || !ref?.AMap) {
      return;
    }

    const { map, AMap, pointMarkers } = ref;
    const nextPoints = Array.isArray(list) ? list : [];

    if (pointMarkers?.length) {
      map.remove(pointMarkers);
    }

    const markers = nextPoints
      .map((point, index) => {
        const lng = Number(point?.longitude ?? point?.lng ?? point?.lon);
        const lat = Number(point?.latitude ?? point?.lat);
        if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
          return null;
        }
        const [gcjLng, gcjLat] = wgs84ToGcj02Point([lng, lat]);
        const label = point?.name || `打卡点 ${index + 1}`;
        return new AMap.Marker({
          position: [gcjLng, gcjLat],
          anchor: "bottom-center",
          offset: new AMap.Pixel(0, -7),
          content:
            `<div style=\"display:flex;flex-direction:column;align-items:center;gap:4px;\">` +
            `<div style=\"background:#d84315;color:#fff;padding:2px 6px;border-radius:10px;font-size:11px;box-shadow:0 2px 6px rgba(0,0,0,0.25);\">${label}</div>` +
            `<div style=\"width:10px;height:10px;border-radius:50%;background:#d84315;border:2px solid #fff;box-shadow:0 0 4px rgba(0,0,0,0.3);\"></div>` +
            `</div>`,
        });
      })
      .filter(Boolean);

    if (markers.length) {
      map.add(markers);
    }

    ref.pointMarkers = markers;
  };

  useEffect(() => {
    window._AMapSecurityConfig = {
      securityJsCode: "530f19d33f82ac7fedfccc16d919ef3c",
    };
    AMapLoader.load({
      key: "e49badb64217a9824fc5d3201ee6e3b8", // 申请好的Web端开发者Key，首次调用 load 时必填
      version: "2.0", // 指定要加载的 JSAPI 的版本，缺省时默认为 1.4.15
      plugins: ["AMap.Scale"], //需要使用的的插件列表，如比例尺'AMap.Scale'，支持添加多个如：['...','...']
    })
      .then((AMap) => {
        const map = new AMap.Map("container", {
          // 设置地图容器id
          viewMode: "2D", // 是否为3D地图模式
          zoom: 17, // 初始化地图级别
          center: [117.180184, 31.769487], // 初始化地图中心点位置
        });
        if (mode === "preview") {
          // 预览模式：仅显示示例标记
        }

        // 编辑模式：绑定点击事件以拾取坐标并写入 pathManager（如果提供）
        if (mode === "edit" || mode === "checkpoint-edit") {
          console.error("edit模式");
          const clickHandler = async (e) => {
            try {
              const lnglat = e?.lnglat;
              const lng = lnglat?.lng ?? (lnglat?.getLng && lnglat.getLng());
              const lat = lnglat?.lat ?? (lnglat?.getLat && lnglat.getLat());
              console.warn("坐标", lng, lat);
              if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
                console.warn("无法解析点击坐标", e);
                return;
              }

              const [wgsLng, wgsLat] = gcj02ToWgs84Point([lng, lat]);

              if (modeRef.current === "edit") {
                // 写入 pathManager（如果外部提供）
                if (
                  pathManagerRef.current &&
                  typeof pathManagerRef.current
                    .insertCoordinateAfterEditIndex === "function"
                ) {
                  try {
                    pathManagerRef.current.insertCoordinateAfterEditIndex([
                      wgsLng,
                      wgsLat,
                    ]);
                    console.warn("坐标已插入 pathManager", wgsLng, wgsLat);
                  } catch (err) {
                    console.error("写入路径失败:", err);
                  }

                  if (typeof onPathsChangeRef.current === "function") {
                    try {
                      onPathsChangeRef.current(
                        pathManagerRef.current.getCurrentPath(),
                      );
                    } catch (err) {
                      console.error("onPathsChange 回调失败:", err);
                    }
                  }
                }
              }

              if (modeRef.current === "checkpoint-edit") {
                if (
                  pointManagerRef.current &&
                  typeof pointManagerRef.current.insertPointAfterEditIndex ===
                    "function"
                ) {
                  if (typeof onValidatePointRef.current === "function") {
                    try {
                      const result = await onValidatePointRef.current([
                        wgsLng,
                        wgsLat,
                      ]);
                      if (!result?.ok) {
                        console.warn("打卡点校验失败:", result?.error);
                        return;
                      }
                    } catch (validateError) {
                      console.warn("打卡点校验异常:", validateError);
                      return;
                    }
                  }

                  try {
                    pointManagerRef.current.insertPointAfterEditIndex({
                      longitude: wgsLng,
                      latitude: wgsLat,
                    });
                    console.warn("坐标已插入 pointManager", wgsLng, wgsLat);
                  } catch (err) {
                    console.error("写入打卡点失败:", err);
                  }

                  if (typeof onPointsChangeRef.current === "function") {
                    try {
                      onPointsChangeRef.current(
                        pointManagerRef.current.getCurrentPoints(),
                      );
                    } catch (err) {
                      console.error("onPointsChange 回调失败:", err);
                    }
                  }
                }
              }

              // 通用回调：通知父组件已拾取到坐标
              if (typeof onPickRef.current === "function") {
                try {
                  onPickRef.current([wgsLng, wgsLat]);
                } catch (err) {
                  console.error("onPick 回调失败:", err);
                }
              }
            } catch (err) {
              console.error("click handler 错误:", err);
            }
          };

          map.on("click", clickHandler);
          // 保存到 ref 以便清理
          mapRef.current = {
            map,
            clickHandler,
            AMap,
            overlays: { markers: [], polyline: null, polygon: null },
            userMarkers: [],
            routeOverlays: [],
            pointMarkers: [],
          };
        } else {
          mapRef.current = {
            map,
            AMap,
            overlays: { markers: [], polyline: null, polygon: null },
            userMarkers: [],
            routeOverlays: [],
            pointMarkers: [],
          };
        }

        const displayPath = mode === "checkpoint-edit" ? path : currentPath;
        updatePathOverlays(displayPath);
        updateRoutesOverlays(paths);
        updateUserMarkers(users);
        updatePointMarkers(points);
      })
      .catch((e) => {
        console.log(e);
      });

    return () => {
      const ref = mapRef.current;
      if (ref) {
        try {
          if (ref.clickHandler) {
            ref.map.off("click", ref.clickHandler);
          }
          ref.map.destroy();
        } catch (err) {
          // 忽略销毁错误
        }
      }
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const displayPath = mode === "checkpoint-edit" ? path : currentPath;
    updatePathOverlays(displayPath);
  }, [currentPath, path, mode]);

  useEffect(() => {
    updateRoutesOverlays(paths);
  }, [paths]);

  useEffect(() => {
    updateUserMarkers(users);
  }, [users]);

  useEffect(() => {
    updatePointMarkers(points);
  }, [points]);

  return (
    <div className={`map-container${isFullscreen ? " fullscreen" : ""}`}>
      <button
        type="button"
        className="map-fullscreen-btn"
        title={isFullscreen ? "退出全屏 (Esc)" : "全屏"}
        onClick={toggleFullscreen}
      >
        {isFullscreen ? "✕" : "⛶"}
      </button>
      <div
        id="container"
        data-mode={mode}
        style={{ width: "100%", height: "100%" }}
      />
    </div>
  );
}
