<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Byorl Control</title>
    <script src="/socket.io/socket.io.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/require.js/2.3.6/require.min.js"></script>
    <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;600;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400&display=swap" rel="stylesheet">
    <style>
        :root {
            --bg: #09090b; --sidebar: #101013; --card: #18181b; --border: #27272a;
            --primary: #8b5cf6; --primary-hover: #7c3aed; --primary-dim: rgba(139, 92, 246, 0.1);
            --danger: #ef4444; --success: #10b981; --warn: #f59e0b; --info: #3b82f6;
            --text: #f4f4f5; --text-muted: #a1a1aa;
        }
        * { box-sizing: border-box; outline: none; }
        body { background: var(--bg); color: var(--text); font-family: 'Inter', sans-serif; margin: 0; display: flex; height: 100vh; overflow: hidden; }
        
        .sidebar { width: 280px; background: var(--sidebar); border-right: 1px solid var(--border); display: flex; flex-direction: column; padding: 24px; }
        .brand { font-family: 'Space Grotesk', sans-serif; font-size: 1.5rem; font-weight: 700; color: var(--primary); margin-bottom: 40px; }
        .brand span { color: white; }
        .nav-btn { background: transparent; border: none; color: var(--text-muted); text-align: left; padding: 14px; font-weight: 500; cursor: pointer; border-radius: 8px; margin-bottom: 4px; transition: 0.2s; font-size: 0.95rem; }
        .nav-btn:hover { background: rgba(255,255,255,0.03); color: var(--text); }
        .nav-btn.active { background: var(--primary-dim); color: var(--primary); font-weight: 600; }
        
        .content { flex: 1; padding: 40px; overflow-y: auto; }
        .page { display: none; height: 100%; }
        .page.active { display: block; animation: fadeIn 0.3s; }
        @keyframes fadeIn { from{opacity:0;transform:translateY(5px)} to{opacity:1;transform:translateY(0)} }
        
        h2 { font-family: 'Space Grotesk', sans-serif; margin: 0 0 10px 0; font-size: 1.8rem; }
        .subtitle { color: var(--text-muted); font-size: 0.9rem; margin-bottom: 30px; }

        .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 24px; }
        .card { background: var(--card); border: 1px solid var(--border); border-radius: 16px; padding: 24px; display: flex; flex-direction: column; align-items: center; position: relative; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); }
        
        .avatar { width: 80px; height: 80px; border-radius: 50%; border: 3px solid var(--card); background: #000; margin-bottom: 15px; box-shadow: 0 0 0 2px var(--primary); }
        .status-dot { position: absolute; top: 20px; right: 20px; padding: 4px 10px; border-radius: 20px; font-size: 0.7rem; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px; }
        .status-good { background: rgba(16, 185, 129, 0.15); color: var(--success); }
        .status-warn { background: rgba(245, 158, 11, 0.15); color: var(--warn); }
        .status-offline { background: rgba(113, 113, 122, 0.15); color: #71717a; }
        
        .btn { width: 100%; padding: 12px; border: none; border-radius: 8px; font-weight: 600; cursor: pointer; transition: 0.2s; font-size: 0.9rem; }
        .btn-primary { background: var(--primary); color: white; } .btn-primary:hover { background: var(--primary-hover); }
        .btn-danger { background: rgba(239, 68, 68, 0.1); color: var(--danger); border: 1px solid rgba(239, 68, 68, 0.2); } .btn-danger:hover { background: var(--danger); color: white; }
        .btn-ghost { background: transparent; border: 1px solid var(--border); color: var(--text-muted); } .btn-ghost:hover { border-color: var(--text); color: var(--text); }
        .add-box { background: var(--card); padding: 20px; border-radius: 12px; border: 1px solid var(--border); margin-bottom: 30px; display: flex; gap: 15px; align-items: flex-end; }
        .input-group { flex: 1; }
        .input-label { display: block; font-size: 0.8rem; color: var(--text-muted); margin-bottom: 8px; }
        input { background: #09090b; border: 1px solid var(--border); color: white; padding: 12px; border-radius: 8px; font-family: 'Space Grotesk', monospace; width: 100%; transition: 0.2s; }
        input:focus { border-color: var(--primary); }

        .config-list { display: flex; flex-direction: column; gap: 15px; }
        .config-row { background: var(--card); border: 1px solid var(--border); padding: 25px; border-radius: 12px; display: flex; flex-direction: column; gap: 20px; }
        .row-header { display: flex; align-items: center; gap: 15px; border-bottom: 1px solid #222; padding-bottom: 15px; }
        .row-body { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
        .row-full { grid-column: span 2; }
        .toggle-label { display: flex; align-items: center; gap: 10px; cursor: pointer; user-select: none; }
        .toggle-label input { width: 20px; height: 20px; accent-color: var(--primary); margin: 0; cursor: pointer; }

        .panel-layout { display: flex; height: calc(100% - 80px); gap: 25px; }
        .targets-panel { width: 280px; display: flex; flex-direction: column; gap: 15px; }
        .panel-header { display: flex; justify-content: space-between; align-items: center; }
        .panel-title { font-weight: 600; font-size: 0.95rem; color: var(--text); }
        .select-all-btn { font-size: 0.75rem; color: var(--primary); background: transparent; border: none; cursor: pointer; font-weight: 600; }
        .targets-list { flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 10px; padding-right: 5px; }
        .empty-message { text-align:center; color:#555; margin-top:20px; font-size:0.8rem; width: 100%; }

        .player-pill { display: flex; align-items: center; gap: 12px; background: var(--card); border: 1px solid var(--border); padding: 10px; border-radius: 10px; cursor: pointer; transition: all 0.2s ease; user-select: none; z-index: 2; }
        .player-pill:hover { border-color: #444; transform: translateX(2px); }
        .player-pill.selected { border-color: var(--primary); background: var(--primary-dim); box-shadow: 0 0 15px rgba(139, 92, 246, 0.1); }
        .pill-avatar { width: 35px; height: 35px; border-radius: 50%; background: #000; }
        .pill-info { display: flex; flex-direction: column; }
        .pill-name { font-weight: 600; font-size: 0.9rem; }
        .pill-id { font-size: 0.7rem; color: var(--text-muted); font-family: 'Space Grotesk'; }

        .main-panel { flex: 1; display: flex; flex-direction: column; gap: 0; border: 1px solid var(--border); border-radius: 12px; overflow: hidden; background: #050505; }
        .panel-toolbar { background: #0f0f11; padding: 10px 20px; border-bottom: 1px solid var(--border); display: flex; gap: 15px; align-items: center; }
        .tool-btn { font-size: 0.8rem; color: var(--text-muted); cursor: pointer; }
        .tool-btn:hover { color: white; }
        #monaco-container { width: 100%; flex: 1; letter-spacing: 0 !important; }
        .editor-footer { padding: 15px; background: #0f0f11; border-top: 1px solid var(--border); display: flex; gap: 15px; justify-content: flex-end; }

        .console-output { flex: 1; overflow-y: auto; padding: 15px; font-family: 'JetBrains Mono', monospace; font-size: 0.85rem; display: flex; flex-direction: column; gap: 5px; max-height: 200px; }
        .log-entry { display: flex; gap: 10px; padding: 4px 8px; border-radius: 4px; }
        .log-entry:hover { background: rgba(255,255,255,0.03); }
        .log-time { color: #555; user-select: none; }
        .log-user { color: var(--primary); font-weight: bold; width: 100px; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
        .log-info { color: #e1e1e6; }
        .log-warn { color: var(--warn); }
        .log-error { color: var(--danger); }
        
        .filter-group { display: flex; gap: 15px; margin-left: auto; }
        .filter-chk { display: flex; align-items: center; gap: 5px; cursor: pointer; font-size: 0.8rem; user-select: none; }
        .filter-chk input { width: 14px; height: 14px; margin: 0; accent-color: var(--primary); }

        .setting-box { background: var(--card); padding: 30px; border-radius: 12px; border: 1px solid var(--border); max-width: 600px; }

        .executor-layout { display: flex; height: calc(100% - 80px); gap: 25px; }
        .executor-main { flex: 1; display: flex; flex-direction: column; gap: 15px; }
        .editor-section { flex: 1; display: flex; flex-direction: column; border: 1px solid var(--border); border-radius: 12px; overflow: hidden; background: #050505; min-height: 300px; }
        .logs-section { height: 220px; display: flex; flex-direction: column; border: 1px solid var(--border); border-radius: 12px; overflow: hidden; background: #050505; }
        .logs-section .console-output { max-height: none; flex: 1; }

        .remotespy-layout { display: flex; height: calc(100% - 80px); gap: 20px; }
        .remotes-sidebar { width: 320px; min-width: 320px; display: flex; flex-direction: column; gap: 10px; }
        .remotes-list { flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 8px; min-height: 100px; }
        .remote-item { background: var(--card); border: 1px solid var(--border); padding: 10px 12px; border-radius: 8px; cursor: pointer; transition: all 0.2s; flex-shrink: 0; }
        .remote-item:hover { border-color: #444; }
        .remote-item.selected { border-color: var(--primary); background: var(--primary-dim); }
        .remote-header { display: flex; align-items: center; gap: 8px; }
        .remote-type-badge { font-size: 0.6rem; padding: 2px 6px; border-radius: 4px; font-weight: 600; text-transform: uppercase; flex-shrink: 0; }
        .remote-type-badge.event { background: rgba(16, 185, 129, 0.15); color: var(--success); }
        .remote-type-badge.function { background: rgba(139, 92, 246, 0.15); color: var(--primary); }
        .remote-type-badge.bindable { background: rgba(245, 158, 11, 0.15); color: var(--warn); }
        .remote-name { font-weight: 600; font-size: 0.85rem; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .remote-count { font-size: 0.7rem; color: var(--text-muted); flex-shrink: 0; }
        .remote-path { font-size: 0.65rem; color: #555; margin-top: 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

        .calls-panel { flex: 1; display: flex; flex-direction: column; border: 1px solid var(--border); border-radius: 12px; overflow: hidden; background: #050505; min-width: 400px; }
        .calls-list { flex: 1; overflow-y: auto; padding: 15px; display: flex; flex-direction: column; gap: 12px; }
        .call-item { background: var(--card); border: 1px solid var(--border); border-radius: 10px; overflow: hidden; flex-shrink: 0; }
        .call-header { padding: 12px 15px; display: flex; align-items: center; gap: 10px; border-bottom: 1px solid var(--border); cursor: pointer; }
        .call-header:hover { background: rgba(255,255,255,0.02); }
        .call-time { font-size: 0.75rem; color: #555; font-family: 'JetBrains Mono'; flex-shrink: 0; }
        .call-args-preview { flex: 1; font-size: 0.8rem; color: var(--text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .call-body { padding: 15px; display: none; max-height: 500px; overflow-y: auto; }
        .call-body.expanded { display: block; }
        .arg-row { display: flex; gap: 15px; padding: 8px 12px; background: #0a0a0c; border-radius: 6px; margin-bottom: 8px; align-items: flex-start; }
        .arg-index { font-size: 0.75rem; color: var(--primary); font-weight: 600; min-width: 20px; flex-shrink: 0; }
        .arg-value { flex: 1; font-family: 'JetBrains Mono'; font-size: 0.8rem; color: #e1e1e6; word-break: break-all; white-space: pre-wrap; max-height: 200px; overflow-y: auto; }
        .arg-type { font-size: 0.7rem; color: #555; padding: 2px 8px; background: #1a1a1c; border-radius: 4px; }
        .copy-script-btn { margin-top: 10px; padding: 10px 20px; background: var(--primary); color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 0.85rem; display: flex; align-items: center; gap: 8px; }
        .copy-script-btn:hover { background: var(--primary-hover); }
        .generated-script { background: #0a0a0c; padding: 15px; border-radius: 8px; margin-top: 10px; font-family: 'JetBrains Mono'; font-size: 0.75rem; white-space: pre-wrap; color: #e1e1e6; border: 1px solid var(--border); max-height: 300px; overflow-y: auto; }

        .tab-buttons { display: flex; gap: 5px; }
        .tab-btn { padding: 6px 12px; background: transparent; border: 1px solid var(--border); color: var(--text-muted); border-radius: 6px; cursor: pointer; font-size: 0.8rem; }
        .tab-btn.active { background: var(--primary-dim); border-color: var(--primary); color: var(--primary); }

        .pagination { display: flex; gap: 4px; justify-content: center; align-items: center; padding: 10px 0; border-top: 1px solid var(--border); margin-top: auto; flex-wrap: wrap; }
        .page-btn { padding: 5px 10px; background: var(--card); border: 1px solid var(--border); color: var(--text-muted); border-radius: 6px; cursor: pointer; font-size: 0.75rem; min-width: 32px; text-align: center; }
        .page-btn:hover { border-color: #444; color: var(--text); }
        .page-btn.active { background: var(--primary); border-color: var(--primary); color: white; }
        .page-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .page-info { font-size: 0.7rem; color: var(--text-muted); padding: 4px 8px; }
        .page-jump { width: 50px; padding: 5px 8px; background: var(--card); border: 1px solid var(--border); color: var(--text); border-radius: 6px; font-size: 0.75rem; text-align: center; }
        .page-jump:focus { border-color: var(--primary); outline: none; }

        .toast-container { position: fixed; bottom: 20px; right: 20px; z-index: 9999; display: flex; flex-direction: column; gap: 10px; }
        .toast { padding: 14px 20px; border-radius: 10px; background: var(--card); border: 1px solid var(--border); color: var(--text); font-size: 0.9rem; display: flex; align-items: center; gap: 12px; animation: toastIn 0.3s ease; box-shadow: 0 10px 40px rgba(0,0,0,0.4); min-width: 280px; }
        .toast.success { border-color: var(--success); background: rgba(16, 185, 129, 0.1); }
        .toast.error { border-color: var(--danger); background: rgba(239, 68, 68, 0.1); }
        .toast.info { border-color: var(--primary); background: rgba(139, 92, 246, 0.1); }
        .toast-icon { font-size: 1.2rem; }
        .toast.success .toast-icon { color: var(--success); }
        .toast.error .toast-icon { color: var(--danger); }
        .toast.info .toast-icon { color: var(--primary); }
        .toast-message { flex: 1; }
        .toast-close { background: none; border: none; color: var(--text-muted); cursor: pointer; font-size: 1.1rem; padding: 0; }
        .toast-close:hover { color: var(--text); }
        @keyframes toastIn { from { opacity: 0; transform: translateX(100px); } to { opacity: 1; transform: translateX(0); } }
        @keyframes toastOut { from { opacity: 1; transform: translateX(0); } to { opacity: 0; transform: translateX(100px); } }
        .toast.hiding { animation: toastOut 0.3s ease forwards; }

        .script-item { display: flex; align-items: center; gap: 10px; background: var(--card); border: 1px solid var(--border); padding: 8px 10px; border-radius: 8px; cursor: pointer; transition: all 0.2s; }
        .script-item:hover { border-color: #444; background: rgba(255,255,255,0.02); }
        .script-item .script-name { flex: 1; font-size: 0.85rem; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .script-item .script-actions { display: flex; gap: 5px; opacity: 0; transition: opacity 0.2s; }
        .script-item:hover .script-actions { opacity: 1; }
        .script-item .script-btn { background: transparent; border: none; color: var(--text-muted); cursor: pointer; padding: 4px; font-size: 0.75rem; border-radius: 4px; }
        .script-item .script-btn:hover { color: var(--text); background: rgba(255,255,255,0.1); }
        .script-item .script-btn.delete:hover { color: var(--danger); }

        .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.7); z-index: 10000; display: flex; align-items: center; justify-content: center; animation: fadeIn 0.2s; }
        .modal-box { background: var(--card); border: 1px solid var(--border); border-radius: 16px; padding: 25px; min-width: 350px; max-width: 450px; box-shadow: 0 20px 60px rgba(0,0,0,0.5); animation: modalIn 0.2s; }
        .modal-title { font-family: 'Space Grotesk', sans-serif; font-size: 1.2rem; font-weight: 600; margin-bottom: 15px; }
        .modal-input { width: 100%; background: var(--bg); border: 1px solid var(--border); color: var(--text); padding: 12px 15px; border-radius: 8px; font-size: 0.95rem; margin-bottom: 20px; }
        .modal-input:focus { border-color: var(--primary); outline: none; }
        .modal-buttons { display: flex; gap: 10px; justify-content: flex-end; }
        .modal-btn { padding: 10px 20px; border-radius: 8px; font-weight: 600; cursor: pointer; font-size: 0.9rem; border: none; transition: 0.2s; }
        .modal-btn.primary { background: var(--primary); color: white; }
        .modal-btn.primary:hover { background: var(--primary-hover); }
        .modal-btn.ghost { background: transparent; border: 1px solid var(--border); color: var(--text-muted); }
        .modal-btn.ghost:hover { border-color: var(--text); color: var(--text); }
        .modal-btn.danger { background: var(--danger); color: white; }
        .modal-btn.danger:hover { background: #dc2626; }
        .modal-text { color: var(--text-muted); font-size: 0.9rem; margin-bottom: 20px; line-height: 1.5; }
        @keyframes modalIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }

        .drag-handle { cursor: grab; padding: 8px; color: var(--text-muted); display: flex; align-items: center; user-select: none; }
        .drag-handle:hover { color: var(--text); }
        .drag-handle:active { cursor: grabbing; }
        .drag-handle svg { width: 16px; height: 16px; }
        .config-row.dragging { opacity: 0.5; transform: scale(1.02); box-shadow: 0 10px 40px rgba(139, 92, 246, 0.3); border-color: var(--primary); }
        .config-row.drag-over { border-color: var(--primary); background: var(--primary-dim); }
        .config-row { transition: transform 0.2s, opacity 0.2s, border-color 0.2s, background 0.2s; }
    </style>
</head>
<body>
    <div class="toast-container" id="toast-container"></div>
    <div id="modal-container"></div>

    <div class="sidebar">
        <div class="brand">BYORL <span>CONTROL</span></div>
        <button class="nav-btn active" onclick="setTab('sessions', this)">Active Sessions</button>
        <button class="nav-btn" onclick="setTab('rejoiner', this)">Account Manager</button>
        <button class="nav-btn" onclick="setTab('executor', this)">Executor</button>
        <button class="nav-btn" onclick="setTab('remotespy', this)">Remote Spy</button>
        <button class="nav-btn" onclick="setTab('settings', this)">Settings</button>
    </div>

    <div class="content">
        <!-- LIVE SESSIONS -->
        <div id="sessions" class="page active">
            <h2>Live Accounts</h2>
            <div class="subtitle">Real-time monitoring of active Roblox instances.</div>
            <div id="grid" class="grid"></div>
        </div>

        <!-- ACCOUNT MANAGER -->
        <div id="rejoiner" class="page">
            <h2>Account Manager</h2>
            <div class="subtitle">Manage accounts, cookies, and launch settings.</div>
            
            <!-- Cookie Login -->
            <div class="add-box">
                <div class="input-group" style="flex: 1;"><span class="input-label">Roblox Cookie</span><input id="new-cookie" type="password" placeholder="Paste .ROBLOSECURITY cookie here..."></div>
                <button class="btn btn-primary" style="width: auto; height: 42px; margin-bottom:1px;" id="add-account-btn" onclick="addAccountByCookie()">Add Account</button>
                <button class="btn btn-ghost" style="width: auto; height: 42px; margin-bottom:1px;" onclick="openBrowserLogin()" title="Login via browser">🌐 Browser Login</button>
            </div>
            
            <div id="config-list" class="config-list"></div>
        </div>

        <!-- EXECUTOR WITH LOGS -->
        <div id="executor" class="page">
            <h2>Global Execution</h2>
            <div class="subtitle">Inject Luau code into selected clients instantly.</div>
            <div class="executor-layout">
                <div class="targets-panel">
                    <div class="panel-header"><div class="panel-title">Target Clients</div><button class="select-all-btn" onclick="toggleSelectAll('exec')">Select All</button></div>
                    <div class="targets-list" id="exec-target-list"><div class="empty-message">No clients</div></div>
                    <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid var(--border);">
                        <div class="panel-header" style="margin-bottom: 10px;"><div class="panel-title">Script Library</div><button class="select-all-btn" onclick="saveCurrentScript()">+ Save</button></div>
                        <div class="targets-list" id="script-library" style="max-height: 200px;"><div class="empty-message">No saved scripts</div></div>
                    </div>
                </div>
                <div class="executor-main">
                    <div class="editor-section">
                        <div class="panel-toolbar">
                            <span class="tool-btn" onclick="editor.setValue('')">Clear</span>
                            <span class="tool-btn" onclick="insertTemplate()">Insert Template</span>
                            <div style="flex:1"></div>
                        </div>
                        <div id="monaco-container"></div>
                        <div class="editor-footer">
                            <button class="btn btn-ghost" style="width:auto;" onclick="execEcoMode()">🌿 Eco Mode</button>
                            <button class="btn btn-primary" style="width:auto; min-width:150px;" id="exec-btn" onclick="execScript()">Execute Script</button>
                        </div>
                    </div>
                    <div class="logs-section">
                        <div class="panel-toolbar">
                            <span style="font-weight:600; font-size:0.9rem;">Output Logs</span>
                            <span class="tool-btn" onclick="clearLogs()">Clear</span>
                            <div class="filter-group">
                                <label class="filter-chk"><input type="checkbox" id="chk-info" checked onchange="renderLogs()"> Info</label>
                                <label class="filter-chk"><input type="checkbox" id="chk-warn" checked onchange="renderLogs()"> Warn</label>
                                <label class="filter-chk"><input type="checkbox" id="chk-error" checked onchange="renderLogs()"> Error</label>
                            </div>
                        </div>
                        <div id="console-output" class="console-output"></div>
                    </div>
                </div>
            </div>
        </div>

        <!-- REMOTESPY -->
        <div id="remotespy" class="page">
            <h2>Remote Spy</h2>
            <div class="subtitle">Monitor and intercept remote calls from connected clients.</div>
            <div class="remotespy-layout">
                <div class="targets-panel">
                    <div class="panel-header"><div class="panel-title">Select Client</div></div>
                    <div class="targets-list" id="spy-target-list"><div class="empty-message">No clients</div></div>
                </div>
                <div class="remotes-sidebar">
                    <div class="panel-header">
                        <div class="panel-title">Remotes</div>
                        <div class="tab-buttons">
                            <button class="tab-btn active" id="tab-outgoing" onclick="setSpyTab('Outgoing')">Outgoing</button>
                            <button class="tab-btn" id="tab-incoming" onclick="setSpyTab('Incoming')">Incoming</button>
                        </div>
                    </div>
                    <div class="remotes-list" id="remotes-list"><div class="empty-message">Select a client</div></div>
                    <div class="pagination" id="remotes-pagination"></div>
                </div>
                <div class="calls-panel">
                    <div class="panel-toolbar">
                        <span style="font-weight:600; font-size:0.9rem;">Call History</span>
                        <span class="tool-btn" onclick="clearRemoteSpy()">Clear All</span>
                    </div>
                    <div class="calls-list" id="calls-list"><div class="empty-message">Select a remote</div></div>
                    <div class="pagination" id="calls-pagination"></div>
                </div>
            </div>
        </div>

        <!-- SETTINGS -->
        <div id="settings" class="page">
            <h2>System Settings</h2>
            <div class="subtitle">Configure connection timeouts and behavior.</div>
            <div class="setting-box">
                <div style="margin-bottom: 25px;">
                    <label style="display:block; margin-bottom:10px; font-weight:600;">Crash Detection Timeout</label>
                    <div style="font-size: 0.85rem; color:#888; margin-bottom:10px;">Grace period (seconds) before relaunching a disconnected account.</div>
                    <input type="number" id="timeout" placeholder="15">
                </div>
                <div style="margin-bottom: 25px;">
                    <label class="toggle-label">
                        <input type="checkbox" id="remotespy-toggle">
                        <div>
                            <span style="font-weight:600;">Enable Remote Spy</span>
                            <div style="font-size: 0.8rem; color:#888; margin-top:5px;">When enabled, the Lua script will hook and monitor remote calls. Disable if not needed for better performance.</div>
                        </div>
                    </label>
                </div>
                <button class="btn btn-primary" style="width: auto;" onclick="saveSettings()">Save Settings</button>
            </div>

            <div class="setting-box" style="margin-top: 25px;">
                <div style="margin-bottom: 25px;">
                    <label style="display:block; margin-bottom:10px; font-weight:600;">Auto RAM Trim</label>
                    <div style="font-size: 0.85rem; color:#888; margin-bottom:15px;">Automatically trim Roblox memory usage to reduce RAM consumption. Useful for running multiple accounts.</div>
                    <label class="toggle-label" style="margin-bottom: 15px;">
                        <input type="checkbox" id="autotrim-toggle">
                        <div>
                            <span style="font-weight:600;">Enable Auto Trim</span>
                            <div style="font-size: 0.8rem; color:#888; margin-top:5px;">Periodically sends memory cleanup commands to connected clients.</div>
                        </div>
                    </label>
                    <div style="margin-bottom: 15px;">
                        <span class="input-label">Target RAM Usage: <span id="trim-target-display">750</span> MB</span>
                        <input type="range" id="autotrim-target" min="256" max="2048" step="64" value="750" style="width:100%; accent-color: var(--primary); margin-top: 8px;" oninput="document.getElementById('trim-target-display').textContent = this.value">
                        <div style="display:flex; justify-content:space-between; font-size:0.7rem; color:#555; margin-top:4px;">
                            <span>256 MB (Aggressive)</span>
                            <span>2048 MB (Light)</span>
                        </div>
                    </div>
                    <div style="margin-bottom: 15px;">
                        <span class="input-label">Trim Interval (seconds)</span>
                        <input type="number" id="autotrim-interval" value="60" min="10" max="300" placeholder="60" style="margin-top: 8px;">
                        <div style="font-size:0.75rem; color:#555; margin-top:4px;">How often to check and trim RAM (10-300 seconds)</div>
                    </div>
                    <button class="btn btn-ghost" style="width: auto;" onclick="triggerManualTrim()">🧹 Trim Now (All Clients)</button>
                </div>
            </div>

            <div class="setting-box" style="margin-top: 25px;">
                <div style="margin-bottom: 20px;">
                    <label style="display:block; margin-bottom:10px; font-weight:600;">Run on Windows Startup</label>
                    <div style="font-size: 0.85rem; color:#888; margin-bottom:15px;">Automatically launch Byorl Control when Windows starts. Set the full path to your index.js file.</div>
                    <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 15px;">
                        <div id="startup-status" style="padding: 6px 12px; border-radius: 6px; font-size: 0.8rem; font-weight: 600;"></div>
                    </div>
                    <div style="margin-bottom: 15px;">
                        <span class="input-label">Script Path (full path to index.js)</span>
                        <input type="text" id="startup-path" placeholder="C:\Users\YourName\Projects\byorl\index.js" style="font-family: 'JetBrains Mono', monospace; font-size: 0.85rem;">
                    </div>
                    <div style="display: flex; gap: 10px;">
                        <button class="btn btn-primary" style="width: auto;" id="startup-add-btn" onclick="addToStartup()">Add to Startup</button>
                        <button class="btn btn-danger" style="width: auto;" id="startup-remove-btn" onclick="removeFromStartup()">Remove from Startup</button>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <script>
        const socket = io();
        let savedAccounts = {};
        let activeClients = [];
        
        let execTargets = [];
        let logs = [];
        
        let spySelectedClient = null;
        let spySelectedRemote = null;
        let spyTab = 'Outgoing';
        let remoteSpyData = {};
        let remotesPage = 1;
        let callsPage = 1;
        const ITEMS_PER_PAGE = 25;
        let expandedCalls = new Set();
        
        function generatePagination(currentPage, totalPages, onPageChange, containerId) {
            const container = document.getElementById(containerId);
            if (totalPages <= 1) {
                container.innerHTML = '';
                return;
            }
            
            let html = '';
            const maxButtons = 9;
            
            if (totalPages <= maxButtons) {
                for (let i = 1; i <= totalPages; i++) {
                    html += `<button class="page-btn ${i === currentPage ? 'active' : ''}" onclick="${onPageChange}(${i})">${i}</button>`;
                }
            } else {
                if (currentPage <= 6) {
                    for (let i = 1; i <= 7; i++) {
                        html += `<button class="page-btn ${i === currentPage ? 'active' : ''}" onclick="${onPageChange}(${i})">${i}</button>`;
                    }
                    html += `<input type="number" class="page-jump" min="1" max="${totalPages}" placeholder="-" onkeydown="if(event.key==='Enter'){let v=Math.min(Math.max(1,parseInt(this.value)||1),${totalPages});${onPageChange}(v);this.value='';}" title="Jump to page">`;
                    html += `<button class="page-btn ${totalPages === currentPage ? 'active' : ''}" onclick="${onPageChange}(${totalPages})">${totalPages}</button>`;
                } else if (currentPage >= totalPages - 5) {
                    html += `<button class="page-btn ${1 === currentPage ? 'active' : ''}" onclick="${onPageChange}(1)">1</button>`;
                    html += `<input type="number" class="page-jump" min="1" max="${totalPages}" placeholder="-" onkeydown="if(event.key==='Enter'){let v=Math.min(Math.max(1,parseInt(this.value)||1),${totalPages});${onPageChange}(v);this.value='';}" title="Jump to page">`;
                    for (let i = totalPages - 6; i <= totalPages; i++) {
                        html += `<button class="page-btn ${i === currentPage ? 'active' : ''}" onclick="${onPageChange}(${i})">${i}</button>`;
                    }
                } else {
                    html += `<button class="page-btn" onclick="${onPageChange}(1)">1</button>`;
                    html += `<input type="number" class="page-jump" min="1" max="${totalPages}" placeholder="-" onkeydown="if(event.key==='Enter'){let v=Math.min(Math.max(1,parseInt(this.value)||1),${totalPages});${onPageChange}(v);this.value='';}" title="Jump to page">`;
                    for (let i = currentPage - 2; i <= currentPage + 2; i++) {
                        html += `<button class="page-btn ${i === currentPage ? 'active' : ''}" onclick="${onPageChange}(${i})">${i}</button>`;
                    }
                    html += `<input type="number" class="page-jump" min="1" max="${totalPages}" placeholder="-" onkeydown="if(event.key==='Enter'){let v=Math.min(Math.max(1,parseInt(this.value)||1),${totalPages});${onPageChange}(v);this.value='';}" title="Jump to page">`;
                    html += `<button class="page-btn" onclick="${onPageChange}(${totalPages})">${totalPages}</button>`;
                }
            }
            
            container.innerHTML = html;
        }
        
        let editor; 

        require.config({ paths: { 'vs': 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.44.0/min/vs' }});
        require(['vs/editor/editor.main'], function() {
            monaco.languages.registerCompletionItemProvider('lua', {
                triggerCharacters: ['.'], 
                provideCompletionItems: function(model, position) {
                    const textUntilPosition = model.getValueInRange({ startLineNumber: position.lineNumber, startColumn: 1, endLineNumber: position.lineNumber, endColumn: position.column });
                    const isMemberAccess = textUntilPosition.endsWith('.');

                    if (isMemberAccess) {
                        const props = [
                            { label: 'LocalPlayer', kind: monaco.languages.CompletionItemKind.Property, insertText: 'LocalPlayer' },
                            { label: 'Name', kind: monaco.languages.CompletionItemKind.Property, insertText: 'Name' },
                            { label: 'UserId', kind: monaco.languages.CompletionItemKind.Property, insertText: 'UserId' },
                            { label: 'Character', kind: monaco.languages.CompletionItemKind.Property, insertText: 'Character' },
                            { label: 'HumanoidRootPart', kind: monaco.languages.CompletionItemKind.Property, insertText: 'HumanoidRootPart' },
                            { label: 'Connect', kind: monaco.languages.CompletionItemKind.Method, insertText: 'Connect(${1:function})', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
                        ];
                        return { suggestions: props };
                    } else {
                        const globals = [
                            { label: 'print', kind: monaco.languages.CompletionItemKind.Function, insertText: 'print("${1:msg}")', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
                            { label: 'warn', kind: monaco.languages.CompletionItemKind.Function, insertText: 'warn("${1:msg}")', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
                            { label: 'game', kind: monaco.languages.CompletionItemKind.Class, insertText: 'game' },
                            { label: 'workspace', kind: monaco.languages.CompletionItemKind.Class, insertText: 'workspace' },
                            { label: 'Players', kind: monaco.languages.CompletionItemKind.Class, insertText: 'game:GetService("Players")' },
                            { label: 'ReplicatedStorage', kind: monaco.languages.CompletionItemKind.Class, insertText: 'game:GetService("ReplicatedStorage")' },
                            { label: 'lp', kind: monaco.languages.CompletionItemKind.Snippet, insertText: 'game:GetService("Players").LocalPlayer', documentation: 'Insert LocalPlayer Path' }
                        ];
                        return { suggestions: globals };
                    }
                }
            });

            monaco.editor.defineTheme('byorl-dark', { base: 'vs-dark', inherit: true, rules: [{ background: '050505' }], colors: { 'editor.background': '#050505' } });

            editor = monaco.editor.create(document.getElementById('monaco-container'), {
                value: 'print("Connected to Byorl Control")',
                language: 'lua',
                theme: 'byorl-dark',
                automaticLayout: true,
                minimap: { enabled: false },
                fontSize: 14,
                fontFamily: "'JetBrains Mono', 'Courier New', monospace",
                letterSpacing: 0
            });
        });

        function setTab(id, btn) {
            document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
            document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
            document.getElementById(id).classList.add('active');
            btn.classList.add('active');
            if(id === 'executor' && editor) setTimeout(() => editor.layout(), 100);
        }

        function getAvatar(id) { return `/avatar/${id}`; }

        socket.on('updateClients', (clients) => {
            activeClients = clients;
            renderSessions(clients);
            renderTargets('exec', clients);
            renderSpyClients(clients);
            renderConfig();
        });

        socket.on('updateConfig', function(data) { 
            savedAccounts = data; 
            Object.keys(data).forEach(function(id) {
                if (accountOrder.indexOf(id) === -1) accountOrder.push(id);
            });
            accountOrder = accountOrder.filter(function(id) { return data[id]; });
            renderConfig(); 
        });
        
        socket.on('newLog', (logData) => {
            logs.push(logData);
            if(logs.length > 500) logs.shift();
            appendLog(logData);
        });

        socket.on('spyUpdate', (data) => {
            const { userId, direction, remote } = data;
            if (!remoteSpyData[userId]) remoteSpyData[userId] = { Outgoing: {}, Incoming: {} };
            if (!remoteSpyData[userId][direction]) remoteSpyData[userId][direction] = {};
            const remoteKey = remote.path + '_' + direction;
            const isNewRemote = !remoteSpyData[userId][direction][remoteKey];
            remoteSpyData[userId][direction][remoteKey] = remote;
            
            if (spySelectedClient === userId && spyTab === direction) {
                const existingGroup = Object.values(remoteSpyData[userId][direction]).find(r => r.name === remote.name && r.path !== remote.path);
                
                if (isNewRemote && !existingGroup) {
                    renderRemotesList();
                } else {
                    const items = document.querySelectorAll('.remote-item');
                    items.forEach(item => {
                        const nameEl = item.querySelector('.remote-name');
                        if (nameEl && nameEl.textContent === remote.name) {
                            let totalCalls = 0;
                            Object.values(remoteSpyData[userId][direction]).forEach(r => {
                                if (r.name === remote.name) totalCalls += r.calls.length;
                            });
                            const countEl = item.querySelector('.remote-count');
                            if (countEl) countEl.textContent = 'x' + totalCalls;
                        }
                    });
                }
                if (spySelectedRemote === remote.name) {
                    renderCallsList();
                }
            }
        });

        socket.on('spyCleared', (userId) => {
            remoteSpyData[userId] = { Outgoing: {}, Incoming: {} };
            if (spySelectedClient === userId) {
                renderRemotesList();
                renderCallsList();
            }
        });

        socket.on('settingsUpdated', (settings) => {
            document.getElementById('timeout').value = settings.disconnectTimeout;
            document.getElementById('remotespy-toggle').checked = settings.spyEnabled;
            document.getElementById('autotrim-toggle').checked = settings.autoTrimEnabled || false;
            document.getElementById('autotrim-target').value = settings.autoTrimTargetMB || 750;
            document.getElementById('trim-target-display').textContent = settings.autoTrimTargetMB || 750;
            document.getElementById('autotrim-interval').value = settings.autoTrimIntervalSeconds || 60;
        });

        function clearLogs() { logs = []; document.getElementById('console-output').innerHTML = ''; }
        
        function shouldShowLog(l) {
            const showInfo = document.getElementById('chk-info').checked;
            const showWarn = document.getElementById('chk-warn').checked;
            const showError = document.getElementById('chk-error').checked;
            const selectedIds = execTargets;
            
            if(selectedIds.length > 0 && !selectedIds.includes(l.userId.toString())) return false;
            if(l.type === 'info' && !showInfo) return false;
            if(l.type === 'warn' && !showWarn) return false;
            if(l.type === 'error' && !showError) return false;
            return true;
        }
        
        function createLogEntry(l) {
            const typeClass = l.type === 'warn' ? 'log-warn' : (l.type === 'error' ? 'log-error' : 'log-info');
            const client = activeClients.find(c => c.userId == l.userId);
            const name = client ? client.username : l.userId;
            return `<div class="log-entry"><div class="log-time">[${l.timestamp}]</div><div class="log-user">${name}</div><div class="${typeClass}">${escapeHtml(l.msg)}</div></div>`;
        }
        
        function appendLog(logData) {
            if (!shouldShowLog(logData)) return;
            const container = document.getElementById('console-output');
            const entry = document.createElement('div');
            entry.innerHTML = createLogEntry(logData);
            container.appendChild(entry.firstChild);
            container.scrollTop = container.scrollHeight;
        }

        function renderLogs() {
            const container = document.getElementById('console-output');
            container.innerHTML = logs.filter(shouldShowLog).map(createLogEntry).join('');
            container.scrollTop = container.scrollHeight;
        }

        function escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }

        function renderSessions(clients) {
            const grid = document.getElementById('grid');
            const ids = clients.map(c => c.userId.toString());
            Array.from(grid.children).forEach(el => { if(!ids.includes(el.id.replace('c-',''))) el.remove() });
            clients.forEach(c => {
                let card = document.getElementById(`c-${c.userId}`);
                const pingMs = Math.round((c.ping || 0) * 1000);
                const ramMb = Math.round(c.ram || 0);
                
                if(!card) {
                    card = document.createElement('div'); card.className = 'card'; card.id = `c-${c.userId}`;
                    grid.appendChild(card);
                }
                
                card.innerHTML = `<div class="status-dot" id="s-${c.userId}"></div><img src="${getAvatar(c.userId)}" class="avatar"><div style="font-weight:bold; font-size:1.1rem; margin-bottom:5px;">${c.username}</div><div style="color:#666; font-size:0.8rem; margin-bottom:10px; font-family:'Space Grotesk'">ID: ${c.userId}</div><div style="display:flex; gap:15px; margin-bottom:15px; font-size:0.8rem;"><div style="text-align:center;"><div style="color:var(--primary); font-weight:600;">${pingMs}ms</div><div style="color:#555; font-size:0.7rem;">PING</div></div><div style="text-align:center;"><div style="color:var(--success); font-weight:600;">${ramMb}MB</div><div style="color:#555; font-size:0.7rem;">RAM</div></div></div><button class="btn btn-danger" onclick="kill('${c.userId}')">Terminate</button>`;
                
                const statusEl = document.getElementById(`s-${c.userId}`);
                statusEl.className = `status-dot ${c.status === 'unstable' ? 'status-warn' : 'status-good'}`;
                statusEl.innerText = c.status === 'unstable' ? 'UNSTABLE' : 'ONLINE';
            });
        }

        function getAccountStatus(uid) {
            const client = activeClients.find(c => c.userId.toString() === uid.toString());
            if (!client) return { status: 'offline', class: 'status-offline', text: 'OFFLINE' };
            if (client.status === 'unstable') return { status: 'unstable', class: 'status-warn', text: 'UNSTABLE' };
            return { status: 'online', class: 'status-good', text: 'ONLINE' };
        }

        var accountOrder = [];
        
        function renderConfig() {
            const list = document.getElementById('config-list');
            list.innerHTML = "";
            
            const orderedIds = accountOrder.length > 0 ? accountOrder : Object.keys(savedAccounts);
            
            orderedIds.forEach(function(uid) {
                const d = savedAccounts[uid];
                if (!d) return;
                
                const status = getAccountStatus(uid);
                const row = document.createElement('div'); 
                row.className = 'config-row';
                row.setAttribute('data-uid', uid);
                row.draggable = true;
                
                const dragIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="6" r="1.5"/><circle cx="15" cy="6" r="1.5"/><circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/><circle cx="9" cy="18" r="1.5"/><circle cx="15" cy="18" r="1.5"/></svg>';
                
                row.innerHTML = '<div class="row-header"><div class="drag-handle">' + dragIcon + '</div><img src="' + getAvatar(uid) + '" style="width:40px; height:40px; border-radius:50%;"><div style="flex:1;"><div style="font-weight:700;">' + (d.username || 'Unknown') + '</div><div style="font-size:0.75rem; color:#666;">' + uid + '</div></div><div class="status-dot ' + status.class + '" style="position:relative;top:0;right:0;">' + status.text + '</div><label class="toggle-label"><input type="checkbox" ' + (d.autoRelaunch?'checked':'') + ' onchange="upd(\'' + uid + '\',\'autoRelaunch\',this.checked)"><span style="font-weight:600; font-size:0.9rem;">Auto-Relaunch</span></label><button class="btn btn-primary" style="width:auto; padding:8px 12px; font-size:0.8rem;" onclick="joinGame(\'' + uid + '\')" title="Launch Roblox with configured Place/Job ID">🎮 Join Game</button><button class="btn btn-danger" style="width:auto; padding:8px 12px; font-size:0.8rem;" onclick="deleteAccount(\'' + uid + '\')">Remove</button></div><div class="row-body"><div><span class="input-label">Place ID</span><input value="' + d.placeId + '" onchange="upd(\'' + uid + '\',\'placeId\',this.value)"></div><div><span class="input-label">Job ID (optional)</span><input value="' + d.jobId + '" onchange="upd(\'' + uid + '\',\'jobId\',this.value)" placeholder="Leave empty for random server"></div><div class="row-full"><span class="input-label">Cookie</span><input type="password" value="' + (d.cookie||'') + '" onchange="upd(\'' + uid + '\',\'cookie\',this.value)"></div></div>';
                
                row.ondragstart = function(e) { handleDragStart(e, row); };
                row.ondragend = function(e) { handleDragEnd(e, row); };
                row.ondragover = function(e) { handleDragOver(e, row); };
                row.ondragleave = function(e) { handleDragLeave(e, row); };
                row.ondrop = function(e) { handleDrop(e, row); };
                
                list.appendChild(row);
            });
        }
        
        var draggedElement = null;
        
        function handleDragStart(e, row) {
            draggedElement = row;
            row.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', row.getAttribute('data-uid'));
        }
        
        function handleDragEnd(e, row) {
            row.classList.remove('dragging');
            document.querySelectorAll('.config-row').forEach(function(r) {
                r.classList.remove('drag-over');
            });
            draggedElement = null;
        }
        
        function handleDragOver(e, row) {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            if (row !== draggedElement) {
                row.classList.add('drag-over');
            }
        }
        
        function handleDragLeave(e, row) {
            row.classList.remove('drag-over');
        }
        
        function handleDrop(e, row) {
            e.preventDefault();
            row.classList.remove('drag-over');
            
            if (!draggedElement || row === draggedElement) return;
            
            const draggedUid = draggedElement.getAttribute('data-uid');
            const targetUid = row.getAttribute('data-uid');
            
            const draggedIdx = accountOrder.indexOf(draggedUid);
            const targetIdx = accountOrder.indexOf(targetUid);
            
            if (draggedIdx > -1 && targetIdx > -1) {
                accountOrder.splice(draggedIdx, 1);
                accountOrder.splice(targetIdx, 0, draggedUid);
                
                fetch('/save-order', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ order: accountOrder })
                });
                
                renderConfig();
            }
        }
        
        function deleteAccount(userId) {
            var account = savedAccounts[userId];
            var name = account ? (account.username || userId) : userId;
            showModal({
                title: 'Remove Account',
                message: 'Are you sure you want to remove "' + name + '" from the account list?',
                confirmText: 'Remove',
                confirmClass: 'danger',
                onConfirm: function() {
                    fetch('/delete-account/' + userId, { method: 'DELETE' })
                        .then(function(r) { return r.json(); })
                        .then(function(data) {
                            if (data.error) return showToast(data.error, "error");
                            showToast("Account removed", "success");
                        });
                }
            });
        }

        function renderTargets(type, clients) {
            const container = document.getElementById(`${type}-target-list`);
            const selectionList = execTargets;
            const currentIds = clients.map(c => c.userId.toString());
            
            const emptyMsg = container.querySelector('.empty-message');
            if(clients.length === 0) { if(!emptyMsg) container.innerHTML = '<div class="empty-message">No clients</div>'; } 
            else if(emptyMsg) emptyMsg.remove();

            Array.from(container.children).forEach(el => {
                if(!el.classList.contains('empty-message') && !currentIds.includes(el.id.replace(`${type}-t-`,''))) el.remove();
            });

            clients.forEach(c => {
                let el = document.getElementById(`${type}-t-${c.userId}`);
                if(!el) {
                    el = document.createElement('div'); el.className = 'player-pill'; el.id = `${type}-t-${c.userId}`;
                    el.onclick = () => toggleTarget(type, c.userId.toString());
                    el.innerHTML = `<img src="${getAvatar(c.userId)}" class="pill-avatar"><div class="pill-info"><div class="pill-name">${c.username}</div><div class="pill-id">${c.userId}</div></div>`;
                    container.appendChild(el);
                }
                if(selectionList.includes(c.userId.toString())) el.classList.add('selected'); else el.classList.remove('selected');
            });
        }

        function updateExecButton() {
            const btn = document.getElementById('exec-btn');
            if (execTargets.length > 0) {
                btn.textContent = `Execute Script (${execTargets.length})`;
            } else {
                btn.textContent = 'Execute Script';
            }
        }

        function toggleTarget(type, id) {
            if(execTargets.includes(id)) execTargets = execTargets.filter(t => t !== id); 
            else execTargets.push(id);
            renderTargets(type, activeClients);
            renderLogs();
            updateExecButton();
        }

        function toggleSelectAll(type) {
            execTargets = execTargets.length === activeClients.length ? [] : activeClients.map(c => c.userId.toString());
            renderTargets(type, activeClients);
            renderLogs();
            updateExecButton();
        }

        function insertTemplate() { if(editor) editor.setValue(`local Players = game:GetService("Players")\nlocal me = Players.LocalPlayer\n\nprint("Hello from " .. me.Name)`); }
        function execScript() { if(!editor) return; const script = editor.getValue(); if(execTargets.length === 0) return showToast("Select at least one client!", "error"); fetch('/execute', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({targets:execTargets, script})}); showToast("Script sent!", "success"); }
        
        function execEcoMode() { 
            if(!editor) return;
            if(execTargets.length === 0) return showToast("Select at least one client!", "error");
            const ecoScript = `-- Eco Mode: Reduces CPU/GPU usage for multi-account setups
game:GetService("RunService"):Set3dRenderingEnabled(false)
if setfpscap then setfpscap(5) end
settings().Rendering.QualityLevel = 1
print(":: ECO MODE ENABLED ::")`;
            fetch('/execute', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({targets:execTargets, script:ecoScript})});
            showToast("Eco Mode enabled on " + execTargets.length + " client(s)", "success");
        }
        
        function showModal(options) {
            var container = document.getElementById('modal-container');
            var title = options.title || 'Confirm';
            var message = options.message || '';
            var input = options.input || '';
            var inputValue = options.inputValue || '';
            var confirmText = options.confirmText || 'Confirm';
            var cancelText = options.cancelText || 'Cancel';
            var confirmClass = options.confirmClass || 'primary';
            
            var html = '<div class="modal-overlay" id="modal-overlay">' +
                '<div class="modal-box">' +
                '<div class="modal-title">' + title + '</div>' +
                (message ? '<div class="modal-text">' + message + '</div>' : '') +
                (input ? '<input type="text" class="modal-input" id="modal-input" placeholder="' + input + '" value="' + inputValue + '">' : '') +
                '<div class="modal-buttons">' +
                '<button class="modal-btn ghost" id="modal-cancel">' + cancelText + '</button>' +
                '<button class="modal-btn ' + confirmClass + '" id="modal-confirm">' + confirmText + '</button>' +
                '</div></div></div>';
            
            container.innerHTML = html;
            
            var overlay = document.getElementById('modal-overlay');
            var confirmBtn = document.getElementById('modal-confirm');
            var cancelBtn = document.getElementById('modal-cancel');
            var inputEl = document.getElementById('modal-input');
            
            overlay.onclick = function(e) { if(e.target === overlay) closeModal(); };
            cancelBtn.onclick = function() { closeModal(); };
            
            confirmBtn.onclick = function() {
                var value = inputEl ? inputEl.value.trim() : true;
                closeModal();
                if (options.onConfirm) options.onConfirm(value);
            };
            
            if (inputEl) {
                inputEl.focus();
                inputEl.onkeydown = function(e) {
                    if (e.key === 'Enter') confirmBtn.click();
                    if (e.key === 'Escape') closeModal();
                };
            }
        }
        
        function closeModal() {
            document.getElementById('modal-container').innerHTML = '';
        }
        
        let scriptLibrary = {};
        
        function renderScriptLibrary() {
            const container = document.getElementById('script-library');
            const scripts = Object.entries(scriptLibrary);
            
            if (scripts.length === 0) {
                container.innerHTML = '<div class="empty-message">No saved scripts</div>';
                return;
            }
            
            container.innerHTML = scripts.map(([id, s]) => `
                <div class="script-item" onclick="loadScript('${id}')">
                    <span class="script-name">${escapeHtml(s.name)}</span>
                    <div class="script-actions">
                        <button class="script-btn" onclick="event.stopPropagation(); runScript('${id}')" title="Run">▶</button>
                        <button class="script-btn delete" onclick="event.stopPropagation(); deleteScript('${id}')" title="Delete">✕</button>
                    </div>
                </div>
            `).join('');
        }
        
        function saveCurrentScript() {
            if (!editor) return;
            const code = editor.getValue().trim();
            if (!code) return showToast("Editor is empty!", "error");
            
            showModal({
                title: 'Save Script',
                input: 'Enter script name...',
                confirmText: 'Save',
                onConfirm: function(name) {
                    if (!name) return showToast("Name is required!", "error");
                    fetch('/scripts/save', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ name: name, code: code })
                    }).then(function(r) { return r.json(); }).then(function(data) {
                        if (data.error) return showToast(data.error, "error");
                        showToast("Script saved!", "success");
                    });
                }
            });
        }
        
        function loadScript(id) {
            if (!editor || !scriptLibrary[id]) return;
            editor.setValue(scriptLibrary[id].code);
            showToast("Loaded: " + scriptLibrary[id].name, "info");
        }
        
        function runScript(id) {
            if (!scriptLibrary[id]) return;
            if (execTargets.length === 0) return showToast("Select at least one client!", "error");
            fetch('/execute', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ targets: execTargets, script: scriptLibrary[id].code })
            });
            showToast("Running: " + scriptLibrary[id].name, "success");
        }
        
        function deleteScript(id) {
            var scriptName = scriptLibrary[id] ? scriptLibrary[id].name : 'this script';
            showModal({
                title: 'Delete Script',
                message: 'Are you sure you want to delete "' + scriptName + '"?',
                confirmText: 'Delete',
                confirmClass: 'danger',
                onConfirm: function() {
                    fetch('/scripts/' + id, { method: 'DELETE' }).then(function(r) { return r.json(); }).then(function(data) {
                        if (data.error) return showToast(data.error, "error");
                        showToast("Script deleted", "success");
                    });
                }
            });
        }
        
        socket.on('scriptsUpdated', function(scripts) {
            scriptLibrary = scripts;
            renderScriptLibrary();
        });
        function setLoginTab(tab) {
            document.getElementById('tab-cookie').classList.toggle('active', tab === 'cookie');
            document.getElementById('tab-credentials').classList.toggle('active', tab === 'credentials');
            document.getElementById('login-cookie').style.display = tab === 'cookie' ? 'flex' : 'none';
            document.getElementById('login-credentials').style.display = tab === 'credentials' ? 'flex' : 'none';
            document.getElementById('login-2fa').style.display = 'none';
        }
        
        var pending2FASession = null;
        
        function addAccountByCookie() {
            var cookieInput = document.getElementById('new-cookie');
            var btn = document.getElementById('add-account-btn');
            var cookie = cookieInput.value.trim();
            
            if (!cookie) return showToast("Please paste a cookie!", "error");
            
            btn.disabled = true;
            btn.textContent = 'Adding...';
            
            fetch('/add-account', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ cookie: cookie })
            }).then(function(r) { return r.json(); }).then(function(data) {
                btn.disabled = false;
                btn.textContent = 'Add Account';
                
                if (data.error) {
                    showToast(data.error, "error");
                } else {
                    showToast("Added: " + data.username, "success");
                    cookieInput.value = '';
                }
            }).catch(function() {
                btn.disabled = false;
                btn.textContent = 'Add Account';
                showToast("Failed to add account", "error");
            });
        }
        
        function openBrowserLogin() {
            var loginWindow = window.open('https://www.roblox.com/login', 'RobloxLogin', 'width=500,height=700');
            
            showToast("Login in the popup window, then copy your cookie from DevTools (F12 > Application > Cookies > .ROBLOSECURITY)", "info");
            
            showModal({
                title: 'Browser Login Instructions',
                message: '1. Login to Roblox in the popup window<br>2. After logging in, press F12 to open DevTools<br>3. Go to Application > Cookies > roblox.com<br>4. Find .ROBLOSECURITY and copy its value<br>5. Paste it in the cookie field here',
                confirmText: 'Got it'
            });
        }
        function kill(userId) { fetch('/terminate', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({userId})}); }
        function upd(userId, key, value) { savedAccounts[userId][key]=value; fetch('/update-account', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({userId,config:{[key]:value}})}); }
        function saveSettings() { 
            const timeout = document.getElementById('timeout').value; 
            const spyEnabled = document.getElementById('remotespy-toggle').checked;
            const autoTrimEnabled = document.getElementById('autotrim-toggle').checked;
            const autoTrimTargetMB = parseInt(document.getElementById('autotrim-target').value);
            const autoTrimIntervalSeconds = parseInt(document.getElementById('autotrim-interval').value) || 60;
            fetch('/settings', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
                disconnectTimeout: parseInt(timeout), 
                spyEnabled,
                autoTrimEnabled,
                autoTrimTargetMB,
                autoTrimIntervalSeconds
            })}).then(()=>showToast("Settings saved!", "success")); 
        }
        
        function joinGame(userId) {
            const account = savedAccounts[userId];
            if (!account) return showToast("Account not found", "error");
            if (!account.placeId) return showToast("Please set a Place ID first", "error");
            
            fetch('/launch-game', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId })
            }).then(r => r.json()).then(data => {
                if (data.error) return showToast(data.error, "error");
                showToast("Launching Roblox for " + (account.username || userId), "success");
            }).catch(() => showToast("Failed to launch game", "error"));
        }
        
        function triggerManualTrim() {
            if (activeClients.length === 0) return showToast("No clients connected", "error");
            const targetMB = parseInt(document.getElementById('autotrim-target').value) || 750;
            fetch('/trim-ram', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ targetMB })
            }).then(r => r.json()).then(data => {
                if (data.error) return showToast(data.error, "error");
                showToast("RAM trim sent to " + data.clientCount + " client(s)", "success");
            }).catch(() => showToast("Failed to send trim command", "error"));
        }

        function renderSpyClients(clients) {
            const container = document.getElementById('spy-target-list');
            const currentIds = clients.map(c => c.userId.toString());
            
            const emptyMsg = container.querySelector('.empty-message');
            if(clients.length === 0) { if(!emptyMsg) container.innerHTML = '<div class="empty-message">No clients</div>'; } 
            else if(emptyMsg) emptyMsg.remove();

            Array.from(container.children).forEach(el => {
                if(!el.classList.contains('empty-message') && !currentIds.includes(el.id.replace('spy-c-',''))) el.remove();
            });

            clients.forEach(c => {
                let el = document.getElementById(`spy-c-${c.userId}`);
                if(!el) {
                    el = document.createElement('div'); el.className = 'player-pill'; el.id = `spy-c-${c.userId}`;
                    el.onclick = () => selectSpyClient(c.userId.toString());
                    el.innerHTML = `<img src="${getAvatar(c.userId)}" class="pill-avatar"><div class="pill-info"><div class="pill-name">${c.username}</div><div class="pill-id">${c.userId}</div></div>`;
                    container.appendChild(el);
                }
                if(spySelectedClient === c.userId.toString()) el.classList.add('selected'); else el.classList.remove('selected');
            });
        }

        function selectSpyClient(userId) {
            spySelectedClient = userId;
            spySelectedRemote = null;
            remotesPage = 1; 
            callsPage = 1;
            renderSpyClients(activeClients);
            
            if (!remoteSpyData[userId]) {
                fetch(`/spy/${userId}`).then(r => r.json()).then(data => {
                    remoteSpyData[userId] = data;
                    renderRemotesList();
                });
            } else {
                renderRemotesList();
            }
            renderCallsList();
        }

        function setSpyTab(tab) {
            spyTab = tab;
            spySelectedRemote = null;
            remotesPage = 1;
            document.getElementById('tab-outgoing').classList.toggle('active', tab === 'Outgoing');
            document.getElementById('tab-incoming').classList.toggle('active', tab === 'Incoming');
            renderRemotesList();
            renderCallsList();
        }

        function renderRemotesList() {
            const container = document.getElementById('remotes-list');
            
            if (!spySelectedClient || !remoteSpyData[spySelectedClient]) {
                container.innerHTML = '<div class="empty-message">Select a client</div>';
                document.getElementById('remotes-pagination').innerHTML = '';
                return;
            }
            
            const directionData = remoteSpyData[spySelectedClient][spyTab] || {};
            
            const groupedRemotes = {};
            Object.entries(directionData).forEach(([key, remote]) => {
                const groupKey = remote.name;
                if (!groupedRemotes[groupKey]) {
                    groupedRemotes[groupKey] = {
                        name: remote.name,
                        className: remote.className,
                        path: remote.path,
                        keys: [key],
                        totalCalls: remote.calls.length,
                        calls: [...remote.calls]
                    };
                } else {
                    groupedRemotes[groupKey].keys.push(key);
                    groupedRemotes[groupKey].totalCalls += remote.calls.length;
                    groupedRemotes[groupKey].calls.push(...remote.calls);
                }
            });
            
            const allRemotes = Object.values(groupedRemotes);
            
            if (allRemotes.length === 0) {
                container.innerHTML = `<div class="empty-message">No ${spyTab.toLowerCase()} remotes captured</div>`;
                document.getElementById('remotes-pagination').innerHTML = '';
                return;
            }
            
            const totalPages = Math.ceil(allRemotes.length / ITEMS_PER_PAGE);
            if (remotesPage > totalPages) remotesPage = totalPages;
            if (remotesPage < 1) remotesPage = 1;
            const startIdx = (remotesPage - 1) * ITEMS_PER_PAGE;
            const pageRemotes = allRemotes.slice(startIdx, startIdx + ITEMS_PER_PAGE);
            
            container.innerHTML = pageRemotes.map(r => {
                const isEvent = r.className === 'RemoteEvent' || r.className === 'UnreliableRemoteEvent';
                const isBindable = r.className === 'BindableEvent' || r.className === 'BindableFunction';
                const badgeClass = isEvent ? 'event' : (isBindable ? 'bindable' : 'function');
                const badgeText = isEvent ? 'Event' : (r.className === 'RemoteFunction' ? 'Function' : (r.className === 'BindableEvent' ? 'B.Event' : 'B.Func'));
                const groupKey = r.name;
                const selected = spySelectedRemote === groupKey ? 'selected' : '';
                
                return `<div class="remote-item ${selected}" onclick="selectRemote('${escapeAttr(groupKey)}')"><div class="remote-header"><span class="remote-type-badge ${badgeClass}">${badgeText}</span><span class="remote-name">${escapeHtml(r.name)}</span><span class="remote-count">x${r.totalCalls}</span></div><div class="remote-path">${escapeHtml(r.path)}</div></div>`;
            }).join('');
            
            generatePagination(remotesPage, totalPages, 'setRemotesPage', 'remotes-pagination');
        }
        
        function setRemotesPage(page) {
            remotesPage = page;
            renderRemotesList();
        }

        function escapeAttr(str) {
            return str.replace(/'/g, "\\'").replace(/"/g, '&quot;');
        }

        function selectRemote(remoteName) {
            spySelectedRemote = remoteName;
            callsPage = 1; 
            renderRemotesList();
            renderCallsList();
        }

        function getGroupedCalls() {
            const directionData = remoteSpyData[spySelectedClient]?.[spyTab] || {};
            if (!spySelectedClient || !spySelectedRemote) return [];
            
            const allCalls = [];
            Object.entries(directionData).forEach(([key, remote]) => {
                if (remote.name === spySelectedRemote) {
                    remote.calls.forEach(call => {
                        allCalls.push({ ...call, remotePath: remote.path, code: call.code });
                    });
                }
            });
            
            allCalls.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
            return allCalls;
        }

        function renderCallsList() {
            const container = document.getElementById('calls-list');
            const paginationContainer = document.getElementById('calls-pagination');
            
            if (!spySelectedClient || !spySelectedRemote) {
                container.innerHTML = '<div class="empty-message">Select a remote</div>';
                paginationContainer.innerHTML = '';
                return;
            }
            
            const allCalls = getGroupedCalls();
            
            if (allCalls.length === 0) {
                container.innerHTML = '<div class="empty-message">No calls recorded</div>';
                paginationContainer.innerHTML = '';
                return;
            }
            
            const totalPages = Math.ceil(allCalls.length / ITEMS_PER_PAGE);
            if (callsPage > totalPages) callsPage = totalPages;
            if (callsPage < 1) callsPage = 1;
            const startIdx = (callsPage - 1) * ITEMS_PER_PAGE;
            const pageCalls = allCalls.slice(startIdx, startIdx + ITEMS_PER_PAGE);
            
            const callKey = spySelectedRemote;
            container.innerHTML = pageCalls.map((call, pageIdx) => {
                const globalIdx = startIdx + pageIdx;
                const argsPreview = call.args.join(', ').substring(0, 50);
                const argsHtml = call.args.map((arg, i) => `<div class="arg-row"><span class="arg-index">${i + 1}</span><span class="arg-value">${escapeHtml(arg)}</span></div>`).join('');
                const isExpanded = expandedCalls.has(`${callKey}_${globalIdx}`);
                
                return `<div class="call-item"><div class="call-header" onclick="toggleCall('${escapeAttr(callKey)}', ${globalIdx})"><span class="call-time">${call.timestamp}</span><span class="call-args-preview">${escapeHtml(argsPreview)}${argsPreview.length >= 50 ? '...' : ''}</span></div><div class="call-body ${isExpanded ? 'expanded' : ''}" id="call-body-${globalIdx}">${call.args.length > 0 ? argsHtml : '<div style="color:#555;font-size:0.85rem;">No arguments</div>'}<div class="generated-script">${escapeHtml(call.code)}</div><button class="copy-script-btn" onclick="copyCallScript(${globalIdx})"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>Copy Script</button></div></div>`;
            }).join('');
            
            generatePagination(callsPage, totalPages, 'setCallsPage', 'calls-pagination');
        }
        
        function setCallsPage(page) {
            callsPage = page;
            renderCallsList();
        }

        function toggleCall(callKey, idx) {
            const key = `${callKey}_${idx}`;
            const body = document.getElementById(`call-body-${idx}`);
            if (expandedCalls.has(key)) {
                expandedCalls.delete(key);
                body.classList.remove('expanded');
            } else {
                expandedCalls.add(key);
                body.classList.add('expanded');
            }
        }

        function copyCallScript(idx) {
            const allCalls = getGroupedCalls();
            if (allCalls[idx]) {
                navigator.clipboard.writeText(allCalls[idx].code).then(() => {
                    showToast('Script copied to clipboard!', 'success');
                });
            }
        }

        function showToast(message, type, duration) {
            type = type || 'info';
            duration = duration || 3000;
            var container = document.getElementById('toast-container');
            
            var toasts = container.querySelectorAll('.toast');
            while (toasts.length >= 3) {
                toasts[0].remove();
                toasts = container.querySelectorAll('.toast');
            }
            
            var toast = document.createElement('div');
            toast.className = 'toast ' + type;
            var icons = { success: '✓', error: '✕', info: 'ℹ' };
            toast.innerHTML = '<span class="toast-icon">' + (icons[type] || icons.info) + '</span><span class="toast-message">' + message + '</span><button class="toast-close" onclick="this.parentElement.remove()">×</button>';
            container.appendChild(toast);
            setTimeout(function() { 
                toast.classList.add('hiding'); 
                setTimeout(function() { toast.remove(); }, 300); 
            }, duration);
        }

        function clearRemoteSpy() {
            if (!spySelectedClient) return;
            fetch(`/spy/clear/${spySelectedClient}`, {method:'POST'});
        }

        fetch('/settings').then(r=>r.json()).then(d => {
            document.getElementById('timeout').value = d.disconnectTimeout;
            document.getElementById('remotespy-toggle').checked = d.spyEnabled || false;
            document.getElementById('autotrim-toggle').checked = d.autoTrimEnabled || false;
            document.getElementById('autotrim-target').value = d.autoTrimTargetMB || 750;
            document.getElementById('trim-target-display').textContent = d.autoTrimTargetMB || 750;
            document.getElementById('autotrim-interval').value = d.autoTrimIntervalSeconds || 60;
            if (d.scriptPath) document.getElementById('startup-path').value = d.scriptPath;
        });
        fetch('/get-config').then(r=>r.json()).then(function(d) { 
            savedAccounts = d.accounts || d; 
            accountOrder = d.order || Object.keys(savedAccounts);
            renderConfig(); 
        });
        fetch('/scripts').then(r=>r.json()).then(d => { scriptLibrary = d; renderScriptLibrary(); });

        function updateStartupStatus() {
            fetch('/startup/status').then(r => r.json()).then(data => {
                const statusEl = document.getElementById('startup-status');
                const addBtn = document.getElementById('startup-add-btn');
                const removeBtn = document.getElementById('startup-remove-btn');
                const pathInput = document.getElementById('startup-path');
                
                if (data.enabled) {
                    statusEl.textContent = 'ENABLED';
                    statusEl.style.background = 'rgba(16, 185, 129, 0.15)';
                    statusEl.style.color = 'var(--success)';
                    addBtn.disabled = true;
                    addBtn.style.opacity = '0.5';
                    removeBtn.disabled = false;
                    removeBtn.style.opacity = '1';
                } else {
                    statusEl.textContent = 'DISABLED';
                    statusEl.style.background = 'rgba(113, 113, 122, 0.15)';
                    statusEl.style.color = '#71717a';
                    addBtn.disabled = false;
                    addBtn.style.opacity = '1';
                    removeBtn.disabled = true;
                    removeBtn.style.opacity = '0.5';
                }
                
                if (data.scriptPath) {
                    pathInput.value = data.scriptPath;
                }
            });
        }

        function addToStartup() {
            const scriptPath = document.getElementById('startup-path').value.trim();
            if (!scriptPath) {
                showToast('Please enter the full path to your index.js file', 'error');
                return;
            }
            
            fetch('/startup/add', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ scriptPath })
            }).then(r => r.json()).then(data => {
                if (data.error) {
                    showToast(data.error, 'error');
                } else {
                    showToast(data.message, 'success');
                    updateStartupStatus();
                }
            }).catch(() => showToast('Failed to add to startup', 'error'));
        }

        function removeFromStartup() {
            fetch('/startup/remove', { method: 'POST' })
                .then(r => r.json())
                .then(data => {
                    if (data.error) {
                        showToast(data.error, 'error');
                    } else {
                        showToast(data.message, 'success');
                        updateStartupStatus();
                    }
                }).catch(() => showToast('Failed to remove from startup', 'error'));
        }

        updateStartupStatus();
    </script>
</body>
</html>
