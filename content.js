const LOGGING_STORAGE_KEY = "pnl-dd-ratio-logging";

let loggingEnabled = (() => {
  try {
    return localStorage.getItem(LOGGING_STORAGE_KEY) === "true";
  } catch (_) {
    return false;
  }
})();

const setLoggingEnabled = (enabled) => {
  loggingEnabled = !!enabled;
  try {
    localStorage.setItem(
      LOGGING_STORAGE_KEY,
      loggingEnabled ? "true" : "false",
    );
  } catch (_) {}
  updateLoggingToggleDisplay();
  if (loggingEnabled) {
    console.log("[Extension] Logging enabled");
  }
};

const updateLoggingToggleDisplay = () => {
  const btn = document.getElementById("logging-toggle");
  if (!btn) return;
  btn.classList.toggle("active", loggingEnabled);
  btn.title = loggingEnabled
    ? "Disable console logging"
    : "Enable console logging";
};

const extLog = (...args) => {
  if (loggingEnabled) {
    console.log(...args);
  }
};

const extGroup = (...args) => {
  if (loggingEnabled) {
    console.group(...args);
  }
};

const extGroupEnd = () => {
  if (loggingEnabled) {
    console.groupEnd();
  }
};

const extError = (...args) => {
  if (loggingEnabled) {
    console.error(...args);
  }
};

const extWarn = (...args) => {
  if (loggingEnabled) {
    console.warn(...args);
  }
};

const parseNumber = (text) => {
  if (!text) return null;
  const cleaned = text.replace(/[^\d.-−]/g, "").replace("−", "-");
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
};

const logElement = (name, element, level = 0) => {
  if (!loggingEnabled) return;

  const indent = "  ".repeat(level);
  if (!element) {
    extLog(`${indent}[Extension] ${name}: null/undefined`);
    return;
  }

  extGroup(`${indent}[Extension] ${name}:`);
  extLog(`${indent}  Tag:`, element.tagName);
  extLog(`${indent}  ID:`, element.id || "(none)");
  extLog(`${indent}  Classes:`, element.className || "(none)");
  extLog(
    `${indent}  Text content:`,
    (element.textContent || "").substring(0, 100),
  );
  extLog(`${indent}  Children count:`, element.children.length);

  if (element.children.length > 0) {
    extLog(`${indent}  Children:`);
    for (let i = 0; i < Math.min(element.children.length, 10); i++) {
      const child = element.children[i];
      extLog(
        `${indent}    [${i}] ${child.tagName} - classes: ${
          child.className || "(none)"
        } - text: ${(child.textContent || "").substring(0, 50)}`,
      );
    }
    if (element.children.length > 10) {
      extLog(`${indent}    ... and ${element.children.length - 10} more`);
    }
  }

  const attributes = Array.from(element.attributes || []);
  if (attributes.length > 0) {
    extLog(`${indent}  Attributes:`);
    attributes.forEach((attr) => {
      extLog(`${indent}    ${attr.name}: ${attr.value}`);
    });
  }

  extLog(`${indent}  Element:`, element);
  extGroupEnd();
};

