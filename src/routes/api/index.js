const fs = require('fs');
const path = require('path');
const util = require('util');
const pipeline = util.promisify(require('stream').pipeline);
const zlib = require('zlib');
const crypto = require('crypto');

function computeFileHash(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}

const { getOnlinePlayers } = require('../../services/onlinePlayerService');
const { addtoWhitelist, removeFromWhitelist, updateWhitelist } = require('../../services/whitelistService');
const { getActivePayload, addPayload, removePayload, setActivePayload, updatePayload } = require('../../services/payloadService');
const { getActiveLoader, addLoader, removeLoader, setActiveLoader, updateLoader } = require('../../services/loaderService');
const { getUserByUsername, verifyPassword } = require('../../services/userService');

// Make sure you created guidService.js like we discussed!
const { getAllGuids, addCustomGuid, removeCustomGuid, updateCustomGuid } = require('../../services/guidService');

module.exports = async function (fastify, opts) {
  
  // ==========================================
  // AUTHENTICATION
  // ==========================================
  fastify.post('/login', async (request, reply) => {
    const { username, password } = request.body;
    const user = await getUserByUsername(fastify.db, username);

    if (!user || !(await verifyPassword(password, user.password))) {
      reply.code(401);
      throw new Error('Invalid username or password');
    }

    const token = fastify.jwt.sign({ id: user.id, username: user.username }, { expiresIn: '24h' });
    return { token, username: user.username, message: 'Login successful' };
  });

  // ==========================================
  // PUBLIC DASHBOARD ROUTES (Players & History)
  // ==========================================
  fastify.get('/status', async (request, reply) => {
    return { service: 'Anti-Cheat REST API' }; 
  });

  // Public endpoint: active loader info for the download page (no auth required)
  fastify.get('/loader/info', async (request, reply) => {
    const loader = await getActiveLoader(fastify.db);
    if (!loader) return reply.code(404).send({ error: 'No active loader found' });
    return {
      fileName: loader.fileName,
      version: loader.version,
      url: loader.url,
      fileSize: loader.fileSize,
    };
  });

  fastify.get('/players/online', async (request, reply) => {
      const filters = {
        state: request.query.state,
        server: request.query.server,
        guid: request.query.guid,
        name: request.query.name 
      };

      Object.keys(filters).forEach(key => filters[key] === undefined && delete filters[key]);

      const onlinePlayers = await getOnlinePlayers(fastify.redis, filters);

      const cleanedPlayers = onlinePlayers.map(player => ({
        ...player,
        displayName: player.name, 
        name: player.name ? player.name.replace(/\^./g, '').trim() : 'UnnamedPlayer'
      }));

      return { 
        total: cleanedPlayers.length, 
        players: cleanedPlayers 
      };
    });

  fastify.get('/clients/search', async (request, reply) => {
    const { guid, name } = request.query;

    if (!guid && !name) {
      reply.code(400);
      throw new Error('You must provide a guid or name to search');
    }

    let query = `
      SELECT 
        c.id, 
        c.hwid, 
        COALESCE(cg.custom_guid, c.guid) AS guid, 
        COALESCE(c."currentName", 'UnnamedPlayer') AS "currentName", 
        c."lastSeen", 
        c."createdAt" 
      FROM clients c
      LEFT JOIN custom_guids cg ON c.guid = cg.original_guid
      WHERE 1=1
    `;
    
    let params = [];
    let paramIndex = 1;

    if (guid) {
      query += ` AND (c.guid ILIKE $${paramIndex} OR cg.custom_guid ILIKE $${paramIndex})`;
      params.push(`%${guid}%`);
      paramIndex++;
    }
    
    if (name) {
      query += ` AND c."currentName" ILIKE $${paramIndex++}`;
      params.push(`%${name}%`);
    }

    query += ` ORDER BY c."lastSeen" DESC LIMIT 50`;

    try {
      const { rows } = await fastify.db.query(query, params);
      
      if (rows.length === 0) return rows;

      const pipeline = fastify.redis.pipeline();
      rows.forEach(row => pipeline.exists(`player:${row.id}`));
      const redisResults = await pipeline.exec();

      const enrichedRows = rows.map((row, index) => {
        const isOnline = redisResults[index][1] === 1; 

        return {
          ...row,
          isOnline: isOnline,
          lastSeen: isOnline ? new Date().toISOString() : row.lastSeen
        };
      });

      return enrichedRows; 

    } catch (err) {
      fastify.log.error(err);
      reply.code(500);
      throw new Error('Database search failed');
    }
  });

  fastify.get('/clients/:id', async (request, reply) => {
    const { id } = request.params;

    try {
      const query = `
        SELECT 
          c.id, 
          c.guid AS original_guid, 
          cg.custom_guid,
          COALESCE(cg.custom_guid, c.guid) AS active_guid,
          COALESCE(c."currentName", 'UnnamedPlayer') AS "currentName", 
          c."lastSeen", 
          c."createdAt" 
        FROM clients c
        LEFT JOIN custom_guids cg ON c.guid = cg.original_guid
        WHERE c.id = $1
      `;
      
      const { rows } = await fastify.db.query(query, [id]);
      
      if (rows.length === 0) {
        reply.code(404);
        throw new Error('Player not found');
      }
      
      return rows[0];
    } catch (err) {
      fastify.log.error(err);
      reply.code(500);
      throw new Error('Internal Server Error');
    }
  });

  fastify.get('/players/:id/names', async (request, reply) => {
    const { rows } = await fastify.db.query(
      'SELECT name, server, "createdAt" FROM names_history WHERE "clientId" = $1 ORDER BY "createdAt" DESC',
      [request.params.id]
    );
    return rows;
  });

  fastify.get('/players/:id/fairshots', async (request, reply) => {
    const { rows } = await fastify.db.query(
      'SELECT "imageUrl", server, "createdAt" FROM "Fairshot" WHERE "clientId" = $1 ORDER BY "createdAt" DESC',
      [request.params.id]
    );
    return rows;
  });
  
  fastify.addContentTypeParser('application/octet-stream', { parseAs: 'buffer' }, (req, body, done) => {
    done(null, body);
  });

  fastify.get('/fairshots', async (request, reply) => {
    try {
      const query = `
        SELECT 
          f."imageUrl", 
          f.server, 
          f."createdAt",
          COALESCE(cg.custom_guid, c.guid) AS active_guid,
          COALESCE(c."currentName", 'UnnamedPlayer') AS player_name
        FROM "Fairshot" f
        JOIN clients c ON f."clientId" = c.id
        LEFT JOIN custom_guids cg ON c.guid = cg.original_guid
        ORDER BY f."createdAt" DESC
        LIMIT 100
      `;
      const { rows } = await fastify.db.query(query);
      return rows;
    } catch (err) {
      fastify.log.error(err);
      reply.code(500);
      throw new Error('Failed to fetch global fairshots');
    }
  });

  fastify.post('/upload/fairshot', async (request, reply) => {
    const guid = (request.headers['x-client-guid'] || '').trim();
    const serverIp = (request.headers['x-server-ip'] || 'Unknown Server').trim();
    
    if (!guid) {
      reply.code(400);
      throw new Error('X-Client-GUID header is required.');
    }

    const compressedData = request.body;
    if (!compressedData || compressedData.length === 0) {
      reply.code(400);
      throw new Error('Empty image payload.');
    }

    try {
      const query = `
        SELECT c.id 
        FROM clients c
        LEFT JOIN custom_guids cg ON c.guid = cg.original_guid
        WHERE c.guid = $1 OR cg.custom_guid = $1 
        LIMIT 1
      `;
      const { rows } = await fastify.db.query(query, [guid]);
      
      if (rows.length === 0) {
        reply.code(404);
        throw new Error('Client not found for provided GUID.');
      }
      const clientId = rows[0].id;

      const bmpBuffer = zlib.inflateSync(compressedData);

      const uniqueFileName = `fairshot_${clientId}_${Date.now()}.bmp`;
      const saveDir = path.join(__dirname, '../../../uploads/fairshots');
      const savePath = path.join(saveDir, uniqueFileName);
      
      if (!fs.existsSync(saveDir)) {
          fs.mkdirSync(saveDir, { recursive: true });
      }
      fs.writeFileSync(savePath, bmpBuffer);

      const imageUrl = `https://api.ch-sof2.online/uploads/fairshots/${uniqueFileName}`;
      await fastify.db.query(
        `INSERT INTO "Fairshot" ("clientId", "imageUrl", "server", "createdAt") 
         VALUES ($1, $2, $3, CURRENT_TIMESTAMP)`,
        [clientId, imageUrl, serverIp]
      );

      fastify.log.info(`[FAIRSHOT] Saved screenshot for Client ID: ${clientId}`);
      return { message: 'Screenshot uploaded successfully', imageUrl: imageUrl };

    } catch (err) {
      fastify.log.error(`[FAIRSHOT ERROR] ${err.message}`);
      reply.code(500);
      throw new Error('Failed to process screenshot decompression.');
    }
  });

  // 2. Payload Uploads (Requires Admin JWT)
  fastify.post('/upload/payload', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const data = await request.file();
    if (!data) {
      reply.code(400);
      throw new Error('No payload file uploaded.');
    }

    const fileName = data.filename;
    const savePath = path.join(__dirname, '../../../uploads/payloads', fileName);
    await pipeline(data.file, fs.createWriteStream(savePath));

    const fileHash = await computeFileHash(savePath);

    return { 
      message: 'Payload uploaded successfully', 
      url: `https://api.ch-sof2.online/uploads/payloads/${fileName}`,
      fileHash,
    };
  });

  // 3. Loader Uploads (Requires Admin JWT)
  fastify.post('/upload/loader', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const data = await request.file();
    if (!data) {
      reply.code(400);
      throw new Error('No loader file uploaded.');
    }

    const fileName = data.filename;
    const saveDir = path.join(__dirname, '../../../uploads/loaders');
    if (!fs.existsSync(saveDir)) {
      fs.mkdirSync(saveDir, { recursive: true });
    }
    const savePath = path.join(saveDir, fileName);

    let fileSize = 0;
    const writeStream = fs.createWriteStream(savePath);
    data.file.on('data', (chunk) => { fileSize += chunk.length; });
    await pipeline(data.file, writeStream);

    return { 
      message: 'Loader uploaded successfully', 
      url: `https://api.ch-sof2.online/uploads/loaders/${fileName}`,
      fileSize
    };
  });

  // ==========================================
  // PROTECTED ADMIN ROUTES (Require JWT)
  // ==========================================
  
  // --- WHITELISTS ---
  fastify.get('/whitelists', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const { rows } = await fastify.db.query('SELECT * FROM whitelists ORDER BY "createdAt" DESC');
    return rows;
  });

  fastify.post('/whitelists', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const { name, hash } = request.body;
    const id = await addtoWhitelist(fastify.db, name, hash);
    return { id, name, hash, message: 'Added to whitelist' };
  });

  fastify.put('/whitelists/:id', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const { name, hash } = request.body;
    const success = await updateWhitelist(fastify.db, request.params.id, name, hash);
    if (!success) {
      reply.code(404);
      throw new Error('Whitelist ID not found');
    }
    return { updated: true, id: request.params.id };
  });

  fastify.delete('/whitelists/:hash', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const success = await removeFromWhitelist(fastify.db, request.params.hash);
    if (!success) {
      reply.code(404);
      throw new Error('Hash not found in whitelist');
    }
    return { deleted: true, hash: request.params.hash };
  });

  // --- CUSTOM GUIDS ---
  fastify.get('/guids', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const rows = await getAllGuids(fastify.db);
    return rows;
  });

  fastify.post('/guids', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const { originalGuid, customGuid } = request.body;
    const id = await addCustomGuid(fastify.db, originalGuid, customGuid);
    return { id, originalGuid, customGuid, message: 'Custom GUID mapped successfully' };
  });

  fastify.put('/guids/:id', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const { originalGuid, customGuid } = request.body;
    const success = await updateCustomGuid(fastify.db, request.params.id, originalGuid, customGuid);
    if (!success) {
      reply.code(404);
      throw new Error('GUID mapping ID not found');
    }
    return { updated: true, id: request.params.id };
  });

  fastify.delete('/guids/:originalGuid', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const success = await removeCustomGuid(fastify.db, request.params.originalGuid);
    if (!success) {
      reply.code(404);
      throw new Error('Original GUID not found in mappings');
    }
    return { deleted: true, originalGuid: request.params.originalGuid };
  });

  // --- PAYLOADS ---
  fastify.get('/payloads', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const { rows } = await fastify.db.query('SELECT * FROM "Payload" ORDER BY "createdAt" DESC');
    return rows;
  });

  fastify.get('/payloads/active', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const payload = await getActivePayload(fastify.db);
    return payload || null; 
  });

  fastify.post('/payloads', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const payloadData = request.body; 
    const id = await addPayload(fastify.db, payloadData);
    return { id, ...payloadData, message: 'Payload registered successfully' };
  });

  fastify.put('/payloads/:id', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const payloadData = request.body;
    const success = await updatePayload(fastify.db, request.params.id, payloadData);
    if (!success) {
      reply.code(404);
      throw new Error('Payload ID not found');
    }
    return { updated: true, id: request.params.id };
  });

  fastify.put('/payloads/:id/active', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const success = await setActivePayload(fastify.db, request.params.id);
    if (!success) {
      reply.code(404);
      throw new Error('Payload ID not found');
    }
    return { activated: true, id: request.params.id };
  });

  fastify.delete('/payloads/:id', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const success = await removePayload(fastify.db, request.params.id);
    if (!success) {
      reply.code(404);
      throw new Error('Payload ID not found');
    }
    return { deleted: true, id: request.params.id };
  });

  // --- LOADERS ---
  fastify.get('/loaders', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const { rows } = await fastify.db.query('SELECT * FROM "Loader" ORDER BY "createdAt" DESC');
    return rows;
  });

  fastify.get('/loaders/active', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const loader = await getActiveLoader(fastify.db);
    return loader || null; 
  });

  fastify.post('/loaders', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const loaderData = request.body; 
    const id = await addLoader(fastify.db, loaderData);
    return { id, ...loaderData, message: 'Loader registered successfully' };
  });

  fastify.put('/loaders/:id', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const loaderData = request.body;
    const success = await updateLoader(fastify.db, request.params.id, loaderData);
    if (!success) {
      reply.code(404);
      throw new Error('Loader ID not found');
    }
    return { updated: true, id: request.params.id };
  });

  fastify.put('/loaders/:id/active', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const success = await setActiveLoader(fastify.db, request.params.id);
    if (!success) {
      reply.code(404);
      throw new Error('Loader ID not found');
    }
    return { activated: true, id: request.params.id };
  });

  fastify.delete('/loaders/:id', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const success = await removeLoader(fastify.db, request.params.id);
    if (!success) {
      reply.code(404);
      throw new Error('Loader ID not found');
    }
    return { deleted: true, id: request.params.id };
  });

};