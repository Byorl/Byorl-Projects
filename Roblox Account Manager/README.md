# BYORL Control

A web-based control panel for managing multiple Roblox accounts with remote execution, auto-rejoining, and remote spy capabilities.

![Node.js](https://img.shields.io/badge/Node.js-18+-green)
![License](https://img.shields.io/badge/License-MIT-blue)

## Features

- **Live Sessions** - Real-time monitoring of connected Roblox clients with status indicators
- **Auto Rejoiner** - Automatically relaunch accounts when they disconnect (requires cookie)
- **Script Executor** - Execute Luau scripts on selected clients with Monaco editor
- **Remote Spy** - Monitor and intercept RemoteEvent/RemoteFunction calls with copy-to-clipboard
- **Output Logs** - View print/warn/error output from connected clients

## Requirements

- Node.js 18+
- A Roblox executor that supports HTTP requests (Volt, Wave, etc.)

## Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/byorl-control.git
cd byorl-control
```

2. Install dependencies:
```bash
npm install
```

3. Start the server:
```bash
node index.js
```

4. Open `http://localhost:5000` in your browser

## Usage

### Connecting a Client

1. Execute `server.lua` in your Roblox executor
2. The client will appear in the "Active Sessions" tab

### Auto Rejoiner Setup

1. Go to "Auto Rejoiner" tab
2. Add your account (Username + User ID)
3. Fill in:
   - **Place ID** - The game's place ID
   - **Job ID** - (Optional) Specific server instance ID
   - **Cookie** - Your `.ROBLOSECURITY` cookie for authenticated launches
4. Enable "Auto-Relaunch" checkbox

### Script Execution

1. Go to "Executor" tab
2. Select target clients from the left panel
3. Write your Luau script in the editor
4. Click "Execute Script"

### Remote Spy

1. Enable "Remote Spy" in Settings
2. Go to "Remote Spy" tab
3. Select a connected client
4. View captured remote calls and copy generated scripts

## Configuration

Settings are saved in:
- `accounts.json` - Saved account configurations
- `settings.json` - Global settings (timeout, spy enabled)

## File Structure

```
├── index.js          # Node.js server
├── server.lua        # Roblox client script
├── public/
│   └── index.html    # Web interface
├── accounts.json     # Account data (auto-generated)
└── settings.json     # Settings (auto-generated)
```

## Security Notes

- Keep your `.ROBLOSECURITY` cookies private
- Don't share your `accounts.json` file
- Run the server locally only

## License

MIT