const debounce = (func, wait) => {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

const findContainer = () => {
  try {
    const bottomArea = document.getElementById("bottom-area");
    if (!bottomArea) return null;

    const backtestingContainer = bottomArea.querySelector(
      ".bottom-widgetbar-content.backtesting",
    );
    if (!backtestingContainer) return null;

    const reportContainer = backtestingContainer.querySelector(
      '[class^="reportContainer-"]',
    );
    if (!reportContainer) return null;

    const container = reportContainer.querySelector('[class^="container-"]');
    return container;
  } catch (e) {
    extError("[Extension] Error finding container:", e);
    return null;
  }
};

const findPnLValue = () => {
  extLog("[Extension] ========== Starting P&L search ==========");
  try {
    const container = findContainer();
    logElement("Container", container, 0);

    if (!container) {
      extLog("[Extension] ❌ Container not found");
      return null;
    }

    const text = container.textContent || container.innerText || "";
    extLog("[Extension] Container text content:", text);

    const pnlMatch = text.match(/Total\s+P&L\s*([+-−]?[\d,]+\.?\d*)/i);
    extLog(`pnlMatch ${pnlMatch}`);
    if (pnlMatch) {
      const value = parseNumber(pnlMatch[1]);
      if (value !== null) {
        extLog("[Extension] ✅ P&L parsed value:", value);
        return value;
      }
    }

    extLog("[Extension] ❌ P&L pattern not found in text");
  } catch (e) {
    extError("[Extension] ❌ Error finding P&L:", e);
    extError("[Extension] Stack:", e.stack);
  }
  extLog("[Extension] ========== End P&L search ==========");
  return null;
};

const findDrawdownValue = () => {
  extLog("[Extension] ========== Starting Drawdown search ==========");
  try {
    const container = findContainer();
    logElement("Container", container, 0);

    if (!container) {
      extLog("[Extension] ❌ Container not found");
      return null;
    }

    const text = container.textContent || container.innerText || "";
    extLog("[Extension] Container text content:", text);

    const drawdownMatch = text.match(
      /Max\s+equity\s+drawdown\s*([+-]?[\d,]+\.?\d*)/i,
    );
    if (drawdownMatch) {
      const value = Math.abs(parseNumber(drawdownMatch[1]));
      if (value !== null && value > 0) {
        extLog("[Extension] ✅ Drawdown parsed value:", value);
        return value;
      }
    }

    extLog("[Extension] ❌ Drawdown pattern not found in text");
  } catch (e) {
    extError("[Extension] ❌ Error finding drawdown:", e);
    extError("[Extension] Stack:", e.stack);
  }
  extLog("[Extension] ========== End Drawdown search ==========");
  return null;
};

let currentUrl = window.location.href;
let sessionMax = null;
const ratioHistory = [];
const displayState = { mode: "mini" };
const runtime = {
  observer: null,
  fallbackObserver: null,
  updateDebounceTimeoutId: null,
  updateResetTimeoutId: null,
  intervalId: null,
  urlCheckIntervalId: null,
  popstateHandler: null,
  dragHandlers: null,
  container: null,
  isUpdating: false,
  lastUrl: null,
  dragState: {
    isDragging: false,
    currentX: 0,
    currentY: 0,
    initialX: 0,
    initialY: 0,
    xOffset: 0,
    yOffset: 0,
  },
};

const resetSession = () => {
  ratioHistory.length = 0;
  sessionMax = null;
  updateHistoryDisplay();
  updateSessionMaxDisplay();
};

const teardownRuntime = () => {
  if (runtime.updateDebounceTimeoutId) {
    clearTimeout(runtime.updateDebounceTimeoutId);
    runtime.updateDebounceTimeoutId = null;
  }
  if (runtime.updateResetTimeoutId) {
    clearTimeout(runtime.updateResetTimeoutId);
    runtime.updateResetTimeoutId = null;
  }
  if (runtime.intervalId) {
    clearInterval(runtime.intervalId);
    runtime.intervalId = null;
  }
  if (runtime.urlCheckIntervalId) {
    clearInterval(runtime.urlCheckIntervalId);
    runtime.urlCheckIntervalId = null;
  }
  if (runtime.observer) {
    runtime.observer.disconnect();
    runtime.observer = null;
  }
  if (runtime.fallbackObserver) {
    runtime.fallbackObserver.disconnect();
    runtime.fallbackObserver = null;
  }
  if (runtime.popstateHandler) {
    window.removeEventListener("popstate", runtime.popstateHandler);
    runtime.popstateHandler = null;
  }
  if (runtime.dragHandlers) {
    document.removeEventListener("mouseup", runtime.dragHandlers.dragEnd);
    document.removeEventListener("mousemove", runtime.dragHandlers.drag);
    if (runtime.container) {
      runtime.container.removeEventListener(
        "mousedown",
        runtime.dragHandlers.dragStart,
      );
    }
    runtime.dragHandlers = null;
  }
  if (runtime.container) {
    runtime.container.remove();
    runtime.container = null;
  }
  runtime.isUpdating = false;
  runtime.lastUrl = null;
  runtime.dragState.isDragging = false;
  runtime.dragState.currentX = 0;
  runtime.dragState.currentY = 0;
  runtime.dragState.initialX = 0;
  runtime.dragState.initialY = 0;
  runtime.dragState.xOffset = 0;
  runtime.dragState.yOffset = 0;
};

const reinitialize = () => {
  const mode = displayState.mode;
  teardownRuntime();
  resetSession();
  currentUrl = window.location.href;
  displayState.mode = mode;
  init();
};

const checkUrlChange = () => {
  const newUrl = window.location.href;
  if (newUrl !== currentUrl) {
    currentUrl = newUrl;
    resetSession();
  }
};

const updateSessionMax = (ratio) => {
  if (ratio === null || isNaN(ratio)) return;

  if (sessionMax === null || ratio > sessionMax) {
    sessionMax = ratio;
    updateSessionMaxDisplay();
  }
};

const updateSessionMaxDisplay = () => {
  const maxEl = document.getElementById("session-max-value");
  if (!maxEl) return;

  if (sessionMax === null) {
    maxEl.textContent = "-";
    maxEl.className = "session-max-value";
  } else {
    maxEl.textContent = sessionMax.toFixed(2);
    maxEl.className =
      "session-max-value " + (sessionMax >= 0 ? "positive" : "negative");
  }
};

const addToHistory = (ratio, pnl, dd) => {
  if (ratio === null || isNaN(ratio)) return;

  const lastEntry = ratioHistory[ratioHistory.length - 1];
  if (lastEntry && lastEntry.ratio === ratio) {
    return;
  }

  const timestamp = new Date();
  ratioHistory.push({
    ratio: ratio,
    pnl: pnl,
    dd: dd,
    time: timestamp,
  });

  if (ratioHistory.length > 5) {
    ratioHistory.shift();
  }
};

const updateHistoryDisplay = () => {
  const historyEl = document.getElementById("ratio-history");
  if (!historyEl) return;

  if (ratioHistory.length === 0) {
    historyEl.innerHTML = '<div class="history-empty">No history yet</div>';
    return;
  }

  const historyItems = ratioHistory
    .slice()
    .reverse()
    .map((entry, index) => {
      const timeStr = entry.time.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
      const ratioClass =
        entry.ratio >= 0 ? "history-positive" : "history-negative";
      return `
      <div class="history-item">
        <span class="history-ratio ${ratioClass}">${entry.ratio.toFixed(
          2,
        )}</span>
        <span class="history-time">${timeStr}</span>
      </div>
    `;
    })
    .join("");

  historyEl.innerHTML = historyItems;
};

const toggleDisplayMode = () => {
  displayState.mode = displayState.mode === "mini" ? "maxi" : "mini";
  updateDisplayMode();
};

const updateDisplayMode = () => {
  const container = document.getElementById("pnl-dd-ratio-display");
  if (!container) return;

  if (displayState.mode === "mini") {
    container.classList.add("mini-mode");
    container.classList.remove("maxi-mode");
  } else {
    container.classList.add("maxi-mode");
    container.classList.remove("mini-mode");
  }
};

const createRatioDisplay = () => {
  const existing = document.getElementById("pnl-dd-ratio-display");
  if (existing) {
    existing.remove();
  }

  const container = document.createElement("div");
  container.id = "pnl-dd-ratio-display";
  container.className = "mini-mode";
  container.innerHTML = `
    <button class="mode-toggle" id="mode-toggle" title="Toggle mini/maxi mode">⚬</button>
    <div class="ratio-header">P&L / Max DD Ratio</div>
    <div class="ratio-value" id="ratio-value">Calculating...</div>
    <div class="ratio-details">
      <div class="detail-item">
        <span class="detail-label">P&L:</span>
        <span class="detail-value" id="pnl-value">-</span>
      </div>
      <div class="detail-item">
        <span class="detail-label">Max DD:</span>
        <span class="detail-value" id="dd-value">-</span>
      </div>
      <div class="detail-item session-max-item">
        <span class="detail-label">Session Max:</span>
        <span class="detail-value session-max-value" id="session-max-value">-</span>
      </div>
    </div>
    <div class="ratio-history-section">
      <div class="history-header">
        <span>History</span>
        <button class="history-clear" id="history-clear" title="Clear history">🧹</button>
      </div>
      <div class="ratio-history" id="ratio-history">
        <div class="history-empty">No history yet</div>
      </div>
    </div>
    <button class="logging-toggle" id="logging-toggle" title="Enable console logging">🐛</button>
    <button class="ratio-close" id="ratio-close">×</button>
  `;

  document.body.appendChild(container);

  const closeBtn = container.querySelector("#ratio-close");
  closeBtn.addEventListener("click", () => {
    container.style.display = "none";
  });

  const modeToggle = container.querySelector("#mode-toggle");
  modeToggle.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleDisplayMode();
  });

  const historyClear = container.querySelector("#history-clear");
  historyClear.addEventListener("click", (e) => {
    e.stopPropagation();
    reinitialize();
  });

  const loggingToggle = container.querySelector("#logging-toggle");
  loggingToggle.addEventListener("click", (e) => {
    e.stopPropagation();
    setLoggingEnabled(!loggingEnabled);
  });
  updateLoggingToggleDisplay();

  runtime.container = container;
  runtime.dragState.isDragging = false;
  runtime.dragState.currentX = 0;
  runtime.dragState.currentY = 0;
  runtime.dragState.initialX = 0;
  runtime.dragState.initialY = 0;
  runtime.dragState.xOffset = 0;
  runtime.dragState.yOffset = 0;

  const dragStart = (e) => {
    if (
      e.target === closeBtn ||
      e.target === historyClear ||
      e.target === loggingToggle
    )
      return;
    runtime.dragState.initialX = e.clientX - runtime.dragState.xOffset;
    runtime.dragState.initialY = e.clientY - runtime.dragState.yOffset;
    if (e.target === container || container.contains(e.target)) {
      runtime.dragState.isDragging = true;
    }
  };

  const dragEnd = () => {
    runtime.dragState.initialX = runtime.dragState.currentX;
    runtime.dragState.initialY = runtime.dragState.currentY;
    runtime.dragState.isDragging = false;
  };

  const drag = (e) => {
    if (runtime.dragState.isDragging) {
      e.preventDefault();
      runtime.dragState.currentX = e.clientX - runtime.dragState.initialX;
      runtime.dragState.currentY = e.clientY - runtime.dragState.initialY;
      runtime.dragState.xOffset = runtime.dragState.currentX;
      runtime.dragState.yOffset = runtime.dragState.currentY;
      container.style.transform = `translate(${runtime.dragState.currentX}px, ${runtime.dragState.currentY}px)`;
    }
  };

  container.addEventListener("mousedown", dragStart);
  document.addEventListener("mouseup", dragEnd);
  document.addEventListener("mousemove", drag);
  runtime.dragHandlers = { dragStart, dragEnd, drag };

  return container;
};

