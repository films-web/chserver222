module.exports = {
  AUTH_REQUEST: require('./auth'),
  HEARTBEAT: require('./heartbeat'),
  UPDATE_PLAYER_STATE: require('./updateState'),
  PK3_WHITELIST_REQ: require('./requestWhitelist'),
  PAYLOAD_REQ: require('./requestPayload'),
  PLAYER_LIST_REQ: require('./requestAcStatus'),
  GET_GUID_REQ: require('./requestGuid'),
  REQUEST_FAIRSHOT: require('./requestFairshot'),
  TAKE_FAIRSHOT: require('./takeFairshot'),
  DISCONNECT: require('./disconnect')
};