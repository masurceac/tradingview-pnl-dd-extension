# How to Debug the Extension

## Viewing Extension Logs

Content script logs appear in the **page's console**, not the extension's console. Here's how to view them:

### Step 1: Open Developer Tools on TradingView

1. Navigate to TradingView.com and open a page with strategy tester
2. Press **F12** (or **Cmd+Option+I** on Mac, or right-click → "Inspect")
3. This opens Chrome DevTools

### Step 2: View Console Tab

1. Click on the **"Console"** tab in DevTools
2. You should see logs prefixed with `[Extension]`

### Step 3: Filter Extension Logs

To see only extension logs:
1. In the console filter box, type: `Extension`
2. Or use the filter icon and enter: `[Extension]`

## What the Logs Show

The extension logs each step of finding P&L and Drawdown values:

- `[Extension] Starting P&L search...` - Beginning of search
- `[Extension] bottom-area found: true/false` - Whether the main container exists
- `[Extension] ✅` - Success indicators
- `[Extension] ❌` - Failure indicators with details
- `[Extension] Final results` - The final extracted values

## Common Issues

### No logs appear
- Make sure you're on a TradingView page (`*.tradingview.com`)
- Reload the page after installing/updating the extension
- Check if the extension is enabled in `chrome://extensions/`

### Logs show "not found" at each step
- The page structure might be different
- Check the actual DOM structure in Elements tab
- The strategy tester might not be loaded yet (wait a few seconds)

### Extension not running
1. Go to `chrome://extensions/`
2. Find "TradingView P&L/Drawdown Ratio"
3. Make sure it's enabled (toggle is ON)
4. Click the refresh icon to reload the extension
5. Reload the TradingView page

## Inspecting the DOM

To see the actual structure:

1. Open DevTools (F12)
2. Go to **Elements** tab
3. Use the element picker (top-left icon) or press **Ctrl+Shift+C** (Cmd+Shift+C on Mac)
4. Click on the P&L or Drawdown value in the page
5. This will highlight the element in the Elements panel
6. Right-click the element → "Copy" → "Copy selector" to get the exact selector

## Testing Selectors

You can test selectors directly in the console:

```javascript
// Test if bottom-area exists
document.getElementById('bottom-area')

// Test backtesting container
document.querySelector('.bottom-widgetbar-content.backtesting')

// Test report container
document.querySelector('[class^="reportContainerOld-"]')
```

## Reporting Issues

When reporting issues, include:
1. Screenshot of the console logs
2. The actual DOM structure (from Elements tab)
3. The exact selectors you see in the page
4. Any error messages

