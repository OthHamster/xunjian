const express = require("express");
const datarouter = express.Router();
const checkRole = require("./permission.js");
const Database = require("better-sqlite3");
const session = require("express-session");
const { get } = require("./route.js");

let db;

const connectDatabase = () => {
  try {
    db = new Database("./mydatabase.db", { verbose: console.log });
    console.log("成功连接到 SQLite 数据库 (better-sqlite3)");

    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");

    const createTables = [
      `CREATE TABLE IF NOT EXISTS Products (
        ProductID INTEGER PRIMARY KEY AUTOINCREMENT,
        Name TEXT NOT NULL,
        Category TEXT,
        Price REAL NOT NULL,
        Description TEXT
      )`,
      `CREATE TABLE IF NOT EXISTS Inventory (
        InventoryID INTEGER PRIMARY KEY AUTOINCREMENT,
        ProductID INTEGER NOT NULL,
        Quantity INTEGER NOT NULL,
        Location TEXT,
        FOREIGN KEY (ProductID) REFERENCES Products(ProductID)
      )`,
      `CREATE TABLE IF NOT EXISTS Employees (
        EmployeeID INTEGER PRIMARY KEY AUTOINCREMENT,
        Name TEXT NOT NULL,
        Role TEXT NOT NULL, 
        ContactInfo TEXT,
        HireDate TEXT
      )`,
      `CREATE TABLE IF NOT EXISTS Customers (
        CustomerID INTEGER PRIMARY KEY AUTOINCREMENT,
        Name TEXT NOT NULL,
        ContactInfo TEXT,
        MembershipLevel TEXT,
        Points INTEGER DEFAULT 0
      )`,
      `CREATE TABLE IF NOT EXISTS Sales (
        SaleID INTEGER PRIMARY KEY AUTOINCREMENT,
        EmployeeID INTEGER NOT NULL,
        CustomerID INTEGER,
        SaleDate TEXT NOT NULL,
        TotalAmount REAL NOT NULL,
        FOREIGN KEY (EmployeeID) REFERENCES Employees(EmployeeID),
        FOREIGN KEY (CustomerID) REFERENCES Customers(CustomerID)
      )`,
      `CREATE TABLE IF NOT EXISTS SaleDetails (
        DetailID INTEGER PRIMARY KEY AUTOINCREMENT,
        SaleID INTEGER NOT NULL,
        ProductID INTEGER NOT NULL,
        Quantity INTEGER NOT NULL,
        FOREIGN KEY (SaleID) REFERENCES Sales(SaleID)

      )`,
      `CREATE TABLE IF NOT EXISTS Orders (
        OrderID INTEGER PRIMARY KEY AUTOINCREMENT,
        OrderDate TEXT NOT NULL
      )`,
      // 注意：修正了原来代码中的逻辑错误，OrderDetails 应该指向 Orders 表
      `CREATE TABLE IF NOT EXISTS OrderDetails (
        DetailID INTEGER PRIMARY KEY AUTOINCREMENT,
        OrderID INTEGER NOT NULL,
        ProductID INTEGER NOT NULL,
        Quantity INTEGER NOT NULL,
        FOREIGN KEY (OrderID) REFERENCES Orders(OrderID) ON DELETE CASCADE ,
        FOREIGN KEY (ProductID) REFERENCES Products(ProductID)
      )`,
    ];

    createTables.forEach((sql) => {
      db.exec(sql);
    });
    const sql = `INSERT INTO Employees (EmployeeID,Name, Role) VALUES (?,?,?)`;
    const stmt = db.prepare(sql);
    stmt.run(1, "小洪", "收银员");
    console.log("所有表检查/创建完毕");
  } catch (err) {
    console.error("数据库初始化失败:", err.message);
  }
};

// --- API 路由定义 ---

// 简单添加测试
datarouter.post("/add", checkRole("editor"), (req, res) => {
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
});
module.exports = { connectDatabase, datarouter };
