# SpatiaLite 数据库集成指南

## 概述

已为后端项目集成 **SpatiaLite** 地理空间数据库支持，用于处理路线、地理位置和空间查询。

## 安装依赖

```bash
npm install spatialite better-sqlite3
```

或者更新现有依赖：

```bash
npm install
```

## 功能说明

### 1. 数据库初始化

在 `database_router.js` 的 `connectDatabase()` 函数中：

- 🔧 自动加载 SpatiaLite 扩展 (`mod_spatialite`)
- 📐 初始化空间元数据 (`InitSpatialMetadata`)
- 📍 为 `route` 表添加 LINESTRING 几何列（SRID: 4326, WGS84）
- 🔍 创建空间索引提高查询性能

### 2. 数据类型

#### LINESTRING（路线）

- **格式**: `LINESTRING(lon1 lat1, lon2 lat2, ..., lonN latN)`
- **示例**: `LINESTRING(120.5 30.2, 120.6 30.3, 120.7 30.4)`
- **用途**: 存储巡检路线的完整轨迹

#### POINT（点）

- **格式**: `POINT(lon lat)`
- **用途**: 检查点、风险上报位置

#### WGS84 (SRID 4326)

- 国际标准地理坐标系
- 经度范围: -180 ~ 180
- 纬度范围: -90 ~ 90

## API 使用示例

### 导入工具函数

```javascript
const routeUtils = require("./route_utils");
const Database = require("better-sqlite3");

// 在 connectDatabase() 执行后
routeUtils.setDatabase(db);
```

### 1. 添加新路线

```javascript
const result = routeUtils.addRoute("沿江路巡检", [
  [120.5, 30.2],
  [120.6, 30.25],
  [120.7, 30.3],
  [120.8, 30.35],
]);

// 返回: { success: true, routeId: 1, name: '沿江路巡检', coordinateCount: 4 }
```

### 2. 获取路线信息

```javascript
const route = routeUtils.getRoute(1);

// 返回:
// {
//   success: true,
//   routeId: 1,
//   name: '沿江路巡检',
//   geometryType: 'LINESTRING',
//   coordinates: [[120.5, 30.2], [120.6, 30.25], ...],
//   createdAt: '2026-05-14 10:30:45',
//   updatedAt: '2026-05-14 10:30:45'
// }
```

### 3. 列出所有路线

```javascript
const routes = routeUtils.listRoutes();

// 返回:
// {
//   success: true,
//   count: 2,
//   routes: [
//     { routeId: 1, name: '沿江路', length: '12543.45', pointCount: 4 },
//     { routeId: 2, name: '环城路', length: '8932.12', pointCount: 5 }
//   ]
// }
```

### 4. 更新路线几何数据

```javascript
const result = routeUtils.updateRouteGeometry(1, [
  [120.5, 30.2],
  [120.65, 30.27],
  [120.8, 30.35],
]);

// 返回: { success: true, routeId: 1, updatedCoordinateCount: 3 }
```

### 5. 偏离监控（检查点是否在路线附近）

```javascript
// 检查位置 (120.55, 30.23) 是否在路线 1 的 50 米范围内
const check = routeUtils.checkPointNearRoute(1, 120.55, 30.23, 50);

// 返回:
// {
//   success: true,
//   isWithin: true,
//   distance: '245.67',
//   bufferDistance: 50
// }
```

## Express 路由集成示例

在 `database_router.js` 中添加路线管理 API：

```javascript
// 添加路线
datarouter.post("/routes", checkRole(["admin"]), (req, res) => {
  const { name, coordinates } = req.body;
  const result = routeUtils.addRoute(name, coordinates);

  if (result.success) {
    return res.status(201).json(result);
  }
  return res.status(400).json({ error: result.error });
});

// 获取路线
datarouter.get("/routes/:id", (req, res) => {
  const route = routeUtils.getRoute(parseInt(req.params.id));

  if (route.success) {
    return res.json(route);
  }
  return res.status(404).json({ error: route.error });
});

// 列出所有路线
datarouter.get("/routes", (req, res) => {
  const routes = routeUtils.listRoutes();
  return res.json(routes);
});

// 更新路线
datarouter.put("/routes/:id", checkRole(["admin"]), (req, res) => {
  const { coordinates } = req.body;
  const result = routeUtils.updateRouteGeometry(
    parseInt(req.params.id),
    coordinates,
  );

  if (result.success) {
    return res.json(result);
  }
  return res.status(400).json({ error: result.error });
});

// 偏离监控
datarouter.post("/routes/:id/check-location", (req, res) => {
  const { longitude, latitude, bufferDistance } = req.body;
  const check = routeUtils.checkPointNearRoute(
    parseInt(req.params.id),
    longitude,
    latitude,
    bufferDistance || 50,
  );

  return res.json(check);
});
```

## 常用 SpatiaLite 函数

| 函数                             | 功能             | 示例                                     |
| -------------------------------- | ---------------- | ---------------------------------------- |
| `GeomFromText(wkt, srid)`        | 从 WKT 创建几何  | `GeomFromText('LINESTRING(...)', 4326)`  |
| `AsText(geom)`                   | 几何转 WKT       | `SELECT AsText(geom_m) FROM route`       |
| `ST_Length(geom)`                | 路线长度（米）   | `SELECT ST_Length(geom_m)`               |
| `ST_NPoints(geom)`               | 点数量           | `SELECT ST_NPoints(geom_m)`              |
| `ST_Distance(geom1, geom2)`      | 两点距离（米）   | `SELECT ST_Distance(geom_m, point_geom)` |
| `ST_DWithin(geom1, geom2, dist)` | 距离是否在范围内 | `SELECT ST_DWithin(geom_m, point, 100)`  |
| `ST_Buffer(geom, dist)`          | 创建缓冲区       | `SELECT ST_Buffer(geom_m, 50)`           |

## 坐标系说明

### SRID 4326 (WGS84)

- 全球通用的地理坐标系
- 用于 GPS、地图应用
- 中国坐标范围: `[72.004°E, 135.086°E, 18.3267°N, 53.5608°N]`

### 转换其他坐标系

如需使用其他坐标系（如高德GCJ-02），建议在应用层进行转换。

## 性能优化

1. **空间索引** ✓ 自动创建

   ```sql
   CREATE INDEX idx_route_geom ON route(geom_m)
   ```

2. **查询优化**
   - 使用 `ST_DWithin` 而不是 `ST_Distance` 进行范围查询
   - 对频繁查询的地理条件添加索引

3. **批量操作**
   - 使用事务提高性能
   ```javascript
   const insertStmt = db.prepare("INSERT INTO route...");
   const transaction = db.transaction((routes) => {
     for (const route of routes) {
       insertStmt.run(route);
     }
   });
   transaction(routesData);
   ```

## 故障排查

### 问题: SpatiaLite 扩展加载失败

- **原因**: 未安装 spatialite 或路径不正确
- **解决**: `npm install spatialite --save`

### 问题: 几何列添加失败

- **原因**: 列已存在或数据库中断
- **解决**: 检查日志，数据库会忽略重复创建

### 问题: 空间查询返回 NULL

- **原因**: 几何数据未正确初始化
- **解决**: 确认 `InitSpatialMetadata()` 执行成功

## 后续计划

- [ ] 增加路线可视化 API（GeoJSON 格式）
- [ ] 实现自动打卡（接近打卡点时触发）
- [ ] 风险点位聚类展示
- [ ] 路线优化建议（旅行商问题）
