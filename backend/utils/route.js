/**
 * SpatiaLite 路线操作工具函数
 * 用于处理地理空间数据的添加、修改、查询
 */

let db;

const WGS84_SRID = 4326;
const UTM_SRID = 32651;

// 检查当前 SQLite 数据库中是否存在指定表。
const hasTable = (tableName) => {
  const row = db
    .prepare(
      "SELECT 1 AS ok FROM sqlite_master WHERE type = 'table' AND name = ? LIMIT 1",
    )
    .get(tableName);
  return Boolean(row?.ok);
};

/**
 * 设置数据库实例
 * @param {Database} dbInstance - better-sqlite3 数据库实例
 */
// 注入 better-sqlite3 实例供所有工具函数使用。
const setDatabase = (dbInstance) => {
  db = dbInstance;
};

// 将坐标对转换为 WKT LINESTRING。
const buildLineString = (coordinates) =>
  `LINESTRING(${coordinates.map((coord) => `${coord[0]} ${coord[1]}`).join(",")})`;

// 解析 WKT LINESTRING 为 [lon, lat] 坐标对。
const parseLinestring = (wktLinestring) => {
  if (!wktLinestring) return [];

  const match = wktLinestring.match(/LINESTRING\s*\((.*)\)/i);
  if (!match) return [];

  return match[1].split(",").map((pair) => {
    const [lon, lat] = pair.trim().split(/\s+/);
    return [Number.parseFloat(lon), Number.parseFloat(lat)];
  });
};

