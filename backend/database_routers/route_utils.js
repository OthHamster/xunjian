/**
 * SpatiaLite 路线操作工具函数
 * 用于处理地理空间数据的添加、修改、查询
 */

let db;

const WGS84_SRID = 4326;
const UTM_SRID = 32651;

/**
 * 设置数据库实例
 * @param {Database} dbInstance - better-sqlite3 数据库实例
 */
const setDatabase = (dbInstance) => {
  db = dbInstance;
};

const buildLineString = (coordinates) =>
  `LINESTRING(${coordinates.map((coord) => `${coord[0]} ${coord[1]}`).join(",")})`;

const parseLinestring = (wktLinestring) => {
  if (!wktLinestring) return [];

  const match = wktLinestring.match(/LINESTRING\s*\((.*)\)/i);
  if (!match) return [];

  return match[1].split(",").map((pair) => {
    const [lon, lat] = pair.trim().split(/\s+/);
    return [Number.parseFloat(lon), Number.parseFloat(lat)];
  });
};

const buildRoutePayload = (coordinates) => {
  const wgs84Wkt = buildLineString(coordinates);

  const stmt = db.prepare(`
    SELECT AsText(ST_Transform(GeomFromText(?, ?), ?)) AS utm_wkt
  `);

  const row = stmt.get(wgs84Wkt, WGS84_SRID, UTM_SRID);

  if (!row?.utm_wkt) {
    throw new Error("UTM 路径转换失败");
  }

  return {
    wgs84Wkt,
    utmWkt: row.utm_wkt,
  };
};

/**
 * 添加新路线（包含几何数据）
 * @param {string} routeName - 路线名称
 * @param {Array<[number, number]>} coordinates - 坐标数组 [[lon1, lat1], [lon2, lat2], ...]
 * @returns {Object} 返回插入的路线信息
 */
const addRoute = (routeName, coordinates) => {
  try {
    if (!Array.isArray(coordinates) || coordinates.length < 2) {
      throw new Error("坐标必须是包含至少2个点的数组");
    }

    const payload = buildRoutePayload(coordinates);

    const stmt = db.prepare(`
      INSERT INTO route (name, CreatedAt, UpdatedAt)
      VALUES (?, datetime('now'), datetime('now'))
    `);

    const result = stmt.run(routeName);
    const routeId = result.lastInsertRowid;

    const geomStmt = db.prepare(`
      UPDATE route
      SET WGS84 = GeomFromText(?, ?),
          UTM = GeomFromText(?, ?)
      WHERE RouteID = ?
    `);

    geomStmt.run(
      payload.wgs84Wkt,
      WGS84_SRID,
      payload.utmWkt,
      UTM_SRID,
      routeId,
    );

    return {
      success: true,
      routeId,
      name: routeName,
      coordinateCount: coordinates.length,
      utmSrid: UTM_SRID,
    };
  } catch (error) {
    console.error("添加路线失败:", error.message);
    return { success: false, error: error.message };
  }
};

/**
 * 获取路线的地理数据
 * @param {number} routeId - 路线 ID
 * @returns {Object} 路线信息及坐标数据
 */
const getRoute = (routeId) => {
  try {
    const stmt = db.prepare(`
      SELECT 
        RouteID,
        name,
        AsText(WGS84) as wgs84_wkt,
        AsText(UTM) as utm_wkt,
        GeometryType(WGS84) as geometry_type,
        CreatedAt,
        UpdatedAt
      FROM route
      WHERE RouteID = ?
    `);

    const route = stmt.get(routeId);

    if (!route) {
      return { success: false, error: "路线不存在" };
    }

    const wgs84Coordinates = parseLinestring(route.wgs84_wkt);
    const utmCoordinates = parseLinestring(route.utm_wkt);

    return {
      success: true,
      routeId: route.RouteID,
      name: route.name,
      geometryType: route.geometry_type,
      utmSrid: UTM_SRID,
      wgs84Coordinates,
      utmCoordinates,
      createdAt: route.CreatedAt,
      updatedAt: route.UpdatedAt,
    };
  } catch (error) {
    console.error("获取路线失败:", error.message);
    return { success: false, error: error.message };
  }
};

