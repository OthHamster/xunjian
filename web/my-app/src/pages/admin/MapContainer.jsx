import { useEffect } from "react";
import "./MapContainer.css";
import AMapLoader from "@amap/amap-jsapi-loader";

export default function MapContainer() {
  let map = null;

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
        map = new AMap.Map("container", {
          // 设置地图容器id
          viewMode: "2D", // 是否为3D地图模式
          zoom: 17, // 初始化地图级别
          center: [117.180184, 31.769487], // 初始化地图中心点位置
        });
        const marker = new AMap.Marker({
          position: [117.177983, 31.767173], //位置
        });
        map.add(marker);
      })
      .catch((e) => {
        console.log(e);
      });

    return () => {
      map?.destroy();
    };
  }, []);

  return (
    <div id="container" className="container" style={{ height: "400px" }}></div>
  );
}
