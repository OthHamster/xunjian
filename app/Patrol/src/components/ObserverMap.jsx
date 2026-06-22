import { useEffect, useRef } from "react";

const AMAP_KEY = "e49badb64217a9824fc5d3201ee6e3b8";
const AMAP_SECURITY = "530f19d33f82ac7fedfccc16d919ef3c";
const DEFAULT_CENTER = [117.180184, 31.769487];

const loadAMap = (() => {
  let loadingPromise;
  return () => {
    if (loadingPromise) {
      return loadingPromise;
    }

    loadingPromise = new Promise((resolve, reject) => {
      if (window.AMap) {
        resolve(window.AMap);
        return;
      }

      window._AMapSecurityConfig = {
        securityJsCode: AMAP_SECURITY,
      };

      const script = document.createElement("script");
      script.src = `https://webapi.amap.com/maps?v=2.0&key=${AMAP_KEY}`;
      script.async = true;
      script.onload = () => resolve(window.AMap);
      script.onerror = () => reject(new Error("AMap加载失败"));
      document.head.appendChild(script);
    });

    return loadingPromise;
  };
})();

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

const wgs84ToGcj02Point = (point) => {
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
  magic = 1 - 0.00669342162296594323 * magic * magic;
  const sqrtMagic = Math.sqrt(magic);
  dLat =
    (dLat * 180.0) /
    (((6378245.0 * (1 - 0.00669342162296594323)) / (magic * sqrtMagic)) *
      Math.PI);
  dLng =
    (dLng * 180.0) / ((6378245.0 / sqrtMagic) * Math.cos(radLat) * Math.PI);
  return [lng + dLng, lat + dLat];
};

const wgs84ToGcj02Path = (path) =>
  Array.isArray(path) ? path.map(wgs84ToGcj02Point) : [];

function ObserverMap({ currentLocation, path = [], points = [] }) {
  const containerIdRef = useRef(
    `observer-map-${Math.random().toString(36).slice(2)}`,
  );
  const mapRef = useRef({
    map: null,
    AMap: null,
    routePolyline: null,
    checkpointMarkers: [],
    currentMarker: null,
  });

  useEffect(() => {
    let disposed = false;

    loadAMap()
      .then((AMap) => {
        if (disposed) {
          return;
        }

        const map = new AMap.Map(containerIdRef.current, {
          viewMode: "2D",
          zoom: 16,
          center: DEFAULT_CENTER,
        });

        mapRef.current = {
          map,
          AMap,
          routePolyline: null,
          checkpointMarkers: [],
          currentMarker: null,
        };
      })
      .catch((error) => {
        console.error("AMap load error:", error);
      });

    return () => {
      disposed = true;
      if (mapRef.current?.map) {
        try {
          mapRef.current.map.destroy();
        } catch (error) {
          // ignore
        }
      }
      mapRef.current = {
        map: null,
        AMap: null,
        routePolyline: null,
        checkpointMarkers: [],
        currentMarker: null,
      };
    };
  }, []);

  useEffect(() => {
    const ref = mapRef.current;
    if (!ref?.map || !ref?.AMap) {
      return;
    }

    const gcjPath = wgs84ToGcj02Path(path);
    if (ref.routePolyline) {
      ref.map.remove(ref.routePolyline);
      ref.routePolyline = null;
    }

    if (Array.isArray(gcjPath) && gcjPath.length >= 2) {
      ref.routePolyline = new ref.AMap.Polyline({
        path: gcjPath,
        strokeColor: "#1976d2",
        strokeOpacity: 0.8,
        strokeWeight: 4,
      });
      ref.map.add(ref.routePolyline);
    }
  }, [path]);

  useEffect(() => {
    const ref = mapRef.current;
    if (!ref?.map || !ref?.AMap) {
      return;
    }

    if (ref.checkpointMarkers?.length) {
      ref.map.remove(ref.checkpointMarkers);
    }

    const markers = (Array.isArray(points) ? points : [])
      .map((point, index) => {
        const lng = Number(point?.longitude ?? point?.lng ?? point?.lon);
        const lat = Number(point?.latitude ?? point?.lat);
        if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
          return null;
        }
        const [gcjLng, gcjLat] = wgs84ToGcj02Point([lng, lat]);
        const label = point?.name || `打卡点 ${index + 1}`;
        return new ref.AMap.Marker({
          position: [gcjLng, gcjLat],
          anchor: "bottom-center",
          offset: new ref.AMap.Pixel(0, -7),
          content:
            `<div style="display:flex;flex-direction:column;align-items:center;gap:4px;">` +
            `<div style="background:#d84315;color:#fff;padding:2px 6px;border-radius:10px;font-size:11px;box-shadow:0 2px 6px rgba(0,0,0,0.25);">${label}</div>` +
            `<div style="width:10px;height:10px;border-radius:50%;background:#d84315;border:2px solid #fff;box-shadow:0 0 4px rgba(0,0,0,0.3);"></div>` +
            `</div>`,
        });
      })
      .filter(Boolean);

    if (markers.length) {
      ref.map.add(markers);
    }

    ref.checkpointMarkers = markers;
  }, [points]);

  useEffect(() => {
    const ref = mapRef.current;
    if (!ref?.map || !ref?.AMap) {
      return;
    }

    if (ref.currentMarker) {
      ref.map.remove(ref.currentMarker);
      ref.currentMarker = null;
    }

    const lng = Number(currentLocation?.longitude);
    const lat = Number(currentLocation?.latitude);
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
      return;
    }

    const [gcjLng, gcjLat] = wgs84ToGcj02Point([lng, lat]);
    ref.currentMarker = new ref.AMap.Marker({
      position: [gcjLng, gcjLat],
      anchor: "bottom-center",
      offset: new ref.AMap.Pixel(0, -7),
      content:
        `<div style="display:flex;flex-direction:column;align-items:center;gap:4px;">` +
        `<div style="background:#2f7d32;color:#fff;padding:2px 6px;border-radius:10px;font-size:11px;box-shadow:0 2px 6px rgba(0,0,0,0.25);">当前位置</div>` +
        `<div style="width:10px;height:10px;border-radius:50%;background:#2f7d32;border:2px solid #fff;box-shadow:0 0 4px rgba(0,0,0,0.3);"></div>` +
        `</div>`,
    });

    ref.map.add(ref.currentMarker);
    ref.map.setCenter([gcjLng, gcjLat]);
  }, [currentLocation]);

  return (
    <div
      id={containerIdRef.current}
      style={{ height: 360, width: "100%", marginTop: 12 }}
    />
  );
}

export default ObserverMap;
