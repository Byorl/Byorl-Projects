const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const fetch = require('node-fetch');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const wss = new WebSocket.Server({ port: 5001 });
const wsClients = new Map();

console.log('WebSocket server running on ws://localhost:5001');

wss.on('connection', (ws) => {
    let clientUserId = null;
    
    ws.on('message', (data) => {
        try {
            const msg = JSON.parse(data.toString());
            
            if (msg.type === 'heartbeat') {
                const { userId, username, ping, ram } = msg;
                const strId = userId?.toString();
                if (!strId) return;
                
                clientUserId = strId;
                wsClients.set(strId, ws);
                
                if (!clients[strId]) {
                    clients[strId] = {
                        data: { userId, username, ping, ram },
                        lastSeen: Date.now(),
                        connectedAt: Date.now(),
                        terminate: false,
                        commandQueue: [],
                        useWebSocket: true
                    };
                } else {
                    clients[strId].data = { userId, username, ping, ram };
                    clients[strId].lastSeen = Date.now();
                    clients[strId].useWebSocket = true;
                }
                
                const response = {
                    type: 'heartbeat_response',
                    kill: clients[strId].terminate,
                    script: clients[strId].commandQueue.shift() || null,
                    spyEnabled: globalSettings.spyEnabled
                };
                
                if (clients[strId].pendingTrim) {
                    response.trimRAM = true;
                    response.trimTargetMB = clients[strId].pendingTrim.targetMB;
                    delete clients[strId].pendingTrim;
                }
                
                ws.send(JSON.stringify(response));
                
                emitClientUpdate();
            }
            else if (msg.type === 'log') {
                io.emit('newLog', {
                    userId: msg.userId,
                    msg: msg.msg,
                    type: msg.logType || 'info',
                    timestamp: new Date().toLocaleTimeString('en-US', { hour12: false })
                });
            }
            else if (msg.type === 'spy') {
                handleSpyData(msg);
            }
        } catch (e) {
            console.error('WebSocket message error:', e.message);
        }
    });
    
    ws.on('close', () => {
        if (clientUserId) {
            wsClients.delete(clientUserId);
        }
    });
    
    ws.on('error', (err) => {
        console.error('WebSocket error:', err.message);
    });
});

function sendScriptToWsClient(userId, script) {
    const ws = wsClients.get(userId);
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'execute', script }));
        return true;
    }
    return false;
}

function handleSpyData(msg) {
    const { userId, name, className, path: remotePath, method, direction, args, code } = msg;
    const strId = userId?.toString();
    if (!strId) return;
    
    const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false });
    const dir = direction || 'Outgoing';
    
    if (!remoteSpyData[strId]) {
        remoteSpyData[strId] = { Outgoing: {}, Incoming: {} };
    }
    if (!remoteSpyData[strId].Outgoing) remoteSpyData[strId].Outgoing = {};
    if (!remoteSpyData[strId].Incoming) remoteSpyData[strId].Incoming = {};
    
    const remoteCount = Object.keys(remoteSpyData[strId][dir]).length;
    if (remoteCount >= MAX_REMOTES_PER_CLIENT) return;
    
    const remoteKey = remotePath + '_' + dir;
    
    if (!remoteSpyData[strId][dir][remoteKey]) {
        remoteSpyData[strId][dir][remoteKey] = {
            name: name,
            path: remotePath,
            className: className,
            method: method,
            direction: dir,
            calls: []
        };
    }
    
    if (remoteSpyData[strId][dir][remoteKey].calls.length >= MAX_CALLS_PER_REMOTE) {
        remoteSpyData[strId][dir][remoteKey].calls.shift();
    }
    
    const truncatedArgs = (args || []).map(a => {
        if (typeof a === 'string' && a.length > 1000) {
            return a.substring(0, 1000) + '... [truncated]';
        }
        return a;
    });
    
    remoteSpyData[strId][dir][remoteKey].calls.push({
        args: truncatedArgs,
        code: code?.substring(0, 5000) || '',
        timestamp: timestamp
    });
    
    io.emit('spyUpdate', {
        userId: strId,
        direction: dir,
        remote: remoteSpyData[strId][dir][remoteKey]
    });
}

app.use(express.json({ limit: '10mb' }));
app.use(express.static('public'));

