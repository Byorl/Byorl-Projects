local SERVER_URL = "http://localhost:5000"
local WS_URL = "ws://localhost:5001"
local POLLING_RATE = 2 
local HEARTBEAT_RATE = 3 

local HttpService = game:GetService("HttpService")
local Players = game:GetService("Players")
local Stats = game:GetService("Stats")
local LogService = game:GetService("LogService")
local RunService = game:GetService("RunService")

local LocalPlayer = Players.LocalPlayer
if not LocalPlayer then
    LocalPlayer = Players:GetPropertyChangedSignal("LocalPlayer"):Wait()
    LocalPlayer = Players.LocalPlayer
end
if not LocalPlayer then
    LocalPlayer = Players.PlayerAdded:Wait()
end

local request = (syn and syn.request) or (http and http.request) or http_request or (fluxus and fluxus.request) or request
if not request then return warn("Executor not supported.") end

local WebSocket = WebSocket or (syn and syn.websocket) or (fluxus and fluxus.websocket)
local useWebSocket = WebSocket ~= nil
local wsConnection = nil
local wsConnected = false

local SPY_ENABLED = false
local hook_initialized = false

local function getPath(obj)
    if not obj then return "nil" end
    if obj == game then return "game" end
    if obj == workspace then return "workspace" end
    
    local parts = {}
    local current = obj
    
    while current and current.Parent do
        local name = current.Name
        local parent = current.Parent
        
        local isService = false
        pcall(function()
            if parent == game and game:GetService(current.ClassName) == current then
                table.insert(parts, 1, string.format('game:GetService("%s")', current.ClassName))
                isService = true
            end
        end)
        
        if isService then
            break
        end
        
        if name:match("^[%a_][%w_]*$") then
            table.insert(parts, 1, "." .. name)
        else
            table.insert(parts, 1, '["' .. name:gsub('"', '\\"') .. '"]')
        end
        
        current = parent
        
        if current == game then
            table.insert(parts, 1, "game")
            break
        elseif current == workspace then
            table.insert(parts, 1, "workspace")
            break
        end
    end
    
    if #parts == 0 then
        return "nil --[[" .. (obj.Name or "Unknown") .. "]]"
    end
    
    local result = table.concat(parts, "")
    result = result:gsub('GetService%("([^"]+)"%)(%.)', 'GetService("%1").')
    if result:sub(1, 1) == "." then
        result = result:sub(2)
    end
    
    return result
end

local function serialize(val, indent)
    indent = indent or "    "
    local t = typeof(val)

    if t == "string" then
        return '"' .. val:gsub('"', '\\"'):gsub("\n", "\\n") .. '"'
    elseif t == "number" or t == "boolean" then
        return tostring(val)
    elseif t == "nil" then
        return "nil"
    elseif t == "Instance" then
        return getPath(val)
    elseif t == "Vector3" then
        return string.format("Vector3.new(%s, %s, %s)", val.X, val.Y, val.Z)
    elseif t == "Vector2" then
        return string.format("Vector2.new(%s, %s)", val.X, val.Y)
    elseif t == "CFrame" then
        return string.format("CFrame.new(%s)", tostring(val))
    elseif t == "Color3" then
        return string.format("Color3.new(%s, %s, %s)", val.R, val.G, val.B)
    elseif t == "UDim2" then
        return string.format("UDim2.new(%s, %s, %s, %s)", val.X.Scale, val.X.Offset, val.Y.Scale, val.Y.Offset)
    elseif t == "table" then
        local result = "{\n"
        for k, v in pairs(val) do
            local keyStr = tostring(k)
            if type(k) == "string" and k:match("^[%a_][%w_]*$") then
            else
                keyStr = "[" .. serialize(k) .. "]"
            end
            result = result .. indent .. keyStr .. " = " .. serialize(v, indent .. "    ") .. ",\n"
        end
        return result .. indent:sub(1, -5) .. "}"
    end
    
    return tostring(val)
end

local function packRemoteData(remote, method, args, direction)
    local serializedArgs = {}
    local rawArgs = {}
    
    for i, v in ipairs(args) do
        table.insert(serializedArgs, serialize(v))
        table.insert(rawArgs, tostring(v))
    end
    
    local remotePath = getPath(remote)
    local scriptBody = ""
    
    if remotePath:find("game:GetService") then
        local service = remotePath:match('game:GetService%("([^"]+)"%)')
        local rest = remotePath:gsub('game:GetService%("[^"]+"%)', "")
        scriptBody = string.format('local Remote = game:GetService("%s")%s', service, rest)
    else
        scriptBody = string.format('local Remote = %s', remotePath)
    end
    
    local argsString = table.concat(serializedArgs, ",\n    ")
    if #serializedArgs > 0 then
        scriptBody = scriptBody .. string.format('\n\nRemote:%s(\n    %s\n)', method, argsString)
    else
        scriptBody = scriptBody .. string.format('\n\nRemote:%s()', method)
    end

    spawn(function()
        local data = {
            type = "spy",
            userId = LocalPlayer.UserId,
            name = remote.Name,
            className = remote.ClassName,
            path = remotePath,
            method = method,
            direction = direction,
            args = rawArgs,
            code = scriptBody
        }
        
        if wsConnected and wsSend and wsSend(data) then
            return
        end
        
        pcall(request, {
            Url = SERVER_URL .. "/spy",
            Method = "POST",
            Headers = { ["Content-Type"] = "application/json" },
            Body = HttpService:JSONEncode(data)
        })
    end)
