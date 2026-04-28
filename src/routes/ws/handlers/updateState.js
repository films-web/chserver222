const { logNameChangeHistory } = require('../../../services/clientService');

module.exports = async function handleUpdateState(fastify, socket, currentClientId, payload) {
    if (!currentClientId) return;

    try {
        const playerData = payload.player_data;

        if (!playerData) {
            return socket.sendError('UPDATE_PLAYER_STATE', 'Missing player data in payload.');
        }

        const { name, id: playerNum, server_ip: server, in_game } = playerData;
        const state = in_game ? 1 : 0;
        
        const redisKey = `player:${currentClientId}`;

        const [oldName, oldServer, oldState, oldPlayerNum] = await fastify.redis.hmget(
            redisKey, 'name', 'server', 'state', 'playerNum'
        );

        let changed = false;
        const updates = {};

        if (state !== undefined && parseInt(oldState, 10) !== state) {
            updates.state = state;
            changed = true;
        }

        if (server !== undefined && server !== oldServer) {
            updates.server = server;
            changed = true;
        }

        if (playerNum !== undefined && playerNum !== null && parseInt(oldPlayerNum, 10) !== parseInt(playerNum, 10)) {
            updates.playerNum = parseInt(playerNum, 10);
            changed = true;
        }

        if (name && name !== oldName) {
            updates.name = name;
            changed = true;
        }

        if (changed) {
            await fastify.redis.hset(redisKey, updates);
        }

        if (name && name !== oldName) {
            const cleanNameLog = name.replace(/\^./g, '').trim();
            if (cleanNameLog !== "") {
                logNameChangeHistory(
                    fastify.db, currentClientId, cleanNameLog, server || oldServer
                ).catch(err => fastify.log.error(`Failed to log name history:`, err));
            }
        }

        socket.sendSuccess('UPDATE_PLAYER_STATE'); 

    } catch (err) {
        fastify.log.error(`State update error for client ${currentClientId}: ${err.stack}`);
        socket.sendError('UPDATE_PLAYER_STATE', 'Internal server error during state update.');
    }
};