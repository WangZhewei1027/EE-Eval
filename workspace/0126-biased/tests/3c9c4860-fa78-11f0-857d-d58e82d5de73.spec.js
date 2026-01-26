import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/3c9c4860-fa78-11f0-857d-d58e82d5de73.html';

// Page object model for the Neural Network demo page
class NeuralNetPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.canvasSelector = '#nn-canvas';
    this.toggleSelector = '#toggleAnimation';
    this.shuffleSelector = '#shuffleWeights';
    this.tooltipSelector = '#tooltip';
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  async toggleAnimation() {
    await this.page.click(this.toggleSelector);
  }

  async shuffleWeights() {
    await this.page.click(this.shuffleSelector);
  }

  async getToggleText() {
    return this.page.locator(this.toggleSelector).textContent();
  }

  async getToggleAriaPressed() {
    return this.page.getAttribute(this.toggleSelector, 'aria-pressed');
  }

  async getTooltipText() {
    return this.page.locator(this.tooltipSelector).textContent();
  }

  async getTooltipOpacity() {
    // returns computed style opacity as a string (e.g., "1")
    return this.page.$eval(this.tooltipSelector, el => window.getComputedStyle(el).opacity);
  }

  async moveMouseToCanvas(x, y) {
    const rect = await this.page.$eval(this.canvasSelector, el => {
      const r = el.getBoundingClientRect();
      return { left: r.left, top: r.top, width: r.width, height: r.height };
    });
    const clientX = rect.left + x;
    const clientY = rect.top + y;
    await this.page.mouse.move(clientX, clientY);
  }

  async mouseLeaveCanvas() {
    // Move mouse off-canvas area (above)
    const rect = await this.page.$eval(this.canvasSelector, el => el.getBoundingClientRect());
    await this.page.mouse.move(rect.left - 50, rect.top - 50);
    // Fire a leave event explicitly to be safe
    await this.page.$eval(this.canvasSelector, el => el.dispatchEvent(new MouseEvent('mouseleave')));
  }

  async waitForCanvasFlashStart(timeout = 2000) {
    // Wait for inline style boxShadow to become non-empty (flash start)
    await this.page.waitForFunction(selector => {
      const el = document.querySelector(selector);
      return el && el.style && el.style.boxShadow && el.style.boxShadow.trim().length > 0;
    }, this.canvasSelector, { timeout });
  }

  async waitForCanvasFlashEnd(timeout = 3000) {
    // Wait for inline style boxShadow to become empty again (flash end)
    await this.page.waitForFunction(selector => {
      const el = document.querySelector(selector);
      return el && el.style && (!el.style.boxShadow || el.style.boxShadow.trim().length === 0);
    }, this.canvasSelector, { timeout });
  }

  async canvasSize() {
    return this.page.$eval(this.canvasSelector, el => ({ width: el.width, height: el.height, styleWidth: el.style.width, styleHeight: el.style.height }));
  }
}