end

local hookedRemotes = {}
local hookedIncoming = {}

local function hookIncomingRemote(remote)
    if hookedIncoming[remote] then return end
    hookedIncoming[remote] = true
    
    if remote:IsA("RemoteEvent") or remote:IsA("UnreliableRemoteEvent") then
        remote.OnClientEvent:Connect(function(...)
            if SPY_ENABLED then
                local args = {...}
                task.spawn(pcall, packRemoteData, remote, "OnClientEvent", args, "Incoming")
            end
        end)
    end
end

local function hookAllIncoming()
    for _, v in pairs(game:GetDescendants()) do
        if v:IsA("RemoteEvent") or v:IsA("RemoteFunction") or v:IsA("UnreliableRemoteEvent") then
            task.spawn(hookIncomingRemote, v)
        end
    end
    
    game.DescendantAdded:Connect(function(v)
        if v:IsA("RemoteEvent") or v:IsA("RemoteFunction") or v:IsA("UnreliableRemoteEvent") then
            task.spawn(hookIncomingRemote, v)
        end
    end)
    
    print(":: BYORL :: Remote Spy Hooked (Incoming)")
end

local function enableSpy()
    if hook_initialized then return end
    hook_initialized = true
    
    local mt = getrawmetatable(game)
    if setreadonly then setreadonly(mt, false) end
    
    local oldNamecall = mt.__namecall
    mt.__namecall = newcclosure(function(self, ...)
        local method = getnamecallmethod()
        local args = {...}

        if SPY_ENABLED and (method == "FireServer" or method == "InvokeServer") then
            if typeof(self) == "Instance" then
                if self.ClassName == "RemoteEvent" or self.ClassName == "RemoteFunction" or self.ClassName == "UnreliableRemoteEvent" then
                    task.spawn(pcall, packRemoteData, self, method, args, "Outgoing")
                end
            end
        end

        return oldNamecall(self, ...)
    end)
    
    local oldFireServer, oldInvokeServer
    
    pcall(function()
        oldFireServer = hookfunction(Instance.new("RemoteEvent").FireServer, newcclosure(function(self, ...)
            if SPY_ENABLED and typeof(self) == "Instance" then
                if self.ClassName == "RemoteEvent" or self.ClassName == "UnreliableRemoteEvent" then
                    local args = {...}
                    task.spawn(pcall, packRemoteData, self, "FireServer", args, "Outgoing")
                end
            end
            return oldFireServer(self, ...)
        end))
    end)
    
    pcall(function()
        oldInvokeServer = hookfunction(Instance.new("RemoteFunction").InvokeServer, newcclosure(function(self, ...)
            if SPY_ENABLED and typeof(self) == "Instance" and self.ClassName == "RemoteFunction" then
                local args = {...}
                task.spawn(pcall, packRemoteData, self, "InvokeServer", args, "Outgoing")
            end
            return oldInvokeServer(self, ...)
        end))
    end)

    if setreadonly then setreadonly(mt, true) end
    print(":: BYORL :: Remote Spy Hooked (Outgoing)")
    
    task.spawn(hookAllIncoming)
end

local wsSend = nil

local function sendLog(msg, logType)
    local data = {
        type = "log",
        userId = LocalPlayer.UserId,
        msg = msg,
        logType = logType
    }
    
    if wsConnected and wsSend and wsSend(data) then
        return
    end
    
    pcall(request, {
        Url = SERVER_URL .. "/log",
        Method = "POST",
        Headers = { ["Content-Type"] = "application/json" },
        Body = HttpService:JSONEncode({
            userId = LocalPlayer.UserId,
            msg = msg,
            type = logType
        })
    })
end

LogService.MessageOut:Connect(function(msg, msgType)
    local typeStr = "info"
    if msgType == Enum.MessageType.MessageWarning then typeStr = "warn" end
    if msgType == Enum.MessageType.MessageError then typeStr = "error" end
    spawn(function() sendLog(msg, typeStr) end)
end)

