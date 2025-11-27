local SERVER_URL = "http://localhost:5000"
local POLLING_RATE = 1

local HttpService = game:GetService("HttpService")
local Players = game:GetService("Players")
local Stats = game:GetService("Stats")
local LogService = game:GetService("LogService")
local RunService = game:GetService("RunService")
local LocalPlayer = Players.LocalPlayer

local request = (syn and syn.request) or (http and http.request) or http_request or (fluxus and fluxus.request) or request
if not request then return warn("Executor not supported.") end

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
        request({
            Url = SERVER_URL .. "/spy",
            Method = "POST",
            Headers = { ["Content-Type"] = "application/json" },
            Body = HttpService:JSONEncode({
                userId = LocalPlayer.UserId,
                name = remote.Name,
                className = remote.ClassName,
                path = remotePath,
                method = method,
                direction = direction,
                args = rawArgs,
                code = scriptBody
            })
        })
    end)
end

local hookedRemotes = {}

local function enableSpy()
    if hook_initialized then return end
    hook_initialized = true
    
    local mt = getrawmetatable(game)
    local oldNamecall = mt.__namecall
    if setreadonly then setreadonly(mt, false) end

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

    if setreadonly then setreadonly(mt, true) end
    print(":: BYORL :: Remote Spy Hooked (Outgoing)")
end

LogService.MessageOut:Connect(function(msg, type)
    local typeStr = "info"
    if type == Enum.MessageType.MessageWarning then typeStr = "warn" end
    if type == Enum.MessageType.MessageError then typeStr = "error" end
    
    spawn(function()
        pcall(request, {
            Url = SERVER_URL .. "/log",
            Method = "POST",
            Headers = { ["Content-Type"] = "application/json" },
            Body = HttpService:JSONEncode({
                userId = LocalPlayer.UserId,
                msg = msg,
                type = typeStr
            })
        })
    end)
end)

spawn(function()
    while true do
        task.wait(POLLING_RATE)
        pcall(function()
            local ping = Stats.Network.ServerStatsItem["Data Ping"]:GetValue() / 1000
            local ram = Stats:GetTotalMemoryUsageMb()
            
            local payload = {
                userId = LocalPlayer.UserId,
                username = LocalPlayer.Name,
                ping = ping,
                ram = ram
            }
            
            local response = request({
                Url = SERVER_URL .. "/heartbeat",
                Method = "POST",
                Headers = { ["Content-Type"] = "application/json" },
                Body = HttpService:JSONEncode(payload)
            })
            
            if response and response.Body then
                local data = HttpService:JSONDecode(response.Body)
                
                if data.spyEnabled ~= nil then
                    SPY_ENABLED = data.spyEnabled
                    if SPY_ENABLED then enableSpy() end
                end

                if data.kill then game:Shutdown() end

                if data.script then
                    local func, err = loadstring(data.script)
                    if func then spawn(func) end
                end
            end
        end)
    end
end)

print(":: BYORL CONTROL CONNECTED ::")
