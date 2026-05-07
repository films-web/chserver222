module.exports = {
  handleAuth: require('./auth'),
  handleHeartbeat: require('./heartbeat'),
  handleUpdateState: require('./updateState'),
  handleDisconnect: require('./disconnect'),
  handleRequestWhitelist: require('./requestWhitelist'),
  handleRequestPayload: require('./requestPayload'),
  handleRequestAcStatus: require('./requestAcStatus'),
  handleRequestGuid: require('./requestGuid'),
  handleRequestFairshot: require('./requestFairshot'),
  handleTakeFairshot: require('./takeFairshot'),
  handleLogEvent: require('./logEvent')
};