test.describe('Neural Networks — A Visual Journey (FSM validation)', () => {
  // Capture console errors and page errors globally per test so we can make assertions later
  test.beforeEach(async ({ page }) => {
    // Reset any previously attached listeners by creating new arrays on the page context
    page.setDefaultTimeout(5000);
  });

  test.describe('Setup & Observability', () => {
    test('page loads and initial UI elements exist (S0_Idle entry: init())', async ({ page }) => {
      // This test validates initial Idle state indicators:
      // - Buttons exist and have expected initial labels/ARIA attributes
      // - Tooltip is hidden initially
      // - Canvas exists and has expected dimensions
      const consoleErrors = [];
      const pageErrors = [];

      page.on('console', msg => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
      });
      page.on('pageerror', err => {
        pageErrors.push(err.message);
      });

      const pn = new NeuralNetPage(page);
      await pn.goto();

      // Validate toggle button text and aria-pressed (initially animationActive = true -> "Pause Animation")
      const toggleText = (await pn.getToggleText())?.trim();
      expect(toggleText).toBe('Pause Animation');

      const ariaPressed = await pn.getToggleAriaPressed();
      expect(ariaPressed).toBe('true');

      // Tooltip should be hidden at start (opacity 0 and empty text)
      const tooltipOpacity = await pn.getTooltipOpacity();
      expect(tooltipOpacity).toBe('0');
      const tooltipText = (await pn.getTooltipText()) ?? '';
      expect(tooltipText.trim()).toBe('');

      // Canvas exists and has expected width/height attributes consistent with HTML
      const csize = await pn.canvasSize();
      expect(csize.width).toBeGreaterThan(0);
      expect(csize.height).toBeGreaterThan(0);
      // Style width/height were set in script to pixel values (strings)
      expect(typeof csize.styleWidth).toBe('string');
      expect(typeof csize.styleHeight).toBe('string');

      // Ensure no console errors or page errors happened during load
      expect(consoleErrors, 'No console.error messages on load').toEqual([]);
      expect(pageErrors, 'No uncaught page errors on load').toEqual([]);
    });
  });

  test.describe('Animation Toggle Transitions (S0_Idle <-> S1_AnimationActive <-> S2_AnimationPaused)', () => {
    test('clicking toggle pauses and resumes animation (verifies transitions and aria state)', async ({ page }) => {
      // This test validates ToggleAnimation event behavior and transitions:
      // - S0_Idle -> S2_AnimationPaused when clicked (text becomes "Play Animation", aria-pressed false)
      // - S2_AnimationPaused -> S1_AnimationActive when clicked again (text back to "Pause Animation", aria-pressed true)
      const consoleErrors = [];
      const pageErrors = [];
      page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
      page.on('pageerror', err => pageErrors.push(err.message));

      const pn = new NeuralNetPage(page);
      await pn.goto();

      // Initial checks
      expect((await pn.getToggleText()).trim()).toBe('Pause Animation');

      // Click to toggle -> should pause animation
      await pn.toggleAnimation();
      // After clicking, text should update and aria-pressed toggled to false
      expect((await pn.getToggleText()).trim()).toBe('Play Animation');
      expect(await pn.getToggleAriaPressed()).toBe('false');

      // Click again to resume -> should restore
      await pn.toggleAnimation();
      expect((await pn.getToggleText()).trim()).toBe('Pause Animation');
      expect(await pn.getToggleAriaPressed()).toBe('true');

      // Ensure no runtime errors occurred during toggling
      expect(consoleErrors, 'No console.error during toggle interactions').toEqual([]);
      expect(pageErrors, 'No uncaught page errors during toggle interactions').toEqual([]);
    });

    test('toggle repeatedly to cover edge cases and ensure stable labeling', async ({ page }) => {
      // Rapid toggling to check for stability of label and ARIA attributes
      const pn = new NeuralNetPage(page);
      await pn.goto();

      // Rapidly toggle 5 times
      for (let i = 0; i < 5; i++) {
        await pn.toggleAnimation();
        // After each toggle, ensure text is either "Pause Animation" or "Play Animation" and aria-pressed is boolean string
        const txt = (await pn.getToggleText())?.trim();
        expect(['Pause Animation', 'Play Animation']).toContain(txt);
        const aria = await pn.getToggleAriaPressed();
        expect(['true', 'false']).toContain(aria);
      }
    });
  });

  test.describe('Shuffle Weights & Visual Feedback (ShuffleWeights event)', () => {
    test('clicking shuffle triggers flash effect on canvas while animation active', async ({ page }) => {
      // Validates ShuffleWeights event observable: flashBackground visual feedback is applied to canvas.style.boxShadow
      const consoleErrors = [];
      const pageErrors = [];
      page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
      page.on('pageerror', err => pageErrors.push(err.message));

      const pn = new NeuralNetPage(page);
      await pn.goto();

      // Ensure animation is active at start (based on button aria)
      expect(await pn.getToggleAriaPressed()).toBe('true');

      // Click shuffle and observe transient canvas boxShadow change
      await pn.shuffleWeights();

      // Wait for flash to start and end
      await pn.waitForCanvasFlashStart().catch(() => {
        // If not started within timeout, fail explicitly with a helpful message
        throw new Error('Expected canvas flash to start after shuffle click but it did not.');
      });
      await pn.waitForCanvasFlashEnd().catch(() => {
        throw new Error('Expected canvas flash to end after shuffle click but it did not.');
      });

      // No console/page errors expected
      expect(consoleErrors, 'No console.error during shuffle interaction').toEqual([]);
      expect(pageErrors, 'No uncaught page errors during shuffle interaction').toEqual([]);
    });

    test('clicking shuffle while animation paused still triggers flash (edge case)', async ({ page }) => {
      // Ensures shuffle works in paused state as an edge-case even if FSM lists it primarily under active state.
      const consoleErrors = [];
      const pageErrors = [];
      page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
      page.on('pageerror', err => pageErrors.push(err.message));

      const pn = new NeuralNetPage(page);
      await pn.goto();

      // Pause animation first
      await pn.toggleAnimation();
      expect(await pn.getToggleAriaPressed()).toBe('false');

      // Click shuffle while paused
      await pn.shuffleWeights();

      // The implementation still flashes regardless of animation state; assert flash occurs
      await pn.waitForCanvasFlashStart().catch(() => {
        throw new Error('Expected canvas flash to start after shuffle click while paused but it did not.');
      });
      await pn.waitForCanvasFlashEnd().catch(() => {
        throw new Error('Expected canvas flash to end after shuffle click while paused but it did not.');
      });

      // No runtime errors
      expect(consoleErrors, 'No console.error during shuffle while paused').toEqual([]);
      expect(pageErrors, 'No uncaught page errors during shuffle while paused').toEqual([]);
    });
  });

  test.describe('Hover interactions (MouseMove & MouseLeave events)', () => {
    test('hovering near a neuron shows tooltip with activation info (MouseMove)', async ({ page }) => {
      // This test validates the MouseMove event observable: tooltip becomes visible with layer and activation info
      const consoleErrors = [];
      const pageErrors = [];
      page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
      page.on('pageerror', err => pageErrors.push(err.message));

      const pn = new NeuralNetPage(page);
      await pn.goto();

      // Determine canvas rect to pick a point likely near a neuron.
      // The neurons are laid out across the width with marginX=80 and marginY=60.
      // We'll target a position roughly within the central area where neurons exist.
      const rect = await page.$eval('#nn-canvas', el => el.getBoundingClientRect());
      const targetX = Math.floor(rect.width * 0.5); // center x
      const targetY = Math.floor(rect.height * 0.45); // a bit above center to hit a neuron likely

      // Move mouse to the chosen coordinate relative to canvas
      await pn.moveMouseToCanvas(targetX, targetY);

      // Small delay to allow mousemove handler to update tooltip
      await page.waitForTimeout(150);

      // Tooltip should be visible and contain "Layer" and "Activation"
      const opacity = await pn.getTooltipOpacity();
      expect(parseFloat(opacity)).toBeGreaterThan(0, 'Tooltip should be visible after hovering near a neuron');

      const text = (await pn.getTooltipText()) ?? '';
      // The tooltip text was constructed with "Layer <num> | Neuron <num>\nActivation: <value>%"
      expect(text).toContain('Layer');
      expect(text).toContain('Activation');

      // No console/page errors triggered by mousemove
      expect(consoleErrors).toEqual([]);
      expect(pageErrors).toEqual([]);
    });

    test('moving away or leaving the canvas hides the tooltip (MouseLeave)', async ({ page }) => {
      // Validates that MouseLeave hides tooltip and clears its text content
      const consoleErrors = [];
      const pageErrors = [];
      page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
      page.on('pageerror', err => pageErrors.push(err.message));

      const pn = new NeuralNetPage(page);
      await pn.goto();

      // Hover inside first to ensure tooltip may appear
      const rect = await page.$eval('#nn-canvas', el => el.getBoundingClientRect());
      const insideX = Math.floor(rect.width * 0.5);
      const insideY = Math.floor(rect.height * 0.5);
      await pn.moveMouseToCanvas(insideX, insideY);
      await page.waitForTimeout(150);

      // Now move mouse well outside canvas to trigger mouseleave
      await pn.mouseLeaveCanvas();
      await page.waitForTimeout(100);

      const opacityAfter = await pn.getTooltipOpacity();
      expect(parseFloat(opacityAfter)).toBeLessThanOrEqual(0, 'Tooltip should be hidden after mouseleave');

      const textAfter = (await pn.getTooltipText()) ?? '';
      expect(textAfter.trim()).toBe('', 'Tooltip text should be cleared after mouseleave');

      expect(consoleErrors).toEqual([]);
      expect(pageErrors).toEqual([]);
    });

    test('hovering empty area does not show tooltip (edge case)', async ({ page }) => {
      // Move to corner area well outside neuron cluster to confirm tooltip stays hidden
      const pn = new NeuralNetPage(page);
      await pn.goto();

      // Pick a corner near top-left where margin exists (neurons start around x=80,y>=60)
      await pn.moveMouseToCanvas(10, 10);
      await page.waitForTimeout(100);

      const opacity = await pn.getTooltipOpacity();
      expect(parseFloat(opacity)).toBeLessThanOrEqual(0);

      const text = (await pn.getTooltipText()) ?? '';
      expect(text.trim()).toBe('');
    });
  });

  test.describe('Error monitoring & diagnostics', () => {
    test('no uncaught ReferenceError / SyntaxError / TypeError occurred during scenario flows', async ({ page }) => {
      // This test attaches listeners and runs a sequence of actions to ensure no common runtime errors surface.
      const pageErrors = [];
      const consoleErrors = [];

      page.on('pageerror', err => {
        // Capture full message so we can assert specifics (if any)
        pageErrors.push(err);
      });
      page.on('console', msg => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
      });

      const pn = new NeuralNetPage(page);
      await pn.goto();

      // Perform a set of interactions combining many flows:
      // - toggle, shuffle, hover, shuffle, toggle
      await pn.toggleAnimation();
      await pn.shuffleWeights();
      await page.waitForTimeout(150);
      // Hover center
      const rect = await page.$eval('#nn-canvas', el => el.getBoundingClientRect());
      await pn.moveMouseToCanvas(Math.floor(rect.width * 0.45), Math.floor(rect.height * 0.45));
      await page.waitForTimeout(120);
      await pn.shuffleWeights();
      await pn.toggleAnimation();

      // Allow any asynchronous errors to surface
      await page.waitForTimeout(200);

      // Assert that there were no uncaught page errors
      // If any page errors exist, include them in the failure message to aid debugging
      expect(pageErrors.length, `Expected no uncaught page errors but found: ${pageErrors.map(e => e.message).join(' | ')}`).toBe(0);
      expect(consoleErrors.length, `Expected no console.error messages but found: ${consoleErrors.join(' | ')}`).toBe(0);

      // Additionally ensure none of those errors are specific types
      const allPageErrMessages = pageErrors.map(e => e.message || String(e));
      const containsRef = allPageErrMessages.some(m => /ReferenceError/.test(m));
      const containsSyntax = allPageErrMessages.some(m => /SyntaxError/.test(m));
      const containsType = allPageErrMessages.some(m => /TypeError/.test(m));

      expect(containsRef).toBe(false);
      expect(containsSyntax).toBe(false);
      expect(containsType).toBe(false);
    });
  });
});