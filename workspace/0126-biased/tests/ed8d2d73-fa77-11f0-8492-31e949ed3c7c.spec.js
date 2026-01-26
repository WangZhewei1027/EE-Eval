import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/ed8d2d73-fa77-11f0-8492-31e949ed3c7c.html';

// Page object for the Suffix Tree Visualization page
class SuffixTreePage {
  constructor(page) {
    this.page = page;
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  async drawButton() {
    return this.page.locator('#drawBtn');
  }

  async clearButton() {
    return this.page.locator('#clearBtn');
  }

  async canvasHandle() {
    return this.page.locator('#canvas');
  }

  // Returns the canvas data URL (PNG) as a string
  async getCanvasDataURL() {
    return this.page.evaluate(() => {
      const c = document.getElementById('canvas');
      // toDataURL works even if canvas has no explicit width/height attributes (defaults exist)
      return c.toDataURL();
    });
  }

  // Click the draw button
  async clickDraw() {
    await this.page.click('#drawBtn');
  }

  // Click the clear button
  async clickClear() {
    await this.page.click('#clearBtn');
  }

  // Returns whether the canvas currently has the 'hover' class
  async isCanvasHovering() {
    return this.page.evaluate(() => {
      const c = document.getElementById('canvas');
      return c.classList.contains('hover');
    });
  }

  // Wait for canvas to gain hover class (used after drawing)
  async waitForHover(timeout = 2000) {
    await this.page.waitForFunction(() => {
      const c = document.getElementById('canvas');
      return c && c.classList.contains('hover');
    }, null, { timeout });
  }

  // Wait for canvas to lose hover class (after the hover timeout)
  async waitForNoHover(timeout = 3000) {
    await this.page.waitForFunction(() => {
      const c = document.getElementById('canvas');
      return c && !c.classList.contains('hover');
    }, null, { timeout });
  }
}

test.describe('Suffix Tree Visualization - FSM states and transitions', () => {
  let page;
  let suffixPage;
  let pageErrors = [];
  let consoleMessages = [];

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    pageErrors = [];
    consoleMessages = [];

    // Capture runtime page errors
    page.on('pageerror', (err) => {
      // store full error message (keeps reason if any)
      pageErrors.push(err && err.message ? err.message : String(err));
    });

    // Capture console messages (we will flag console.error types)
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    suffixPage = new SuffixTreePage(page);
    await suffixPage.goto();
  });

  test.afterEach(async () => {
    // Close the page to clean up between tests
    await page.close();
  });