/**
 * 列出所有路线（带简要地理信息）
 * @returns {Array} 路线列表
 */
const listRoutes = () => {
  try {
    const stmt = db.prepare(`
      SELECT 
        RouteID,
        name,
        ST_Length(UTM) as route_length,
        ST_NPoints(WGS84) as point_count,
        CreatedAt
      FROM route
      ORDER BY CreatedAt DESC
    `);

    const routes = stmt.all();
    return {
      success: true,
      count: routes.length,
      routes: routes.map((r) => ({
        routeId: r.RouteID,
        name: r.name,
        length: r.route_length ? Number(r.route_length).toFixed(2) : null,
        pointCount: r.point_count,
        createdAt: r.CreatedAt,
      })),
    };
  } catch (error) {
    console.error("列出路线失败:", error.message);
    return { success: false, error: error.message };
  }
};

/**
 * 更新路线的几何数据
 * @param {number} routeId - 路线 ID
 * @param {Array<[number, number]>} coordinates - 新坐标数组
 * @returns {Object} 更新结果
 */
const updateRouteGeometry = (routeId, coordinates) => {
  try {
    if (!Array.isArray(coordinates) || coordinates.length < 2) {
      throw new Error("坐标必须是包含至少2个点的数组");
    }

    const payload = buildRoutePayload(coordinates);

    const stmt = db.prepare(`
      UPDATE route
      SET WGS84 = GeomFromText(?, ?),
          UTM = GeomFromText(?, ?),
          UpdatedAt = datetime('now')
      WHERE RouteID = ?
    `);

    const result = stmt.run(
      payload.wgs84Wkt,
      WGS84_SRID,
      payload.utmWkt,
      UTM_SRID,
      routeId,
    );

    if (result.changes === 0) {
      return { success: false, error: "路线不存在" };
    }

    return {
      success: true,
      routeId,
      updatedCoordinateCount: coordinates.length,
      utmSrid: UTM_SRID,
    };
  } catch (error) {
    console.error("更新路线几何数据失败:", error.message);
    return { success: false, error: error.message };
  }
};

/**
 * 检查点是否在路线附近（偏离监控）
 * @param {number} routeId - 路线 ID
 * @param {number} longitude - 检查点经度
 * @param {number} latitude - 检查点纬度
 * @param {number} bufferDistance - 缓冲距离（米），默认50米
 * @returns {Object} 是否在路线附近
 */
const checkPointNearRoute = (
  routeId,
  longitude,
  latitude,
  bufferDistance = 25,
) => {
  try {
    const routeStmt = db.prepare(`
      SELECT AsText(WGS84) as wgs84_wkt
      FROM route
      WHERE RouteID = ?
    `);

    const route = routeStmt.get(routeId);
    if (!route) {
      return { success: false, error: "路线不存在" };
    }

    const routeCoordinates = parseLinestring(route.wgs84_wkt);
    if (routeCoordinates.length < 2) {
      return { success: false, error: "路线数据不完整" };
    }

    const stmt = db.prepare(`
      SELECT 
        ST_DWithin(
          UTM,
          ST_Transform(GeomFromText(?, ?), ?),
          ?
        ) as is_within
      FROM route
      WHERE RouteID = ?
    `);

    const pointWkt = `POINT(${longitude} ${latitude})`;
    const result = stmt.get(
      pointWkt,
      WGS84_SRID,
      UTM_SRID,
      bufferDistance,
      routeId,
    );

    if (!result) {
      return { success: false, error: "路线不存在" };
    }

    return {
      success: true,
      isWithin: result.is_within === 1,
      bufferDistance,
      utmSrid: UTM_SRID,
    };
  } catch (error) {
    console.error("检查点位置失败:", error.message);
    return { success: false, error: error.message };
  }
};

module.exports = {
  setDatabase,
  addRoute,
  getRoute,
  listRoutes,
  updateRouteGeometry,
  checkPointNearRoute,
};
