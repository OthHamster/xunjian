const users = [
  {
    id: 1,
    username: "admin",
    password: "admin123",
    roles: "admin",
    EmployeeID: "1",
  },
  {
    id: 2,
    username: "manager",
    password: "manager123",
    roles: "manager",
    EmployeeID: "1",
  },
  {
    id: 3,
    username: "cashier",
    password: "cashier123",
    roles: "cashier",
    EmployeeID: "1",
  },
  {
    id: 4,
    username: "inventory",
    password: "inventory123",
    roles: "inventory",
    EmployeeID: "1",
  },
];

function findUserByCredentials(username, password) {
  for (u of users) {
    if (username === u.username && password === u.password) {
      return u;
    }
  }
  return null;
}
module.exports = findUserByCredentials;
