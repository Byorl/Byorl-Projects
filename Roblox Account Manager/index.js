const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const fs = require('fs');
const { exec } = require('child_process');
const fetch = require('node-fetch');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.json());
app.use(express.static('public'));

let clients = {};
let savedAccounts = {};
let globalSettings = { disconnectTimeout: 15, spyEnabled: false };
let remoteSpyData = {};

if (fs.existsSync('./accounts.json')) {
    try { savedAccounts = JSON.parse(fs.readFileSync('./accounts.json')); } catch(e) {}
}
if (fs.existsSync('./settings.json')) {
    try { globalSettings = JSON.parse(fs.readFileSync('./settings.json')); } catch(e) {}
}

function saveConfig() { fs.writeFileSync('./accounts.json', JSON.stringify(savedAccounts, null, 2)); }
function saveSettings() { fs.writeFileSync('./settings.json', JSON.stringify(globalSettings, null, 2)); }

async function getAuthTicket(cookie) {
    try {
        let res = await fetch("https://auth.roblox.com/v1/authentication-ticket", {
            method: 'POST',
            headers: { 'Cookie': `.ROBLOSECURITY=${cookie}`, 'Referer': 'https://www.roblox.com/', 'Content-Type': 'application/json' }
        });
        if (res.status === 403) {
            const csrf = res.headers.get('x-csrf-token');
            if (csrf) {
                res = await fetch("https://auth.roblox.com/v1/authentication-ticket", {
                    method: 'POST',
                    headers: { 'Cookie': `.ROBLOSECURITY=${cookie}`, 'Referer': 'https://www.roblox.com/', 'Content-Type': 'application/json', 'X-CSRF-TOKEN': csrf }
                });
            }
        }
        return res.headers.get('rbx-authentication-ticket');
    } catch (e) { return null; }
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
            terminate: false,
            commandQueue: []
        };
    } else {
        clients[strId].data = { userId, username, ping, ram };
        clients[strId].lastSeen = Date.now();
    }

    const nextScript = clients[strId].commandQueue.shift();
    io.emit('updateClients', getClientList());
    res.json({ 
        kill: clients[strId].terminate, 
        script: nextScript,
        spyEnabled: globalSettings.spyEnabled
    });
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
    const { userId, name, className, path, method, direction, args, code } = req.body;
    const strId = userId.toString();
    const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false });
    const dir = direction || 'Outgoing';
    
    if (!remoteSpyData[strId]) {
        remoteSpyData[strId] = { Outgoing: {}, Incoming: {} };
    }
    if (!remoteSpyData[strId].Outgoing) remoteSpyData[strId].Outgoing = {};
    if (!remoteSpyData[strId].Incoming) remoteSpyData[strId].Incoming = {};
    
    const remoteKey = path + '_' + dir;
    
    if (!remoteSpyData[strId][dir][remoteKey]) {
        remoteSpyData[strId][dir][remoteKey] = {
            name: name,
            path: path,
            className: className,
            method: method,
            direction: dir,
            calls: []
        };
    }
    
    remoteSpyData[strId][dir][remoteKey].calls.push({
        args: args,
        code: code,
        timestamp: timestamp
    });
    
    io.emit('spyUpdate', {
        userId: strId,
        direction: dir,
        remote: remoteSpyData[strId][dir][remoteKey]
    });
    
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
    if (targets === "all") {
        Object.keys(clients).forEach(id => clients[id].commandQueue.push(script));
    } else if (Array.isArray(targets)) {
        targets.forEach(id => { if(clients[id]) clients[id].commandQueue.push(script); });
    }
    res.sendStatus(200);
});

app.get('/settings', (req, res) => res.json(globalSettings));
app.post('/settings', (req, res) => { 
    globalSettings = { ...globalSettings, ...req.body }; 
    saveSettings(); 
    io.emit('settingsUpdated', globalSettings);
    res.sendStatus(200); 
});

app.post('/add-account', (req, res) => {
    const { userId, username } = req.body;
    if (!savedAccounts[userId]) { 
        savedAccounts[userId] = { username, placeId: "", jobId: "", cookie: "", autoRelaunch: false }; 
        saveConfig(); 
        io.emit('updateConfig', savedAccounts); 
    }
    res.sendStatus(200);
});

app.post('/update-account', (req, res) => { 
    if (savedAccounts[req.body.userId]) { 
        savedAccounts[req.body.userId] = { ...savedAccounts[req.body.userId], ...req.body.config }; 
        saveConfig(); 
    } 
    res.sendStatus(200); 
});

app.post('/terminate', (req, res) => { 
    if (clients[req.body.userId]) clients[req.body.userId].terminate = true; 
    res.sendStatus(200); 
});

app.get('/get-config', (req, res) => res.json(savedAccounts));

function getClientList() {
    return Object.values(clients).map(c => {
        const isLagging = (Date.now() - c.lastSeen) > 2000;
        return { ...c.data, status: isLagging ? 'unstable' : 'good' };
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
        const timeout = (globalSettings.disconnectTimeout || 15) * 1000;
        if (timeSince > timeout) {
            if (!clients[id].terminate && savedAccounts[id] && savedAccounts[id].autoRelaunch) {
                launchRoblox(id);
            }
            delete clients[id];
            changed = true;
        } else if (timeSince > 2000) changed = true;
    }
    if (changed) io.emit('updateClients', getClientList());
}, 1000);

server.listen(5000, () => { console.log(`BYORL CONTROL running on http://localhost:5000`); });