const MAX_CALLS_PER_REMOTE = 50;
const MAX_REMOTES_PER_CLIENT = 100;

let lastClientUpdate = 0;
const CLIENT_UPDATE_THROTTLE = 1000;

function emitClientUpdate() {
    const now = Date.now();
    if (now - lastClientUpdate < CLIENT_UPDATE_THROTTLE) return;
    lastClientUpdate = now;
    io.emit('updateClients', getClientList());
}

let clients = {};
let savedAccounts = {};
let accountOrder = []; 
let globalSettings = { disconnectTimeout: 30, spyEnabled: false, startupEnabled: false, scriptPath: '' };
let remoteSpyData = {};
let savedScripts = {};

if (!fs.existsSync('./config')) {
    fs.mkdirSync('./config');
}

if (fs.existsSync('./config/accounts.json')) {
    try { savedAccounts = JSON.parse(fs.readFileSync('./config/accounts.json')); } catch(e) {}
}
if (fs.existsSync('./config/account-order.json')) {
    try { accountOrder = JSON.parse(fs.readFileSync('./config/account-order.json')); } catch(e) {}
}
if (fs.existsSync('./config/settings.json')) {
    try { globalSettings = JSON.parse(fs.readFileSync('./config/settings.json')); } catch(e) {}
}
if (fs.existsSync('./config/scripts.json')) {
    try { savedScripts = JSON.parse(fs.readFileSync('./config/scripts.json')); } catch(e) {}
}

function atomicWrite(filePath, data) {
    const tempPath = filePath + '.tmp';
    try {
        fs.writeFileSync(tempPath, JSON.stringify(data, null, 2));
        fs.renameSync(tempPath, filePath);
    } catch (e) {
        try { fs.unlinkSync(tempPath); } catch {}
        console.error(`Failed to save ${filePath}:`, e.message);
    }
}

function saveConfig() { atomicWrite('./config/accounts.json', savedAccounts); }
function saveSettings() { atomicWrite('./config/settings.json', globalSettings); }
function saveScripts() { atomicWrite('./config/scripts.json', savedScripts); }
function saveAccountOrder() { atomicWrite('./config/account-order.json', accountOrder); }

async function getAuthTicket(cookie) {
    try {
        const headers = { 
            'Cookie': `.ROBLOSECURITY=${cookie}`, 
            'Referer': 'https://www.roblox.com/', 
            'Content-Type': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        };
        
        let res = await fetch("https://auth.roblox.com/v1/authentication-ticket", {
            method: 'POST',
            headers
        });
        
        if (res.status === 403) {
            const csrf = res.headers?.get('x-csrf-token');
            if (csrf) {
                res = await fetch("https://auth.roblox.com/v1/authentication-ticket", {
                    method: 'POST',
                    headers: { ...headers, 'X-CSRF-TOKEN': csrf }
                });
            }
        }
        return res.headers?.get('rbx-authentication-ticket') || null;
    } catch (e) { 
        console.error('Auth ticket error:', e.message);
        return null; 
    }
}

