import { useEffect, useRef } from "react";
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
 * @param {string} [props.mode='preview'] - 地图模式，'preview' 只展示，'edit' 为编辑模式（目前仅占位，后续可实现点位拾取）
 * @param {Array<[number, number]>} [props.currentPath] - 当前路径坐标
 * @param {Array<Object>} [props.users] - 在线用户列表
 */
export default function MapContainer({
  mode = "preview",
  currentPath = [],
  users = [],
  pathManager = null,
  onPick = null,
  onPathsChange = null,
}) {
  const mapRef = useRef(null);

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

    const polygon =
      nextPath.length >= 3
        ? new AMap.Polygon({
            path: nextPath,
            strokeColor: lineColor,
            strokeOpacity: 0.6,
            strokeWeight: 2,
            fillColor,
            fillOpacity: 0.15,
          })
        : null;

    map.add(markers);
    if (polyline) {
      map.add(polyline);
    }
    if (polygon) {
      map.add(polygon);
    }

    ref.overlays = { markers, polyline, polygon };
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
          offset: new AMap.Pixel(0, -6),
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
        if (mode === "edit") {
          console.error("edit模式");
          const clickHandler = (e) => {
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

              // 写入 pathManager（如果外部提供）
              if (
                pathManager &&
                typeof pathManager.insertCoordinateAfterEditIndex === "function"
              ) {
                try {
                  pathManager.insertCoordinateAfterEditIndex([wgsLng, wgsLat]);
                  console.warn("坐标已插入 pathManager", wgsLng, wgsLat);
                } catch (err) {
                  console.error("写入路径失败:", err);
                }

                if (typeof onPathsChange === "function") {
                  try {
                    onPathsChange(pathManager.getCurrentPath());
                  } catch (err) {
                    console.error("onPathsChange 回调失败:", err);
                  }
                }
              }

              // 通用回调：通知父组件已拾取到坐标
              if (typeof onPick === "function") {
                try {
                  onPick([wgsLng, wgsLat]);
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
          };
        } else {
          mapRef.current = {
            map,
            AMap,
            overlays: { markers: [], polyline: null, polygon: null },
            userMarkers: [],
          };
        }

        updatePathOverlays(currentPath);
        updateUserMarkers(users);
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
    updatePathOverlays(currentPath);
  }, [currentPath, mode]);

  useEffect(() => {
    updateUserMarkers(users);
  }, [users]);

  return (
    <div
      id="container"
      className="container"
      data-mode={mode}
      style={{ height: "400px" }}
    ></div>
  );
}