const updateRatio = () => {
  extLog("[Extension] ===== Updating ratio =====");
  const pnl = findPnLValue();
  const dd = findDrawdownValue();
  extLog("[Extension] Final results - P&L:", pnl, "Drawdown:", dd);

  const ratioValueEl = document.getElementById("ratio-value");
  const pnlValueEl = document.getElementById("pnl-value");
  const ddValueEl = document.getElementById("dd-value");

  if (!ratioValueEl || !pnlValueEl || !ddValueEl) return;

  if (pnl !== null) {
    pnlValueEl.textContent = pnl.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  } else {
    pnlValueEl.textContent = "Not found";
  }

  if (dd !== null) {
    ddValueEl.textContent = dd.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  } else {
    ddValueEl.textContent = "Not found";
  }

  checkUrlChange();

  if (pnl !== null && dd !== null && dd > 0) {
    const ratio = pnl / dd;
    ratioValueEl.textContent = ratio.toFixed(2);
    ratioValueEl.className =
      "ratio-value " + (ratio >= 0 ? "positive" : "negative");

    updateSessionMax(ratio);
    addToHistory(ratio, pnl, dd);
    updateHistoryDisplay();
  } else {
    ratioValueEl.textContent = "N/A";
    ratioValueEl.className = "ratio-value";
  }
};