app.get('/avatar/:id', async (req, res) => {
    try {
        const apiRes = await fetch(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${req.params.id}&size=150x150&format=Png&isCircular=true`);
        const data = await apiRes.json();
        if (data.data?.[0]?.imageUrl) return res.redirect(data.data[0].imageUrl);
        throw new Error();
    } catch {
        res.redirect("https://tr.rbxcdn.com/5300d80c057088c9191d9039d997235f/150/150/AvatarHeadshot/Png");
    }
});

app.post('/heartbeat', (req, res) => {
    const { userId, username, ping, ram } = req.body;
    const strId = userId.toString();

    if (!clients[strId]) {
        clients[strId] = {
            data: { userId, username, ping, ram },
            lastSeen: Date.now(),
            connectedAt: Date.now(),
            terminate: false,
            commandQueue: [],
            useWebSocket: false
        };
    } else {
        clients[strId].data = { userId, username, ping, ram };
        clients[strId].lastSeen = Date.now();
    }

    const nextScript = clients[strId].commandQueue.shift();
    emitClientUpdate();
    
    const response = { 
        kill: clients[strId].terminate, 
        script: nextScript,
        spyEnabled: globalSettings.spyEnabled
    };
    
    if (clients[strId].pendingTrim) {
        response.trimRAM = true;
        response.trimTargetMB = clients[strId].pendingTrim.targetMB;
        delete clients[strId].pendingTrim;
    }
    
    res.json(response);
});

app.post('/log', (req, res) => {
    const { userId, msg, type } = req.body;
    io.emit('newLog', { 
        userId, 
        msg, 
        type, 
        timestamp: new Date().toLocaleTimeString('en-US', { hour12: false }) 
    });
    res.sendStatus(200);
});

app.post('/spy', (req, res) => {
    handleSpyData(req.body);
    res.sendStatus(200);
});

app.get('/spy/:userId', (req, res) => {
    const strId = req.params.userId;
    res.json(remoteSpyData[strId] || { Outgoing: {}, Incoming: {} });
});

app.post('/spy/clear/:userId', (req, res) => {
    const strId = req.params.userId;
    remoteSpyData[strId] = { Outgoing: {}, Incoming: {} };
    io.emit('spyCleared', strId);
    res.sendStatus(200);
});

app.post('/execute', (req, res) => {
    const { targets, script } = req.body;
    const targetIds = targets === "all" ? Object.keys(clients) : (Array.isArray(targets) ? targets : []);
    
    targetIds.forEach(id => {
        if (!clients[id]) return;
        
        if (clients[id].useWebSocket && sendScriptToWsClient(id, script)) {
        } else {
            clients[id].commandQueue.push(script);
        }
    });
    
    res.sendStatus(200);
});

app.get('/settings', (req, res) => res.json(globalSettings));
app.post('/settings', (req, res) => { 
    const oldAutoTrimEnabled = globalSettings.autoTrimEnabled;
    const oldInterval = globalSettings.autoTrimIntervalSeconds;
    
    globalSettings = { ...globalSettings, ...req.body }; 
    saveSettings(); 
    io.emit('settingsUpdated', globalSettings);
    
    if (globalSettings.autoTrimEnabled !== oldAutoTrimEnabled || 
        globalSettings.autoTrimIntervalSeconds !== oldInterval) {
        startAutoTrim();
    }
    
    res.sendStatus(200); 
});

app.get('/scripts', (req, res) => res.json(savedScripts));

app.post('/scripts/save', (req, res) => {
    const { id, name, code, category } = req.body;
    if (!name || !code) return res.status(400).json({ error: 'Name and code required' });
    
    const scriptId = id || Date.now().toString();
    savedScripts[scriptId] = { 
        name, 
        code, 
        category: category || 'General',
        createdAt: savedScripts[scriptId]?.createdAt || Date.now(),
        updatedAt: Date.now()
    };
    saveScripts();
    io.emit('scriptsUpdated', savedScripts);
    res.json({ success: true, id: scriptId });
});

app.delete('/scripts/:id', (req, res) => {
    const { id } = req.params;
    if (savedScripts[id]) {
        delete savedScripts[id];
        saveScripts();
        io.emit('scriptsUpdated', savedScripts);
        res.json({ success: true });
    } else {
        res.status(404).json({ error: 'Script not found' });
    }
});

function getStartupFolder() {
    return path.join(process.env.APPDATA, 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup');
}

function getStartupShortcutPath() {
    return path.join(getStartupFolder(), 'ByorlControl.vbs');
}

function isInStartup() {
    return fs.existsSync(getStartupShortcutPath());
}

app.get('/startup/status', (req, res) => {
    res.json({ 
        enabled: isInStartup(),
        scriptPath: globalSettings.scriptPath || ''
    });
});

app.post('/startup/add', (req, res) => {
    const { scriptPath } = req.body;
    
    if (!scriptPath) {
        return res.status(400).json({ error: 'Script path is required' });
    }
    
    const normalizedPath = path.resolve(scriptPath);
    
    if (!fs.existsSync(normalizedPath)) {
        return res.status(400).json({ error: 'Script file does not exist at specified path' });
    }
    
    if (isInStartup()) {
        return res.status(400).json({ error: 'Already added to startup. Remove first before adding again.' });
    }
    
    try {
        const vbsContent = `Set WshShell = CreateObject("WScript.Shell")
WshShell.CurrentDirectory = "${path.dirname(normalizedPath).replace(/\\/g, '\\\\')}"
WshShell.Run "cmd /c node ""${normalizedPath.replace(/\\/g, '\\\\')}""", 0, False`;
        
        fs.writeFileSync(getStartupShortcutPath(), vbsContent);
        
        globalSettings.startupEnabled = true;
        globalSettings.scriptPath = normalizedPath;
        saveSettings();
        
        res.json({ success: true, message: 'Added to startup successfully' });
    } catch (e) {
        res.status(500).json({ error: 'Failed to add to startup: ' + e.message });
    }
});

app.post('/startup/remove', (req, res) => {
    try {
        const shortcutPath = getStartupShortcutPath();
        if (fs.existsSync(shortcutPath)) {
            fs.unlinkSync(shortcutPath);
        }
        
        globalSettings.startupEnabled = false;
        saveSettings();
        
        res.json({ success: true, message: 'Removed from startup' });
    } catch (e) {
        res.status(500).json({ error: 'Failed to remove from startup: ' + e.message });
    }
});

app.get('/export-config', (req, res) => {
    const exportData = {
        version: 1,
        exportedAt: new Date().toISOString(),
        accounts: savedAccounts,
        accountOrder: accountOrder,
        settings: globalSettings,
        scripts: savedScripts
    };
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename=byorl-backup.json');
    res.json(exportData);
});

app.post('/import-config', (req, res) => {
    try {
        const { accounts, accountOrder: order, settings, scripts } = req.body;
        
        if (accounts) {
            Object.assign(savedAccounts, accounts);
            saveConfig();
        }
        if (order && Array.isArray(order)) {
            accountOrder = order;
            saveAccountOrder();
        }
        if (settings) {
            globalSettings = { ...globalSettings, ...settings };
            saveSettings();
        }
        if (scripts) {
            Object.assign(savedScripts, scripts);
            saveScripts();
        }
        
        io.emit('updateConfig', savedAccounts);
        io.emit('settingsUpdated', globalSettings);
        io.emit('scriptsUpdated', savedScripts);
        
        res.json({ success: true, message: 'Config imported successfully' });
    } catch (e) {
        res.status(400).json({ error: 'Failed to import: ' + e.message });
    }
});

app.post('/launch-game', async (req, res) => {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: 'User ID required' });
    
    const acc = savedAccounts[userId];
    if (!acc) return res.status(404).json({ error: 'Account not found' });
    if (!acc.placeId) return res.status(400).json({ error: 'No Place ID configured for this account' });
    
    try {
        await launchRoblox(userId);
        res.json({ success: true, message: 'Game launch initiated' });
    } catch (e) {
        res.status(500).json({ error: 'Failed to launch: ' + e.message });
    }
});

app.post('/trim-ram', (req, res) => {
    const { targetMB } = req.body;
    const target = targetMB || globalSettings.autoTrimTargetMB || 750;
    
    const clientIds = Object.keys(clients);
    
    if (clientIds.length === 0) {
        return res.json({ success: true, clientCount: 0, message: 'No clients connected' });
    }
    
    clientIds.forEach(id => {
        sendTrimCommand(id, target);
    });
    
    res.json({ success: true, clientCount: clientIds.length });
});

function sendTrimCommand(userId, targetMB) {
    const ws = wsClients.get(userId);
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'trim', trimRAM: true, trimTargetMB: targetMB }));
        return true;
    }
    if (clients[userId]) {
        clients[userId].pendingTrim = { targetMB };
    }
    return false;
}

let autoTrimInterval = null;

function startAutoTrim() {
    if (autoTrimInterval) clearInterval(autoTrimInterval);
    
    if (!globalSettings.autoTrimEnabled) {
        console.log('Auto RAM trim disabled');
        return;
    }
    
    const intervalMs = (globalSettings.autoTrimIntervalSeconds || 60) * 1000;
    const targetMB = globalSettings.autoTrimTargetMB || 750;
    
    autoTrimInterval = setInterval(() => {
        if (!globalSettings.autoTrimEnabled) return;
        
        const clientIds = Object.keys(clients);
        if (clientIds.length === 0) return;
        
        clientIds.forEach(id => {
            sendTrimCommand(id, targetMB);
        });
        
        console.log(`Auto RAM trim sent to ${clientIds.length} client(s) (target: ${targetMB}MB)`);
    }, intervalMs);
    
    console.log(`Auto RAM trim enabled (every ${globalSettings.autoTrimIntervalSeconds}s, target: ${globalSettings.autoTrimTargetMB}MB)`);
}

if (globalSettings.autoTrimEnabled) {
    startAutoTrim();
}

function cleanCookie(rawCookie) {
    if (!rawCookie) return null;
    let cookie = rawCookie.trim();
    
    if (cookie.startsWith('.ROBLOSECURITY=')) {
        cookie = cookie.substring('.ROBLOSECURITY='.length);
    }
    if (cookie.startsWith('_|WARNING:-DO-NOT-SHARE-THIS')) {
    }
    
    const semicolonIdx = cookie.indexOf(';');
    if (semicolonIdx !== -1) {
        cookie = cookie.substring(0, semicolonIdx);
    }
    
    return cookie.trim();
}

async function getUserInfoFromCookie(cookie) {
    try {
        const cleanedCookie = cleanCookie(cookie);
        if (!cleanedCookie) return null;
        
        const headers = {
            'Cookie': `.ROBLOSECURITY=${cleanedCookie}`,
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        };
        
        console.log('Fetching user info...');
        const res = await fetch('https://users.roblox.com/v1/users/authenticated', { headers });
        console.log('Response status:', res.status);
        
        if (!res.ok) {
            console.log('Failed to authenticate, status:', res.status);
            return null;
        }
        
        const data = await res.json();
        console.log('User data:', data);
        
        if (!data.id || !data.name) {
            console.log('Missing id or name in response');
            return null;
        }
        
        return { userId: data.id.toString(), username: data.name, cleanedCookie };
    } catch (e) {
        console.error('Failed to get user info:', e.message);
        return null;
    }
}

const pending2FA = {};

async function loginWithCredentials(username, password) {
    const headers = {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://www.roblox.com/'
    };
    
    try {
        let csrfRes = await fetch('https://auth.roblox.com/v2/login', {
            method: 'POST',
            headers,
            body: JSON.stringify({})
        });
        
        const csrf = csrfRes.headers.get('x-csrf-token');
        if (csrf) headers['X-CSRF-TOKEN'] = csrf;
        
        const loginRes = await fetch('https://auth.roblox.com/v2/login', {
            method: 'POST',
            headers,
            body: JSON.stringify({
                ctype: 'Username',
                cvalue: username,
                password: password
            })
        });
        
        const data = await loginRes.json();
        
        if (loginRes.status === 403 && data.errors) {
            const challengeError = data.errors.find(e => 
                e.message?.includes('Challenge') || 
                e.message?.includes('captcha') ||
                e.code === 2
            );
            
            if (challengeError) {
                return { 
                    error: 'Roblox requires captcha verification. Please use the Cookie method instead - login via browser and copy your .ROBLOSECURITY cookie.' 
                };
            }
            
            const twoStepError = data.errors.find(e => e.code === 0 && e.message?.includes('TwoStepVerification'));
            if (twoStepError || data.errors.some(e => e.code === 4)) {
                const challengeId = loginRes.headers.get('rblx-challenge-id');
                const challengeType = loginRes.headers.get('rblx-challenge-type');
                const challengeMetadata = loginRes.headers.get('rblx-challenge-metadata');
                
                let metadata = {};
                if (challengeMetadata) {
                    try { metadata = JSON.parse(Buffer.from(challengeMetadata, 'base64').toString()); } catch(e) {}
                }
                
                return { 
                    requires2FA: true, 
                    challengeId,
                    challengeType,
                    userId: metadata.userId,
                    username
                };
            }
        }
        
        if (!loginRes.ok) {
            let errorMsg = data.errors?.[0]?.message || 'Login failed';
            
            if (errorMsg.includes('Challenge')) {
                errorMsg = 'Roblox requires captcha verification. Please use the Cookie method instead.';
            }
            
            return { error: errorMsg };
        }
        
        const cookies = loginRes.headers.raw()['set-cookie'] || [];
        let roblosecurity = null;
        
        for (const cookie of cookies) {
            if (cookie.includes('.ROBLOSECURITY=')) {
                const match = cookie.match(/\.ROBLOSECURITY=([^;]+)/);
                if (match) roblosecurity = match[1];
            }
        }
        
        if (!roblosecurity) {
            return { error: 'Login succeeded but no cookie received' };
        }
        
        return { 
            success: true, 
            cookie: roblosecurity,
            userId: data.user?.id?.toString(),
            username: data.user?.name || username
        };
        
    } catch (e) {
        console.error('Login error:', e.message);
        return { error: 'Login request failed: ' + e.message };
    }
}

async function verify2FA(username, password, code, challengeId) {
    const headers = {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://www.roblox.com/'
    };
    
    try {
        let csrfRes = await fetch('https://auth.roblox.com/v2/login', {
            method: 'POST',
            headers,
            body: JSON.stringify({})
        });
        const csrf = csrfRes.headers.get('x-csrf-token');
        if (csrf) headers['X-CSRF-TOKEN'] = csrf;
        
        const verifyRes = await fetch('https://twostepverification.roblox.com/v1/users/' + challengeId + '/challenges/authenticator/verify', {
            method: 'POST',
            headers,
            body: JSON.stringify({ code, challengeId })
        });
        
        if (!verifyRes.ok) {
            const data = await verifyRes.json();
            return { error: data.errors?.[0]?.message || 'Invalid 2FA code' };
        }
        
        const verifyData = await verifyRes.json();
        
        headers['rblx-challenge-id'] = challengeId;
        headers['rblx-challenge-type'] = 'twostepverification';
        headers['rblx-challenge-metadata'] = Buffer.from(JSON.stringify({
            verificationToken: verifyData.verificationToken,
            rememberDevice: false,
            challengeId: challengeId
        })).toString('base64');
        
        const loginRes = await fetch('https://auth.roblox.com/v2/login', {
            method: 'POST',
            headers,
            body: JSON.stringify({
                ctype: 'Username',
                cvalue: username,
                password: password
            })
        });
        
        if (!loginRes.ok) {
            const data = await loginRes.json();
            return { error: data.errors?.[0]?.message || '2FA verification failed' };
        }
        
        const cookies = loginRes.headers.raw()['set-cookie'] || [];
        let roblosecurity = null;
        
        for (const cookie of cookies) {
            if (cookie.includes('.ROBLOSECURITY=')) {
                const match = cookie.match(/\.ROBLOSECURITY=([^;]+)/);
                if (match) roblosecurity = match[1];
            }
        }
        
        if (!roblosecurity) {
            return { error: '2FA succeeded but no cookie received' };
        }
        
        const data = await loginRes.json();
        return { 
            success: true, 
            cookie: roblosecurity,
            userId: data.user?.id?.toString(),
            username: data.user?.name || username
        };
        
    } catch (e) {
        console.error('2FA error:', e.message);
        return { error: '2FA verification failed: ' + e.message };
    }
}

app.post('/add-account', async (req, res) => {
    const { cookie } = req.body;
    
    if (!cookie) {
        return res.status(400).json({ error: 'Cookie is required' });
    }
    
    const userInfo = await getUserInfoFromCookie(cookie);
    if (!userInfo) {
        return res.status(400).json({ error: 'Invalid cookie - make sure you copied the full .ROBLOSECURITY value' });
    }
    
    const { userId, username, cleanedCookie } = userInfo;
    
    if (savedAccounts[userId]) {
        savedAccounts[userId].cookie = cleanedCookie;
        savedAccounts[userId].username = username;
    } else {
        savedAccounts[userId] = { username, placeId: "", jobId: "", cookie: cleanedCookie, autoRelaunch: false };
    }
    
    saveConfig();
    io.emit('updateConfig', savedAccounts);
    res.json({ success: true, userId, username });
});
app.post('/add-account-credentials', async (req, res) => {
    const { username, password } = req.body;
    
    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password required' });
    }
    
    const result = await loginWithCredentials(username, password);
    
    if (result.error) {
        return res.status(400).json({ error: result.error });
    }
    
    if (result.requires2FA) {
        const sessionId = Date.now().toString();
        pending2FA[sessionId] = { username, password, challengeId: result.userId };
        
        setTimeout(() => delete pending2FA[sessionId], 300000);
        
        return res.json({ 
            requires2FA: true, 
            sessionId,
            message: 'Enter your 2FA code from your authenticator app'
        });
    }
    
    const { userId, cookie } = result;
    
    if (savedAccounts[userId]) {
        savedAccounts[userId].cookie = cookie;
        savedAccounts[userId].username = result.username;
    } else {
        savedAccounts[userId] = { username: result.username, placeId: "", jobId: "", cookie, autoRelaunch: false };
    }
    
    saveConfig();
    io.emit('updateConfig', savedAccounts);
    res.json({ success: true, userId, username: result.username });
});

app.post('/verify-2fa', async (req, res) => {
    const { sessionId, code } = req.body;
    
    if (!sessionId || !code) {
        return res.status(400).json({ error: 'Session ID and code required' });
    }
    
    const session = pending2FA[sessionId];
    if (!session) {
        return res.status(400).json({ error: '2FA session expired. Please try logging in again.' });
    }
    
    const result = await verify2FA(session.username, session.password, code, session.challengeId);
    delete pending2FA[sessionId];
    
    if (result.error) {
        return res.status(400).json({ error: result.error });
    }
    
    const { userId, username, cookie } = result;
    
    if (savedAccounts[userId]) {
        savedAccounts[userId].cookie = cookie;
        savedAccounts[userId].username = username;
    } else {
        savedAccounts[userId] = { username, placeId: "", jobId: "", cookie, autoRelaunch: false };
    }
    
    saveConfig();
    io.emit('updateConfig', savedAccounts);
    res.json({ success: true, userId, username });
});

app.post('/update-account', (req, res) => { 
    if (savedAccounts[req.body.userId]) { 
        savedAccounts[req.body.userId] = { ...savedAccounts[req.body.userId], ...req.body.config }; 
        saveConfig(); 
    } 
    res.sendStatus(200); 
});

app.delete('/delete-account/:userId', (req, res) => {
    const { userId } = req.params;
    if (savedAccounts[userId]) {
        delete savedAccounts[userId];
        saveConfig();
        io.emit('updateConfig', savedAccounts);
        res.json({ success: true });
    } else {
        res.status(404).json({ error: 'Account not found' });
    }
});

app.post('/terminate', (req, res) => { 
    if (clients[req.body.userId]) clients[req.body.userId].terminate = true; 
    res.sendStatus(200); 
});

app.get('/account-health/:userId', async (req, res) => {
    const { userId } = req.params;
    const acc = savedAccounts[userId];
    if (!acc || !acc.cookie) {
        return res.json({ valid: false, error: 'No cookie' });
    }
    
    try {
        const cleanedCookie = cleanCookie(acc.cookie);
        const headers = {
            'Cookie': `.ROBLOSECURITY=${cleanedCookie}`,
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        };
        
        const [authRes, userProfileRes, currencyRes] = await Promise.all([
            fetch('https://users.roblox.com/v1/users/authenticated', { headers }),
            fetch(`https://users.roblox.com/v1/users/${userId}`, { headers }),
            fetch(`https://economy.roblox.com/v1/users/${userId}/currency`, { headers })
        ]);
        
        if (!authRes.ok) {
            return res.json({ valid: false, error: 'Cookie expired or invalid' });
        }
        
        const authData = await authRes.json();
        let robux = 0;
        if (currencyRes.ok) {
            const currencyData = await currencyRes.json();
            robux = currencyData.robux || 0;
        }
        
        let accountAge = null;
        let created = null;
        let isBanned = false;
        if (userProfileRes.ok) {
            const profileData = await userProfileRes.json();
            created = profileData.created;
            isBanned = profileData.isBanned || false;
            if (profileData.created) {
                const createdDate = new Date(profileData.created);
                accountAge = Math.floor((Date.now() - createdDate.getTime()) / (1000 * 60 * 60 * 24));
            }
        }
        
        res.json({
            valid: true,
            username: authData.name,
            displayName: authData.displayName,
            robux: robux,
            accountAgeDays: accountAge,
            created: created,
            isBanned: isBanned
        });
    } catch (e) {
        res.json({ valid: false, error: e.message });
    }
});

