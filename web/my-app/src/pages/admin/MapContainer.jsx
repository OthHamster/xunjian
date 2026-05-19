import { useEffect, useRef } from "react";
import "./MapContainer.css";
import AMapLoader from "@amap/amap-jsapi-loader";
/**
 * 简单的地图容器组件
 *
 * @param {{mode?: string}} props
 * @param {string} [props.mode='preview'] - 地图模式，'preview' 只展示，'edit' 为编辑模式（目前仅占位，后续可实现点位拾取）
 */
export default function MapContainer({
  mode = "preview",
  pathManager = null,
  onPick = null,
  onPathsChange = null,
}) {
  const mapRef = useRef(null);

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
          const marker = new AMap.Marker({
            position: [117.177983, 31.767173], // 位置
          });
          map.add(marker);
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

              // 写入 pathManager（如果外部提供）
              if (
                pathManager &&
                typeof pathManager.writeCoordinate === "function"
              ) {
                try {
                  pathManager.writeCoordinate([lng, lat]);
                  console.warn("坐标已写入 pathManager", lng, lat);
                } catch (err) {
                  // 若未设置 editIndex，则尝试创建一条新路径并重试
                  if (typeof pathManager.createNewPath === "function") {
                    try {
                      pathManager.createNewPath();
                      pathManager.writeCoordinate([lng, lat]);
                    } catch (err2) {
                      console.error("写入路径失败:", err2);
                    }
                  } else {
                    console.error("写入路径失败:", err);
                  }
                }

                if (typeof onPathsChange === "function") {
                  try {
                    onPathsChange(pathManager.getPaths());
                  } catch (err) {
                    console.error("onPathsChange 回调失败:", err);
                  }
                }
              }

              // 通用回调：通知父组件已拾取到坐标
              if (typeof onPick === "function") {
                try {
                  onPick([lng, lat]);
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
          mapRef.current = { map, clickHandler };
        } else {
          mapRef.current = { map };
        }
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

  return (
    <div
      id="container"
      className="container"
      data-mode={mode}
      style={{ height: "400px" }}
    ></div>
  );
}
