const loggedInUsers = [];

function upsertLoggedInUser(sessionId, user) {
  const index = loggedInUsers.findIndex((item) => item.sessionId === sessionId);

  const entry = {
    sessionId,
    id: user.id,
    username: user.username,
    roles: user.roles,
    EmployeeID: user.EmployeeID,
    loginAt: Date.now(),
  };

  if (index >= 0) {
    loggedInUsers[index] = entry;
    return;
  }

  loggedInUsers.push(entry);
}

function removeLoggedInUser(sessionId) {
  const index = loggedInUsers.findIndex((item) => item.sessionId === sessionId);
  if (index >= 0) {
    loggedInUsers.splice(index, 1);
  }
}

function getLoggedInUsers() {
  return loggedInUsers;
}

module.exports = {
  loggedInUsers,
  upsertLoggedInUser,
  removeLoggedInUser,
  getLoggedInUsers,
};
