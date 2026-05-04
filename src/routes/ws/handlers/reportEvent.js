const { addLog } = require('../../../services/logService');

async function handleReportEvent(fastify, connection, clientId, payload) {
  const event = payload.event;
  
  if (!event || !event.event_type) return;

  const { event_type, action, details, severity, player_name, guid } = event;

  try {
    await addLog(fastify.db, {
      clientId: parseInt(clientId, 10),
      player: player_name,
      guid: guid,
      type: event_type,
      action: action,
      details: details,
      severity: severity || 'low'
    });


    fastify.log.info(`[WS] Event Reported: ${event_type} from ${clientId}`);
  } catch (err) {

    fastify.log.error(`[WS] Failed to save log: ${err.message}`);
  }
}

module.exports = handleReportEvent;
