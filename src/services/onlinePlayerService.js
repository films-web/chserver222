/**
 * Fetches online players from Redis with optional filtering.
 * @param {object} redis - The Fastify Redis instance
 * @param {object} filters - Optional filters { state, server, playerNum, guid, name }
 * @returns {Promise<Array>} Array of player objects
 */
async function getOnlinePlayers(redis, filters = {}) {
  const stream = redis.scanStream({ match: 'player:*', count: 100 });
  const players = [];

  for await (const keys of stream) {
    if (keys.length === 0) continue;

    const pipeline = redis.pipeline();
    keys.forEach(key => pipeline.hgetall(key));
    const results = await pipeline.exec();

    results.forEach(([err, data], index) => {
      if (err || !data || Object.keys(data).length === 0) return;

      const player = {
        clientId: keys[index].split(':')[1],
        guid: data.guid,
        name: data.name,
        state: data.state,
        server: data.server,
        playerNum: data.playerNum
      };

      let isMatch = true;
      if (filters.state && player.state !== filters.state) isMatch = false;
      if (filters.server && player.server !== filters.server) isMatch = false;
      if (filters.playerNum && player.playerNum !== filters.playerNum) isMatch = false;
      if (filters.guid && player.guid !== filters.guid) isMatch = false;

      if (filters.name && (!player.name || !player.name.toLowerCase().includes(filters.name.toLowerCase()))) {
        isMatch = false;
      }

      if (isMatch) {
        players.push(player);
      }
    });
  }

  return players;
}

module.exports = { getOnlinePlayers };