// 生成 WGS84/UTM 的 WKT 以便插入或更新。
const buildRoutePayload = (coordinates) => {
  if (!db) {
    throw new Error("数据库未初始化");
  }

  if (!hasTable("spatial_ref_sys")) {
    throw new Error("空间元数据未初始化：缺少 spatial_ref_sys");
  }

  const wgs84Wkt = buildLineString(coordinates);

  // 测试解析 (使用 CAST 确保 SRID 是整数)
  const geomTest = db
    .prepare(
      `
    SELECT AsText(ST_GeomFromText(?, CAST(? AS INTEGER))) AS geom
  `,
    )
    .get(wgs84Wkt, WGS84_SRID);
  console.log("GeomFromText 解析结果:", geomTest);

  // 恢复使用动态参数的查询，并在 SQL 中强制转换 SRID 为 INTEGER
  const stmt = db.prepare(`
    SELECT AsText(ST_Transform(ST_GeomFromText(?, CAST(? AS INTEGER)), CAST(? AS INTEGER))) AS utm_wkt
  `);

  // 执行转换
  const row = stmt.get(wgs84Wkt, WGS84_SRID, UTM_SRID);
  console.log("UTM转换结果 row:", row);

  return {
    wgs84Wkt,
    utmWkt: row ? row.utm_wkt : null,
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
      SET WGS84 = GeomFromText(?, CAST(? AS INTEGER)),
          UTM = GeomFromText(?, CAST(? AS INTEGER))
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
        CASE
          WHEN UTM IS NULL THEN NULL
          WHEN ST_NPoints(UTM) < 2 THEN NULL
          ELSE ST_Length(UTM) + ST_Distance(ST_StartPoint(UTM), ST_EndPoint(UTM))
        END as route_length,
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
      SET WGS84 = GeomFromText(?, CAST(? AS INTEGER)),
          UTM = GeomFromText(?, CAST(? AS INTEGER)),
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
 * 删除路线
 * @param {number} routeId - 路线 ID
 * @returns {Object} 删除结果
 */
const deleteRoute = (routeId) => {
  try {
    const stmt = db.prepare(`
      DELETE FROM route
      WHERE RouteID = ?
    `);

    const result = stmt.run(routeId);

    if (result.changes === 0) {
      return { success: false, error: "路线不存在" };
    }

    return { success: true, routeId };
  } catch (error) {
    console.error("删除路线失败:", error.message);
    return { success: false, error: error.message };
  }
};

/**
 * 计算点到路线的最短距离
 * @param {number} routeId - 路线 ID
 * @param {number} longitude - 点经度
 * @param {number} latitude - 点纬度
 * @returns {Object} 距离信息
 */
const getPointToRouteDistance = (routeId, longitude, latitude) => {
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

    const closedCoordinates = routeCoordinates.slice();
    const first = closedCoordinates[0];
    const last = closedCoordinates[closedCoordinates.length - 1];
    if (first[0] !== last[0] || first[1] !== last[1]) {
      closedCoordinates.push(first);
    }

    const closedWkt = buildLineString(closedCoordinates);

    const stmt = db.prepare(`
      SELECT 
        ST_Distance(
          ST_Transform(GeomFromText(?, CAST(? AS INTEGER)), CAST(? AS INTEGER)),
          ST_Transform(GeomFromText(?, CAST(? AS INTEGER)), CAST(? AS INTEGER))
        ) as distance
    `);

    const pointWkt = `POINT(${longitude} ${latitude})`;
    const result = stmt.get(
      pointWkt,
      WGS84_SRID,
      UTM_SRID,
      closedWkt,
      WGS84_SRID,
      UTM_SRID,
    );

    if (!result) {
      return { success: false, error: "路线不存在" };
    }

    return {
      success: true,
      routeId,
      distance: result.distance,
      utmSrid: UTM_SRID,
    };
  } catch (error) {
    console.error("计算点到路线距离失败:", error.message);
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

    try {
      const stmt = db.prepare(`
        SELECT 
          ST_DWithin(
            UTM,
            ST_Transform(GeomFromText(?, CAST(? AS INTEGER)), CAST(? AS INTEGER)),
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
      if (!String(error.message).includes("ST_DWithin")) {
        throw error;
      }

      // Fallback: approximate distance on WGS84 if ST_DWithin is unavailable.
      const metersPerDegLat = 111320;
      const lat0 = Number(latitude);
      const metersPerDegLng =
        metersPerDegLat * Math.cos((lat0 * Math.PI) / 180);
      const pointX = Number(longitude) * metersPerDegLng;
      const pointY = lat0 * metersPerDegLat;

      const toXY = ([lon, lat]) => [
        lon * metersPerDegLng,
        lat * metersPerDegLat,
      ];

      const distanceToSegment = (px, py, ax, ay, bx, by) => {
        const dx = bx - ax;
        const dy = by - ay;
        if (dx === 0 && dy === 0) {
          const sx = px - ax;
          const sy = py - ay;
          return Math.hypot(sx, sy);
        }

        const t = ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy);
        const clamped = Math.max(0, Math.min(1, t));
        const cx = ax + clamped * dx;
        const cy = ay + clamped * dy;
        return Math.hypot(px - cx, py - cy);
      };

      let minDistance = Number.POSITIVE_INFINITY;
      for (let i = 0; i < routeCoordinates.length - 1; i += 1) {
        const [ax, ay] = toXY(routeCoordinates[i]);
        const [bx, by] = toXY(routeCoordinates[i + 1]);
        const dist = distanceToSegment(pointX, pointY, ax, ay, bx, by);
        if (dist < minDistance) {
          minDistance = dist;
        }
      }

      return {
        success: true,
        isWithin: minDistance <= bufferDistance,
        bufferDistance,
        utmSrid: null,
        distance: minDistance,
      };
    }
  } catch (error) {
    console.error("检查点位置失败:", error.message);
    return { success: false, error: error.message };
  }
};

/**
 * 检查两个坐标的距离是否小于给定阈值（米）
 * @param {number} longitudeA
 * @param {number} latitudeA
 * @param {number} longitudeB
 * @param {number} latitudeB
 * @param {number} maxDistanceMeters
 * @returns {Object}
 */
const isDistanceWithin = (
  longitudeA,
  latitudeA,
  longitudeB,
  latitudeB,
  maxDistanceMeters,
) => {
  try {
    const lonA = Number(longitudeA);
    const latA = Number(latitudeA);
    const lonB = Number(longitudeB);
    const latB = Number(latitudeB);
    const maxDistance = Number(maxDistanceMeters);

    if (
      !Number.isFinite(lonA) ||
      !Number.isFinite(latA) ||
      !Number.isFinite(lonB) ||
      !Number.isFinite(latB)
    ) {
      throw new Error("坐标不合法");
    }

    if (!Number.isFinite(maxDistance) || maxDistance < 0) {
      throw new Error("距离阈值不合法");
    }

    const stmt = db.prepare(`
      SELECT
        ST_Distance(
          ST_Transform(GeomFromText(?, CAST(? AS INTEGER)), CAST(? AS INTEGER)),
          ST_Transform(GeomFromText(?, CAST(? AS INTEGER)), CAST(? AS INTEGER))
        ) as distance
    `);

    const pointA = `POINT(${lonA} ${latA})`;
    const pointB = `POINT(${lonB} ${latB})`;
    const result = stmt.get(
      pointA,
      WGS84_SRID,
      UTM_SRID,
      pointB,
      WGS84_SRID,
      UTM_SRID,
    );

    const distance = result?.distance;
    if (!Number.isFinite(distance)) {
      throw new Error("距离计算失败");
    }

    return {
      success: true,
      distance,
      isWithin: distance <= maxDistance,
      maxDistance,
      utmSrid: UTM_SRID,
    };
  } catch (error) {
    console.error("计算坐标距离失败:", error.message);
    return { success: false, error: error.message };
  }
};

module.exports = {
  setDatabase,
  addRoute,
  getRoute,
  listRoutes,
  updateRouteGeometry,
  deleteRoute,
  getPointToRouteDistance,
  checkPointNearRoute,
  isDistanceWithin,
};