app.post('/check-all-cookies', async (req, res) => {
    const results = {};
    const userIds = Object.keys(savedAccounts);
    
    for (const userId of userIds) {
        const acc = savedAccounts[userId];
        if (!acc.cookie) {
            results[userId] = { valid: false, error: 'No cookie' };
            continue;
        }
        
        try {
            const cleanedCookie = cleanCookie(acc.cookie);
            const headers = {
                'Cookie': `.ROBLOSECURITY=${cleanedCookie}`,
                'User-Agent': 'Mozilla/5.0'
            };
            const userRes = await fetch('https://users.roblox.com/v1/users/authenticated', { headers });
            results[userId] = { valid: userRes.ok };
            if (!userRes.ok) results[userId].error = 'Cookie expired';
        } catch (e) {
            results[userId] = { valid: false, error: e.message };
        }
    }
    
    res.json(results);
});

app.get('/get-config', (req, res) => {
    accountOrder = accountOrder.filter(id => savedAccounts[id]);
    Object.keys(savedAccounts).forEach(id => {
        if (!accountOrder.includes(id)) accountOrder.push(id);
    });
    res.json({ accounts: savedAccounts, order: accountOrder });
});

app.post('/save-order', (req, res) => {
    const { order } = req.body;
    if (Array.isArray(order)) {
        accountOrder = order;
        saveAccountOrder();
        res.json({ success: true });
    } else {
        res.status(400).json({ error: 'Invalid order' });
    }
});