local function getStats()
    local ping = 0
    local ram = 0
    pcall(function() ping = Stats.Network.ServerStatsItem["Data Ping"]:GetValue() / 1000 end)
    pcall(function() ram = Stats:GetTotalMemoryUsageMb() end)
    return ping, ram
end

local function trimRAM(targetMB)
    local currentRAM = 0
    pcall(function() currentRAM = Stats:GetTotalMemoryUsageMb() end)
    
    if currentRAM <= targetMB then
        print(":: BYORL :: RAM OK: " .. math.floor(currentRAM) .. "MB (Target: " .. targetMB .. "MB)")
        return
    end
    
    pcall(function()
        game:GetService("ContentProvider"):PreloadAsync({})
    end)
    
    pcall(function()
        for i = 1, 5 do
            collectgarbage("collect")
            task.wait(0.1)
        end
    end)
    
    pcall(function()
        local soundService = game:GetService("SoundService")
        for _, sound in pairs(soundService:GetDescendants()) do
            if sound:IsA("Sound") and not sound.IsPlaying then
                sound:Stop()
            end
        end
    end)
    
    pcall(function()
        settings().Rendering.QualityLevel = 1
    end)
    
    pcall(function()
        collectgarbage("collect")
        collectgarbage("collect")
    end)
    
    local newRAM = 0
    pcall(function() newRAM = Stats:GetTotalMemoryUsageMb() end)
    print(":: BYORL :: RAM Trimmed: " .. math.floor(currentRAM) .. "MB -> " .. math.floor(newRAM) .. "MB")
end

local function handleCommand(data)
    pcall(function()
        if data.spyEnabled ~= nil then
            SPY_ENABLED = data.spyEnabled
            if SPY_ENABLED then enableSpy() end
        end
        
        if data.kill then game:Shutdown() end
        
        if data.trimRAM then
            local targetMB = data.trimTargetMB or 750
            trimRAM(targetMB)
        end
        
        if data.script then
            local func = loadstring(data.script)
            if func then spawn(func) end
        end
    end)
end

local function connectWebSocket()
    if not useWebSocket then return false end
    
    local success = pcall(function()
        wsConnection = WebSocket.connect(WS_URL)
        
        wsConnection.OnMessage:Connect(function(message)
            local data = HttpService:JSONDecode(message)
            
            if data.type == "heartbeat_response" then
                handleCommand(data)
            elseif data.type == "execute" then
                if data.script then
                    local func = loadstring(data.script)
                    if func then spawn(func) end
                end
            elseif data.type == "trim" then
                if data.trimRAM then
                    local targetMB = data.trimTargetMB or 750
                    trimRAM(targetMB)
                end
            end
        end)
        
        wsConnection.OnClose:Connect(function()
            wsConnected = false
            warn(":: BYORL :: WebSocket disconnected, falling back to HTTP")
        end)
        
        wsConnected = true
        print(":: BYORL :: WebSocket connected!")
    end)
    
    return success and wsConnected
end

wsSend = function(data)
    if wsConnected and wsConnection then
        local success = pcall(function()
            wsConnection:Send(HttpService:JSONEncode(data))
        end)
        return success
    end
    return false
end

local function httpHeartbeat()
    local ping, ram = getStats()
    
    local success, response = pcall(function()
        return request({
            Url = SERVER_URL .. "/heartbeat",
            Method = "POST",
            Headers = { ["Content-Type"] = "application/json" },
            Body = HttpService:JSONEncode({
                userId = LocalPlayer.UserId,
                username = LocalPlayer.Name,
                ping = ping,
                ram = ram
            })
        })
    end)
    
    if success and response and response.Body then
        pcall(function()
            handleCommand(HttpService:JSONDecode(response.Body))
        end)
        return true
    end
    return false
end

local function wsHeartbeat()
    local ping, ram = getStats()
    return wsSend({
        type = "heartbeat",
        userId = LocalPlayer.UserId,
        username = LocalPlayer.Name,
        ping = ping,
        ram = ram
    })
end

if useWebSocket then
    spawn(function()
        connectWebSocket()
    end)
    task.wait(1) 
end

spawn(function()
    while true do
        if wsConnected then
            if not wsHeartbeat() then
                wsConnected = false
            end
            task.wait(HEARTBEAT_RATE)
        else
            if useWebSocket and not wsConnected then
                spawn(connectWebSocket)
            end
            
            local success = false
            for attempt = 1, 3 do
                if httpHeartbeat() then
                    success = true
                    break
                end
                task.wait(0.5)
            end
            
            task.wait(POLLING_RATE)
        end
    end
end)

print(":: BYORL CONTROL CONNECTED ::" .. (useWebSocket and " (WebSocket available)" or " (HTTP only)"))