  test('Idle state: initial render includes required components and handlers', async () => {
    // This test validates the initial Idle state (S0_Idle):
    // - Buttons and canvas are present
    // - The on-page functions referenced by the FSM exist or are absent as implemented
    // - No unexpected runtime errors occurred during initial load

    // Ensure main components exist in the DOM
    const drawBtn = await suffixPage.drawButton();
    const clearBtn = await suffixPage.clearButton();
    const canvas = await suffixPage.canvasHandle();

    await expect(drawBtn).toBeVisible();
    await expect(clearBtn).toBeVisible();
    await expect(canvas).toBeVisible();

    // Validate the button labels match the FSM evidence
    await expect(drawBtn).toHaveText('Draw Suffix Tree');
    await expect(clearBtn).toHaveText('Clear Canvas');

    // Validate that functions referenced in the HTML script are present in the global scope
    // - drawTree and clearCanvas should be implemented
    const drawTreeExists = await page.evaluate(() => typeof drawTree === 'function');
    const clearCanvasExists = await page.evaluate(() => typeof clearCanvas === 'function');
    expect(drawTreeExists).toBe(true);
    expect(clearCanvasExists).toBe(true);

    // The FSM mentions an entry action renderPage() for S0, but the HTML does not implement it.
    // Verify that renderPage is not defined rather than throwing on load (i.e., it's undefined).
    const renderPageExists = await page.evaluate(() => typeof renderPage !== 'undefined');
    expect(renderPageExists).toBe(false);

    // Verify that the button onclick handlers reference the functions (assignment evidence)
    const drawOnclickIsFunction = await page.evaluate(() => {
      const btn = document.getElementById('drawBtn');
      // It's possible the onclick property points to the function drawTree
      return btn && typeof btn.onclick === 'function' && btn.onclick === drawTree;
    });
    const clearOnclickIsFunction = await page.evaluate(() => {
      const btn = document.getElementById('clearBtn');
      return btn && typeof btn.onclick === 'function' && btn.onclick === clearCanvas;
    });
    expect(drawOnclickIsFunction).toBe(true);
    expect(clearOnclickIsFunction).toBe(true);

    // Ensure no uncaught page errors during load
    expect(pageErrors).toEqual([]);
    // Ensure there are no console.error messages emitted during load
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('DrawTree event transitions to Tree Drawn: canvas content changes and hover effect occurs', async () => {
    // This test validates the DrawTree transition (S0_Idle -> S1_TreeDrawn)
    // - Clicking Draw Suffix Tree invokes drawTree()
    // - The canvas shows visual changes (by comparing dataURLs)
    // - The hover class is added and then removed (onEnter/onExit visual feedback)
    // - No runtime errors occur during the process

    // Capture initial blank canvas data URL
    const initialDataURL = await suffixPage.getCanvasDataURL();

    // Click draw button to trigger drawTree()
    await suffixPage.clickDraw();

    // The implementation adds the 'hover' class and removes it after 500ms.
    // Wait for hover class to appear, then disappear.
    await suffixPage.waitForHover(1500); // should appear quickly
    expect(await suffixPage.isCanvasHovering()).toBe(true);

    // Wait until the hover class is removed (onExit visual feedback)
    await suffixPage.waitForNoHover(2000);
    expect(await suffixPage.isCanvasHovering()).toBe(false);

    // Get canvas data after drawing; it should differ from the initial blank canvas
    const afterDrawDataURL = await suffixPage.getCanvasDataURL();
    expect(afterDrawDataURL).toBeTruthy();
    // It's expected that something was drawn, so the data URLs should not be identical
    expect(afterDrawDataURL).not.toBe(initialDataURL);

    // Verify that drawTree() exists (S1 entry action) and was callable
    const drawTreeType = await page.evaluate(() => typeof drawTree);
    expect(drawTreeType).toBe('function');

    // Ensure no uncaught page errors during drawing
    expect(pageErrors).toEqual([]);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('ClearCanvas event clears the canvas and returns to Idle state', async () => {
    // This test validates the ClearCanvas transition (S1_TreeDrawn -> S0_Idle)
    // - After drawing, clicking Clear Canvas should clear the canvas content
    // - The cleared canvas should match the original blank canvas dataURL
    // - No runtime errors occur during clearing

    // Ensure we start with blank canvas
    const blankDataURL = await suffixPage.getCanvasDataURL();

    // Draw first to populate the canvas
    await suffixPage.clickDraw();
    await suffixPage.waitForHover(1500);
    await suffixPage.waitForNoHover(2000);

    const populatedDataURL = await suffixPage.getCanvasDataURL();
    expect(populatedDataURL).not.toBe(blankDataURL); // ensure drawing changed canvas

    // Click the clear button to revert to blank canvas
    await suffixPage.clickClear();

    // After clearing, the data URL should match the initial blank state
    const afterClearDataURL = await suffixPage.getCanvasDataURL();
    expect(afterClearDataURL).toBe(blankDataURL);

    // Confirm clearCanvas exists as an implemented function (S2 entry action)
    const clearCanvasType = await page.evaluate(() => typeof clearCanvas);
    expect(clearCanvasType).toBe('function');

    // Ensure no runtime errors during clearing
    expect(pageErrors).toEqual([]);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Edge cases: repeated clears and multiple draws do not produce errors', async () => {
    // This test checks robustness:
    // - Clicking clear repeatedly when canvas is already clear should not throw
    // - Clicking draw multiple times should produce repeated hover effects and not throw

    // Start with a known blank canvas
    const blankBefore = await suffixPage.getCanvasDataURL();

    // Click clear multiple times
    await suffixPage.clickClear();
    await suffixPage.clickClear();
    await suffixPage.clickClear();

    // Canvas should remain blank and no errors should have been emitted
    const blankAfterClears = await suffixPage.getCanvasDataURL();
    expect(blankAfterClears).toBe(blankBefore);

    // Click draw several times in succession and observe hover each time
    const drawCount = 3;
    const dataURLs = [];
    for (let i = 0; i < drawCount; i++) {
      await suffixPage.clickDraw();
      // For robustness, wait for hover and removal each time
      await suffixPage.waitForHover(1500);
      await suffixPage.waitForNoHover(2000);
      const url = await suffixPage.getCanvasDataURL();
      dataURLs.push(url);
    }

    // Ensure that at least one of the draws produced a non-blank canvas
    const anyNonBlank = dataURLs.some(u => u !== blankBefore);
    expect(anyNonBlank).toBe(true);

    // Ensure repeated actions did not trigger page errors
    expect(pageErrors).toEqual([]);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Implementation evidence checks: event handler assignments exist as described in FSM', async () => {
    // This test asserts the evidence strings from the FSM are reflected in the page:
    // - The draw button onclick is assigned to drawTree
    // - The clear button onclick is assigned to clearCanvas
    // - We assert these assignments without modifying any page code

    const handlersMatch = await page.evaluate(() => {
      const drawBtn = document.getElementById('drawBtn');
      const clearBtn = document.getElementById('clearBtn');

      return {
        drawAssigned: !!drawBtn && drawBtn.onclick === drawTree,
        clearAssigned: !!clearBtn && clearBtn.onclick === clearCanvas
      };
    });

    expect(handlersMatch.drawAssigned).toBe(true);
    expect(handlersMatch.clearAssigned).toBe(true);

    // Also assert ctx is available on the page script scope (the implementation uses it)
    const ctxExists = await page.evaluate(() => typeof ctx !== 'undefined' && ctx && typeof ctx.fillText === 'function');
    expect(ctxExists).toBe(true);

    // No runtime errors expected
    expect(pageErrors).toEqual([]);
  });
});