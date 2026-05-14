const express = require("express");
const datarouter = express.Router();
const checkRole = require("../permission.js");
const Database = require("better-sqlite3");
const session = require("express-session");
const path = require("path");
const { get } = require("../auth_routers/route.js");
const routeUtils = require("./route_utils");
const {
  createUser,
  deleteUserById,
  listUsers,
  updateUserById,
} = require("./user_routers");

let db;

const connectDatabase = () => {
  try {
    db = new Database("./mydatabase.db", { verbose: console.log });
    console.log("成功连接到 SQLite 数据库 (better-sqlite3)");

    // 加载 SpatiaLite 扩展
    try {
      const spatialite = require("spatialite");
      const spatialiteExtensionPath = path.join(
        __dirname,
        "../assets/mod_spatialite.dll",
      );
      db.loadExtension(spatialiteExtensionPath);
      console.log("✓ SpatiaLite 扩展加载成功");
    } catch (e) {
      console.warn("⚠ SpatiaLite 扩展加载失败，尝试加载备用路径...", e.message);
      try {
        const spatialitePath = path.join(
          __dirname,
          "../node_modules/spatialite/lib",
        );
        db.loadExtension("mod_spatialite");
      } catch (e2) {
        console.error("✗ 无法加载 SpatiaLite，请确保已安装 spatialite 包");
      }
    }

    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
    routeUtils.setDatabase(db);

    // 初始化 SpatiaLite 空间元数据
    try {
      db.exec("SELECT InitSpatialMetadata(1)");
      console.log("✓ SpatiaLite 空间元数据初始化完成");
    } catch (e) {
      console.log("✓ SpatiaLite 空间元数据已存在");
    }

    const createTables = [
      `CREATE TABLE IF NOT EXISTS users (
        UserID INTEGER PRIMARY KEY AUTOINCREMENT,
        Name TEXT NOT NULL,
        Password TEXT NOT NULL,
        Role TEXT NOT NULL,
        CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        UpdatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,

      `CREATE TABLE IF NOT EXISTS route (
        RouteID INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        UpdatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,

      `CREATE TABLE IF NOT EXISTS risks (
        RiskID INTEGER PRIMARY KEY AUTOINCREMENT,
        ReporterUserID INTEGER NOT NULL,
        RouteID INTEGER,
        Address TEXT,
        Longitude REAL NOT NULL,
        Latitude REAL NOT NULL,
        PhotoURL TEXT,
        Description TEXT NOT NULL,
        RiskLevel TEXT NOT NULL CHECK (RiskLevel IN ('low','medium','high')),
        Status TEXT NOT NULL DEFAULT 'open' CHECK (Status IN ('open','resolved')),
        ReportedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        ResolvedAt DATETIME,
        RelatedRisk INTEGER,
        ResolvedByUserID INTEGER,
        ResolveNote TEXT,
        
        FOREIGN KEY (ReporterUserID) REFERENCES users(UserID),
        FOREIGN KEY (ResolvedByUserID) REFERENCES users(UserID),
        FOREIGN KEY (RouteID) REFERENCES route(RouteID),
        FOREIGN KEY (RelatedRisk) REFERENCES risks(RiskID)
      )`,

      `CREATE TABLE IF NOT EXISTS checkpoint (
        CheckpointID INTEGER PRIMARY KEY AUTOINCREMENT,
        RouteID INTEGER NOT NULL,
        Name TEXT NOT NULL,
        SeqNo INTEGER NOT NULL,
        Longitude REAL NOT NULL,
        Latitude REAL NOT NULL,
        CheckpointType TEXT,
        Status TEXT NOT NULL DEFAULT 'active' CHECK (Status IN ('active','inactive')),
        CreatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UpdatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        
        FOREIGN KEY (RouteID) REFERENCES route(RouteID),
        UNIQUE (RouteID, SeqNo)
      )`,

      `CREATE TABLE IF NOT EXISTS checkin (
        CheckinID INTEGER PRIMARY KEY AUTOINCREMENT,
        CheckpointID INTEGER NOT NULL,
        UserID INTEGER NOT NULL,
        CheckinTime DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        Longitude REAL NOT NULL,
        Latitude REAL NOT NULL,
        Result TEXT NOT NULL CHECK (Result IN ('pass','fail')),
        PhotoURL TEXT,
        Note TEXT,
        
        FOREIGN KEY (CheckpointID) REFERENCES checkpoint(CheckpointID),
        FOREIGN KEY (UserID) REFERENCES users(UserID)
      )`,
    ];

    createTables.forEach((inits) => {
      db.exec(inits);
    });
    console.log("✓ 所有表检查/创建完毕");

    // 为 route 表添加 WGS84 和 UTM 几何列
    try {
      db.exec(
        `SELECT AddGeometryColumn('route', 'WGS84', 4326, 'LINESTRING', 'XY')`,
      );
      db.exec(
        `SELECT AddGeometryColumn('route', 'UTM', 32651, 'LINESTRING', 'XY')`,
      );
      console.log("✓ WGS84/UTM 几何列添加完成");
    } catch (e) {
      if (e.message.includes("geometry column already exists")) {
        console.log("✓ WGS84/UTM 几何列已存在");
      } else {
        console.warn("⚠ 添加几何列时出现问题:", e.message);
      }
    }

    // 为几何列创建空间索引
    try {
      db.exec(`SELECT CreateSpatialIndex('route', 'WGS84')`);
      db.exec(`SELECT CreateSpatialIndex('route', 'UTM')`);
      console.log("✓ 空间索引创建完成");
    } catch (e) {
      console.log("ℹ 空间索引状态:", e.message);
    }
  } catch (err) {
    console.error("数据库初始化失败:", err.message);
  }
};
module.exports = { connectDatabase, datarouter };

// --- API 路由定义 ---

datarouter.get("/users", checkRole(["admin"]), (req, res) => {
  try {
    const users = listUsers();
    return res.json({ success: true, users });
  } catch (error) {
    console.error("list users error:", error);
    return res.status(500).json({ error: "获取用户列表失败" });
  }
});

datarouter.post("/users", checkRole(["admin"]), (req, res) => {
  const { username, password, roles } = req.body || {};

  try {
    const user = createUser(username, password, roles);
    return res.status(201).json({ success: true, user });
  } catch (error) {
    if (
      error.code === "VALIDATION_ERROR" ||
      error.code === "INVALID_ROLE" ||
      error.code === "DUPLICATE_USERNAME"
    ) {
      return res.status(400).json({ error: error.message });
    }

    console.error("create user error:", error);
    return res.status(500).json({ error: "创建用户失败" });
  }
});

datarouter.delete("/users/:id", checkRole(["admin"]), (req, res) => {
  const userId = Number.parseInt(req.params.id, 10);

  if (!Number.isInteger(userId) || userId <= 0) {
    return res.status(400).json({ error: "用户ID不合法" });
  }

  const deleted = deleteUserById(userId);
  if (!deleted) {
    return res.status(404).json({ error: "用户不存在" });
  }

  return res.json({ success: true, deletedUserId: userId });
});

datarouter.put("/users/:id", checkRole(["admin"]), (req, res) => {
  const userId = Number.parseInt(req.params.id, 10);
  const { username, password, roles } = req.body || {};

  if (!Number.isInteger(userId) || userId <= 0) {
    return res.status(400).json({ error: "用户ID不合法" });
  }

  try {
    const user = updateUserById(userId, username, password, roles);
    if (!user) {
      return res.status(404).json({ error: "用户不存在" });
    }
    return res.json({ success: true, user });
  } catch (error) {
    if (
      error.code === "VALIDATION_ERROR" ||
      error.code === "INVALID_ROLE" ||
      error.code === "DUPLICATE_USERNAME"
    ) {
      return res.status(400).json({ error: error.message });
    }

    console.error("update user error:", error);
    return res.status(500).json({ error: "更新用户失败" });
  }
});

datarouter.get(
  "/routes",
  checkRole(["admin", "viewer", "inspector"]),
  (req, res) => {
    try {
      const result = routeUtils.listRoutes();
      if (!result.success) {
        return res.status(500).json({ error: result.error });
      }

      return res.json(result);
    } catch (error) {
      console.error("list routes error:", error);
      return res.status(500).json({ error: "获取路线列表失败" });
    }
  },
);

datarouter.get(
  "/routes/:id",
  checkRole(["admin", "viewer", "inspector"]),
  (req, res) => {
    const routeId = Number.parseInt(req.params.id, 10);

    if (!Number.isInteger(routeId) || routeId <= 0) {
      return res.status(400).json({ error: "路线ID不合法" });
    }

    try {
      const result = routeUtils.getRoute(routeId);
      if (!result.success) {
        return res.status(404).json({ error: result.error });
      }

      return res.json(result);
    } catch (error) {
      console.error("get route error:", error);
      return res.status(500).json({ error: "获取路线失败" });
    }
  },
);

datarouter.post("/routes", checkRole(["admin"]), (req, res) => {
  const { name, coordinates } = req.body || {};

  try {
    const result = routeUtils.addRoute(name, coordinates);
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    return res.status(201).json(result);
  } catch (error) {
    console.error("add route error:", error);
    return res.status(500).json({ error: "添加路线失败" });
  }
});

datarouter.put("/routes/:id", checkRole(["admin"]), (req, res) => {
  const routeId = Number.parseInt(req.params.id, 10);
  const { coordinates } = req.body || {};

  if (!Number.isInteger(routeId) || routeId <= 0) {
    return res.status(400).json({ error: "路线ID不合法" });
  }

  try {
    const result = routeUtils.updateRouteGeometry(routeId, coordinates);
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    return res.json(result);
  } catch (error) {
    console.error("update route error:", error);
    return res.status(500).json({ error: "更新路线失败" });
  }
});

datarouter.post(
  "/routes/:id/check-location",
  checkRole(["admin", "inspector"]),
  (req, res) => {
    const routeId = Number.parseInt(req.params.id, 10);
    const { longitude, latitude, bufferDistance } = req.body || {};

    if (!Number.isInteger(routeId) || routeId <= 0) {
      return res.status(400).json({ error: "路线ID不合法" });
    }

    const longitudeValue = Number(longitude);
    const latitudeValue = Number(latitude);

    if (!Number.isFinite(longitudeValue) || !Number.isFinite(latitudeValue)) {
      return res.status(400).json({ error: "经纬度不合法" });
    }

    try {
      const result = routeUtils.checkPointNearRoute(
        routeId,
        longitudeValue,
        latitudeValue,
        Number.isFinite(Number(bufferDistance)) ? Number(bufferDistance) : 50,
      );

      if (!result.success) {
        return res.status(404).json({ error: result.error });
      }

      return res.json(result);
    } catch (error) {
      console.error("check route location error:", error);
      return res.status(500).json({ error: "偏离监控失败" });
    }
  },
);

// 简单添加测试
/* datarouter.post("/add", checkRole("editor"), (req, res) => {
  const { id, text } = req.body;
  const sql = "INSERT INTO test (id, text) VALUES (?, ?)";

  try {
    const info = db.prepare(sql).run(id, text);
    res.json({ message: "添加成功", changes: info.changes });
  } catch (err) {
    res.status(500).json({ error: "添加失败: " + err.message });
  }
});

// 批量添加 Customer (使用事务)
datarouter.post(
  "/addCustomer",
  checkRole(["cashier", "manager"]),
  (req, res) => {
    if (!req.session.isAuthenticated) {
      return res.status(401).json({ error: "未登录" });
    }

    const dataList = req.body; // 假设传入的是数组
    const sql = `INSERT INTO Customers (Name, ContactInfo) VALUES (@name, @ContactInfo)`;

    try {
      const insertMany = db.transaction((customers) => {
        const stmt = db.prepare(sql);
        for (const customer of customers) {
          stmt.run({
            name: customer.name,
            ContactInfo: customer.ContactInfo,
          });
        }
      });

      insertMany(dataList);

      res.send({ code: 200, msg: "客户数据已成功批量录入" });
    } catch (err) {
      console.error("批量插入失败:", err.message);
      res.status(500).send({ code: 500, msg: "插入失败，所有更改已回滚" });
    }
  }
);
datarouter.post("/addProduct", checkRole(["manager"]), (req, res) => {
  if (!req.session.isAuthenticated) {
    return res.status(401).json({ error: "未登录" });
  }

  const dataList = req.body;
  const sql = `INSERT INTO Products (Name, Price,Description) VALUES (?,?,?)`;
  const sql2 = `INSERT INTO Inventory (ProductID, Quantity,Location) VALUES (?,?,?)`;
  try {
    const insertMany = db.transaction((products) => {
      const stmt = db.prepare(sql);
      const stmt2 = db.prepare(sql2);
      for (const product of products) {
        id = stmt.run(
          product.Name,
          product.Price,
          product.Description
        ).lastInsertRowid;
        stmt2.run(id, 0, 1);
      }
    });

    insertMany(dataList);

    res.send({ code: 200, msg: "数据已成功批量录入" });
  } catch (err) {
    console.error("批量插入失败:", err.message);
    res.status(500).send({ code: 500, msg: "插入失败，所有更改已回滚" });
  }
});
// 搜索 Customer
datarouter.post("/searchCustomer", checkRole("cashier"), (req, res) => {
  const ContactInfo = req.body.ContactInfo;
  const sql = "SELECT * FROM Customers WHERE ContactInfo = ?";

  try {
    // .get() 返回单行对象，没找到返回 undefined
    const row = db.prepare(sql).get(ContactInfo);

    if (row) {
      console.log("查询结果：", row);
      return res.send({ status: "success", data: row });
    } else {
      console.log("查无此人");
      return res.send({ status: "fail", msg: "未找到该用户" });
    }
  } catch (err) {
    console.error(err.message);
    return res.status(500).send("数据库查询出错");
  }
});

// 获取所有 Customers
datarouter.post(
  "/getCustomer",
  checkRole(["cashier", "manager"]),
  (req, res) => {
    const sql = "SELECT * FROM Customers";

    try {
      // .all() 返回数组
      const rows = db.prepare(sql).all();

      if (rows && rows.length > 0) {
        console.log(`查询到 ${rows.length} 条记录`);
        return res.send({ status: "success", data: rows });
      } else {
        return res.send({ status: "fail", msg: "暂无客户数据" });
      }
    } catch (err) {
      console.error(err.message);
      return res.status(500).send("数据库查询出错");
    }
  }
);

// 删除 Customer
datarouter.post("/delCustomer", checkRole("manager"), (req, res) => {
  const CustomerID = req.body.CustomerID;
  const sql = `DELETE FROM Customers WHERE CustomerID = ?`;

  try {
    const info = db.prepare(sql).run(CustomerID);

    // info.changes 表示受影响的行数
    if (info.changes > 0) {
      return res.send({ status: "success", CustomerID: CustomerID });
    } else {
      return res.send({ status: "fail", msg: "删除失败，ID可能不存在" });
    }
  } catch (err) {
    console.error(err.message);
    return res.status(500).send("数据库操作出错");
  }
});

// 更新 Customer
datarouter.post("/updateCustomer", checkRole("manager"), (req, res) => {
  console.log("传入修改：", req.body);
  const { CustomerID, Name, ContactInfo, MembershipLevel, Points } = req.body;

  const sql = `UPDATE Customers SET Name = ?, ContactInfo = ? ,MembershipLevel=?, Points=? WHERE CustomerID = ?`;

  try {
    const info = db
      .prepare(sql)
      .run(Name, ContactInfo, MembershipLevel, Points, CustomerID);

    console.log("修改行数：", info.changes);
    return res.send({ status: "success", changes: info.changes });
  } catch (err) {
    console.error(err.message);
    return res.status(500).send("数据库操作出错");
  }
});
// 删除 Product
//也许不可以

// 更新 Product
datarouter.post("/updateProduct", checkRole("manager"), (req, res) => {
  console.log("传入修改：", req.body);
  const { ProductID, Name, Description } = req.body;

  const sql = `UPDATE Products SET Name = ?, Description = ?  WHERE ProductID = ?`;

  try {
    const info = db.prepare(sql).run(Name, Description, ProductID);

    console.log("修改行数：", info.changes);
    return res.send({ status: "success", changes: info.changes });
  } catch (err) {
    console.error(err.message);
    return res.status(500).send("数据库操作出错");
  }
});
// 获取 Product (联表查询)
datarouter.post(
  "/getProducts",
  checkRole(["cashier", "manager"]),
  (req, res) => {
    const sql =
      "SELECT * FROM Products, Inventory WHERE Products.ProductID = Inventory.ProductID";

    try {
      const rows = db.prepare(sql).all();

      if (rows && rows.length > 0) {
        console.log(`查询到 ${rows.length} 个商品库存信息`);
        return res.send({ status: "success", data: rows });
      } else {
        return res.send({ status: "fail", msg: "未找到商品数据" });
      }
    } catch (err) {
      console.error(err.message);
      return res.status(500).send("数据库查询出错");
    }
  }
);
datarouter.post("/getProductName", checkRole(["manager"]), (req, res) => {
  const sql =
    "SELECT * FROM Products, Inventory WHERE Products.ProductID = Inventory.ProductID";

  try {
    const rows = db.prepare(sql).all();

    if (rows && rows.length > 0) {
      console.log(`查询到 ${rows.length} 个商品库存信息`);
      return res.send({ status: "success", data: rows });
    } else {
      return res.send({ status: "fail", msg: "未找到商品数据" });
    }
  } catch (err) {
    console.error(err.message);
    return res.status(500).send("数据库查询出错");
  }
});
datarouter.post("/sell", checkRole("cashier"), (req, res) => {
  const CustomerID = req.body.CustomerID;
  const ProductListUpdate = req.body.ProductList;
  const EmployeeID = req.session.user.EmployeeID;
  let sumMoney = 0;
  let PointsAfter = 0;
  let CustomerName = "";
  var stamp = new Date().getTime() + 8 * 60 * 60 * 1000;
  var beijingTime = new Date(stamp)
    .toISOString()
    .replace(/T/, " ")
    .replace(/\..+/, "")
    .substring(0, 19);
  const sellMany = db.transaction((CustomerID, ProductList, EmployeeID) => {
    //计算总金额
    const sql = `SELECT Products.ProductID,Price, Inventory.Quantity FROM Products, Inventory WHERE Products.ProductID = Inventory.ProductID`;
    const stmt = db.prepare(sql);
    const productMap = new Map();
    priceList = stmt.all();
    priceList.forEach((Product) => {
      productMap.set(Product.ProductID, Product);
    });
    ProductListUpdate.forEach((Product) => {
      sumMoney +=
        Product.Quantity * productMap.get(Number(Product.ProductID)).Price;
    });
    //更新库存表
    const sql2 = `UPDATE Inventory SET Quantity = ? WHERE ProductID = ?`;
    const stmt2 = db.prepare(sql2);
    ProductListUpdate.forEach((Product) => {
      QuantityBefore = productMap.get(Number(Product.ProductID)).Quantity;
      QuantityAfter = QuantityBefore - Product.Quantity;
      stmt2.run(QuantityAfter, Product.ProductID);
    });
    //更新交易表
    const sql3 = `INSERT INTO Sales (EmployeeID, CustomerID,SaleDate,TotalAmount) VALUES (?, ?,?,?)`;
    const stmt3 = db.prepare(sql3);
    const SaleID = stmt3.run(
      EmployeeID,
      CustomerID,
      beijingTime,
      sumMoney
    ).lastInsertRowid;

    //更新交易详情表
    const sql4 = `INSERT INTO SaleDetails (SaleID,ProductID,Quantity) VALUES (?, ?,?)`;
    const stmt4 = db.prepare(sql4);
    ProductListUpdate.forEach((Product) => {
      stmt4.run(SaleID, Product.ProductID, Product.Quantity);
    });
    //更新顾客点数
    const sql5 = `SELECT Points,Name FROM Customers WHERE CustomerID = ?`;
    const stmt5 = db.prepare(sql5);
    re = stmt5.get(CustomerID);
    const CustomerPoints = re.Points;
    CustomerName = re.Name;
    const sql6 = `UPDATE Customers SET Points = ? WHERE CustomerID = ?`;
    const stmt6 = db.prepare(sql6);
    PointsAfter = CustomerPoints + sumMoney;
    stmt6.run(PointsAfter, CustomerID);
  });
  try {
    sellMany(CustomerID, ProductListUpdate, EmployeeID);
    res.send({
      status: "success",
      Name: CustomerName,
      SumMoney: sumMoney,
      Points: PointsAfter,
    });
  } catch (err) {
    console.error(err.message);
    return res.status(500).send("数据库操作出错");
  }
});
datarouter.post("/order", checkRole("manager"), (req, res) => {
  const ProductListUpdate = req.body.ProductList;
  var stamp = new Date().getTime() + 8 * 60 * 60 * 1000;
  var beijingTime = new Date(stamp)
    .toISOString()
    .replace(/T/, " ")
    .replace(/\..+/, "")
    .substring(0, 19);
  const orderMany = db.transaction((ProductList) => {
    //更新订购表
    const sql1 = `INSERT INTO Orders (OrderDate) VALUES (?)`;
    const stmt1 = db.prepare(sql1);
    const OrderID = stmt1.run(beijingTime).lastInsertRowid;

    //更新订购详情表
    const sql2 = `INSERT INTO OrderDetails (OrderID,ProductID,Quantity) VALUES (?, ?,?)`;
    const stmt2 = db.prepare(sql2);
    ProductList.forEach((Product) => {
      stmt2.run(OrderID, Product.ProductID, Product.Quantity);
    });
  });
  try {
    orderMany(ProductListUpdate);
    res.send({
      status: "success",
    });
  } catch (err) {
    console.error(err.message);
    return res.status(500).send("数据库操作出错");
  }
});
datarouter.post("/getOrderDetails", checkRole(["inventory"]), (req, res) => {
  const sql =
    "SELECT * FROM Products, Orders,OrderDetails WHERE Products.ProductID = OrderDetails.ProductID AND OrderDetails.OrderID=Orders.OrderID";

  try {
    const rows = db.prepare(sql).all();

    if (rows && rows.length > 0) {
      console.log(`查询到 ${rows.length} 个商品库存信息`);
      return res.send({ status: "success", data: rows });
    } else {
      return res.send({ status: "fail", msg: "未找到商品数据" });
    }
  } catch (err) {
    console.error(err.message);
    return res.status(500).send("数据库查询出错");
  }
});
datarouter.post("/confirmOrder", checkRole("inventory"), (req, res) => {
  const OrderID = req.body.OrderID;
  const orderMany = db.transaction((OrderID) => {
    //获取订单详细
    const sql1 = `SELECT ProductID,Quantity FROM OrderDetails WHERE OrderID = ?`;
    const stmt1 = db.prepare(sql1);
    const upadteProducts = stmt1.all(OrderID);
    console.log(upadteProducts);
    //获取原有数量
    const get = `SELECT * FROM Inventory `;
    const getstmt = db.prepare(get);
    const quantityMap = new Map();
    quantityList = getstmt.all();
    quantityList.forEach((item) => {
      quantityMap.set(item.ProductID, item.Quantity);
    });
    //根据订单详情更新库存表
    upadteProducts.forEach((order) => {
      const update = `UPDATE Inventory SET Quantity = ? WHERE ProductID = ?`;
      const stmt2 = db.prepare(update);
      quantityAfter = order.Quantity + quantityMap.get(Number(order.ProductID));
      stmt2.run(quantityAfter, order.ProductID);
    });
    //级联删除order
    db.prepare("DELETE FROM Orders WHERE OrderID = ?").run(OrderID);
  });
  try {
    orderMany(OrderID);
    res.send({
      status: "success",
    });
  } catch (err) {
    console.error(err.message);
    return res.status(500).send("数据库操作出错");
  }
}); */