const init = () => {
  if (!document.body) {
    setTimeout(init, 100);
    return;
  }

  const container = createRatioDisplay();
  runtime.container = container;
  runtime.updateDebounceTimeoutId = null;
  runtime.updateResetTimeoutId = null;
  runtime.isUpdating = false;

  const performUpdate = () => {
    if (!runtime.isUpdating) {
      runtime.isUpdating = true;
      try {
        updateRatio();
      } catch (e) {
        extWarn("Extension: Error updating ratio", e);
      } finally {
        if (runtime.updateResetTimeoutId) {
          clearTimeout(runtime.updateResetTimeoutId);
        }
        runtime.updateResetTimeoutId = setTimeout(() => {
          runtime.isUpdating = false;
          runtime.updateResetTimeoutId = null;
        }, 50);
      }
    }
  };

  runtime.observer = new MutationObserver((mutations) => {
    if (mutations.length > 100) {
      return;
    }
    if (runtime.updateDebounceTimeoutId) {
      clearTimeout(runtime.updateDebounceTimeoutId);
    }
    runtime.updateDebounceTimeoutId = setTimeout(performUpdate, 300);
  });

  const observeBottomArea = () => {
    const bottomArea = document.getElementById("bottom-area");
    if (bottomArea) {
      runtime.observer.observe(bottomArea, {
        childList: true,
        subtree: true,
        characterData: true,
        attributes: false,
      });
      return true;
    }
    return false;
  };

  if (!observeBottomArea()) {
    runtime.fallbackObserver = new MutationObserver(() => {
      if (observeBottomArea()) {
        runtime.fallbackObserver.disconnect();
        runtime.fallbackObserver = null;
      }
    });
    runtime.fallbackObserver.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  setTimeout(() => {
    updateRatio();
    updateSessionMaxDisplay();
  }, 500);

  runtime.intervalId = setInterval(() => {
    checkUrlChange();
    if (!runtime.isUpdating) {
      performUpdate();
    }
  }, 1000);

  runtime.popstateHandler = () => {
    checkUrlChange();
  };
  window.addEventListener("popstate", runtime.popstateHandler);

  runtime.lastUrl = window.location.href;
  runtime.urlCheckIntervalId = setInterval(() => {
    const currentUrl = window.location.href;
    if (currentUrl !== runtime.lastUrl) {
      runtime.lastUrl = currentUrl;
      checkUrlChange();
    }
  }, 500);

  updateDisplayMode();
};

const startInit = () => {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      if (document.readyState === "complete") {
        setTimeout(init, 2000);
      } else {
        window.addEventListener("load", () => {
          setTimeout(init, 2000);
        });
      }
    });
  } else if (document.readyState === "complete") {
    setTimeout(init, 2000);
  } else {
    window.addEventListener("load", () => {
      setTimeout(init, 2000);
    });
  }
};

if (window.requestIdleCallback) {
  requestIdleCallback(startInit, { timeout: 3000 });
} else {
  startInit();
}
