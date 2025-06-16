# Element Toggle Chrome Extension

A powerful Chrome extension that allows you to pick and toggle the visibility of webpage elements with precision. Features visual element picking, DevTools integration, smart selector matching, keyboard shortcuts, and persistent storage across sessions.

## Features

### **Element Selection**
- **Visual Element Picker**: Select elements using an intuitive crosshair cursor with live highlighting
- **DevTools Integration**: Paste selectors directly from Chrome DevTools for precise targeting
- **Smart Selector Matching**: Automatically handles dynamic CSS classes and framework-generated selectors

### **Element Management**
- **Toggle Visibility**: Show/hide elements with smooth toggle switches
- **Bulk Actions**: Hide or show all tracked elements at once
- **Custom Naming**: Edit element names for easy identification
- **Element Preview**: See element content preview and CSS selectors

### **Keyboard Shortcuts**
- **Customizable Hotkeys**: Assign your own keyboard shortcuts for quick access
- **Hide All**: Set a hotkey to instantly hide all tracked elements
- **Show All**: Set a hotkey to instantly show all tracked elements

### **Data Management**
- **Persistent Storage**: Elements tracked per website and remembered across sessions
- **Import/Export**: Save and share element configurations as JSON files
- **Auto-Restore**: Optionally restore hidden elements automatically on page load

## Installation

1. **Download** or clone this repository
2. **Open Chrome** and navigate to `chrome://extensions/`
3. **Enable Developer Mode** in the top right corner
4. **Click "Load unpacked"** and select the extension directory
5. **Pin the extension** to your toolbar for easy access

## Usage Guide

### Adding Elements (Visual Picker)

1. **Click the extension icon** in your Chrome toolbar
2. **Click "Pick Element"** button
3. **Click the desired element** to add it to your tracking list
4. **Press Escape** to cancel selection at any time

### Adding Elements (DevTools Method)

1. **Open Chrome DevTools** (F12)
2. **Right-click any element** in the Elements panel
3. **Select "Copy → Copy selector"**
4. **Open the extension popup**
5. **Paste the selector** in the "DevTools selector" input field
6. **Click "Add Element"** or press Enter

### Managing Element Visibility

1. **Open the extension popup**
2. **Use individual toggles** to show/hide specific elements
3. **Use "Show All" / "Hide All"** for bulk operations
4. **Edit element names** by clicking the edit (✏️) button
5. **Remove elements** by clicking the delete (×) button

### Setting Up Keyboard Shortcuts

1. **Go to Settings** in the extension popup
2. **Click "Open Shortcuts Settings"**
3. **Find "Element Toggle"** in the list
4. **Click the pencil icon** next to each command
5. **Assign your preferred key combinations**

### Import/Export Settings

**Export:**
- Click "Export Settings" to download a JSON file with your configurations

**Import:**
- Click "Import Settings" and select a previously exported JSON file
- Choose to import to current page or original hostname

## Configuration Options

### Selector Matching Methods

- **Exact Match**: Uses selectors exactly as captured (faster, less flexible)
- **Smart Pattern**: Adapts selectors for dynamic frameworks (React, Angular, Vue)

### Auto-Restore Settings

- **Enabled**: Automatically restores element states when visiting pages. This setting might not always work.
- **Disabled**: Manual control only (default for reliability)

## Troubleshooting

### **Element Not Found**
- **Check Selector Validity**: Ensure CSS selector syntax is correct
- **Try Smart Matching**: Switch to smart pattern mode in settings
- **Use DevTools**: Copy a more specific selector from DevTools
- **Check Parent Elements**: Sometimes parent selectors are more stable
- **Reload The Page**: Try reloading or hitting F5

### **Auto-Restore Issues**
- **Disable Auto-Restore**: Manual control is more reliable
- **Check Selector Changes**: Website updates might change element selectors
- **Re-pick Elements**: Capture fresh selectors if page structure changed

### **Hotkeys Not Working**
- **Check Assignment**: Ensure hotkeys are assigned in `chrome://extensions/shortcuts`
- **Avoid Conflicts**: Choose combinations not used by other applications
- **Page Context**: Hotkeys only work on pages with tracked elements

## Version History

- **v1.0**: Initial release with comprehensive feature set
  - Visual element picker with live highlighting
  - DevTools integration for precise element targeting
  - Smart selector matching for dynamic frameworks
  - Customizable keyboard shortcuts
  - Import/export functionality
  - Advanced settings with dedicated interface
  - Bulk element management
  - Cross-session persistence

## License

This project is open source. Feel free to contribute, report issues, or suggest improvements!

---