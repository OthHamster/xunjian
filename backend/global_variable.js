const loggedInUsers = [];

function upsertLoggedInUser(sessionId, user) {
  const index = loggedInUsers.findIndex((item) => item.sessionId === sessionId);
  const previous = index >= 0 ? loggedInUsers[index] : null;

  const entry = {
    sessionId,
    id: user.id,
    username: user.username,
    roles: user.roles,
    EmployeeID: user.EmployeeID,
    loginAt: Date.now(),
    socketId: previous ? previous.socketId : null,
    lastHeartbeatAt: previous ? previous.lastHeartbeatAt : null,
    location: previous ? previous.location : null,
    locationUpdatedAt: previous ? previous.locationUpdatedAt : null,
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

function bindSocketToSession(sessionId, socketId) {
  const user = loggedInUsers.find((item) => item.sessionId === sessionId);
  if (!user) {
    return false;
  }

  user.socketId = socketId;
  user.lastHeartbeatAt = Date.now();
  return true;
}

function touchHeartbeat(sessionId) {
  const user = loggedInUsers.find((item) => item.sessionId === sessionId);
  if (!user) {
    return false;
  }

  user.lastHeartbeatAt = Date.now();
  return true;
}

function updateLocationBySession(sessionId, location) {
  const user = loggedInUsers.find((item) => item.sessionId === sessionId);
  if (!user) {
    return false;
  }

  if (!location) {
    return true;
  }

  user.location = {
    latitude: location.latitude,
    longitude: location.longitude,
    accuracy: location.accuracy,
  };
  user.locationUpdatedAt = Date.now();
  return true;
}

function clearSocketBindingBySocketId(socketId) {
  const user = loggedInUsers.find((item) => item.socketId === socketId);
  if (!user) {
    return;
  }

  user.socketId = null;
}

function getLoggedInUsers() {
  return loggedInUsers;
}

module.exports = {
  loggedInUsers,
  upsertLoggedInUser,
  removeLoggedInUser,
  bindSocketToSession,
  touchHeartbeat,
  updateLocationBySession,
  clearSocketBindingBySocketId,
  getLoggedInUsers,
};