function getClientList() {
    return Object.values(clients).map(c => {
        const timeSince = Date.now() - c.lastSeen;
        const isLagging = timeSince > 10000;
        const uptime = c.connectedAt ? Date.now() - c.connectedAt : 0;
        return { 
            ...c.data, 
            status: isLagging ? 'unstable' : 'good',
            uptime: uptime,
            connectionType: c.useWebSocket ? 'websocket' : 'http'
        };
    });
}

async function launchRoblox(userId) {
    const acc = savedAccounts[userId];
    if (!acc || !acc.placeId) return;
    
    if (acc.cookie) {
        const ticket = await getAuthTicket(acc.cookie);
        if (ticket) {
            const time = Date.now();
            const browserId = Math.floor(Math.random() * 100000000000);
            
            let placeLauncherParams = `request=RequestGame&browserTrackerId=${browserId}&placeId=${acc.placeId}&isPlayTogetherGame=false`;
            if (acc.jobId && !acc.jobId.includes("http")) {
                placeLauncherParams += `&gameInstanceId=${acc.jobId}`;
            }
            
            const encodedPlaceLauncher = encodeURIComponent(`https://assetgame.roblox.com/game/PlaceLauncher.ashx?${placeLauncherParams}`);
            const launchUrl = `roblox-player:1+launchmode:play+gameinfo:${ticket}+launchtime:${time}+placelauncherurl:${encodedPlaceLauncher}`;
            
            exec(`start "" "${launchUrl}"`, (err) => {
                if (err) console.log(`Launch error for ${userId}:`, err.message);
            });
            console.log(`Launching Roblox for ${acc.username} (${userId}) with auth ticket`);
            return;
        } else {
            console.log(`Failed to get auth ticket for ${acc.username} (${userId}) - cookie may be invalid`);
        }
    }
    
    console.log(`Warning: No cookie for ${acc.username} (${userId}) - launching with browser account`);
    let launchUrl = `roblox://experiences/start?placeId=${acc.placeId}`;
    if (acc.jobId) {
        if (acc.jobId.includes("http")) launchUrl = acc.jobId;
        else launchUrl += `&gameInstanceId=${acc.jobId}`;
    }
    exec(`start "" "${launchUrl}"`);
}

setInterval(() => {
    const now = Date.now();
    let changed = false;
    for (const id in clients) {
        const timeSince = now - clients[id].lastSeen;
        const timeout = Math.max((globalSettings.disconnectTimeout || 30), 20) * 1000;
        if (timeSince > timeout) {
            console.log(`Client ${clients[id].data?.username || id} disconnected (no heartbeat for ${Math.round(timeSince/1000)}s)`);
            if (!clients[id].terminate && savedAccounts[id] && savedAccounts[id].autoRelaunch) {
                launchRoblox(id);
            }
            delete clients[id];
            delete remoteSpyData[id];
            changed = true;
        } else if (timeSince > 10000) changed = true;
    }
    if (changed) emitClientUpdate();
}, 2000);

server.listen(5000, () => { console.log(`BYORL CONTROL running on http://localhost:5000`); });
