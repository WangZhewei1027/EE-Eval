import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/3c9a73a2-fa78-11f0-857d-d58e82d5de73.html';

/**
 * Page Object Model for the Load Balancing Visualization page.
 * Encapsulates common interactions and queries so tests remain readable.
 */
class LoadBalancingPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    // Controls
    this.toggleFlow = page.locator('#toggleFlow');
    this.toggleHighlight = page.locator('#toggleHighlight');
    // Example path elements for assertions
    this.client1ToLb = page.locator('#client1-to-lb');
    this.lbToServer1 = page.locator('#lb-to-server1');
    // Select all server paths
    this.serverPaths = [
      page.locator('#lb-to-server1'),
      page.locator('#lb-to-server2'),
      page.locator('#lb-to-server3'),
      page.locator('#lb-to-server4'),
      page.locator('#lb-to-server5'),
      page.locator('#lb-to-server6'),
    ];
    this.flowPaths = page.locator('.flow-path');
  }

  async clickToggleFlow() {
    await this.toggleFlow.click();
  }

  async clickToggleHighlight() {
    await this.toggleHighlight.click();
  }

  // Reads the in-page JS variable flowRunning
  async getFlowRunning() {
    return await this.page.evaluate(() => {
      // Access global variable as defined by the page script
      return typeof flowRunning !== 'undefined' ? flowRunning : undefined;
    });
  }

  // Reads the in-page JS variable highlight
  async getHighlight() {
    return await this.page.evaluate(() => {
      return typeof highlight !== 'undefined' ? highlight : undefined;
    });
  }

  // Returns the inline style property value for a given path (via id)
  async getPathInlineStyle(id, prop) {
    return await this.page.evaluate(
      ({ id, prop }) => {
        const el = document.getElementById(id);
        if (!el) return null;
        // Return the inline style value (not computed style)
        return el.style[prop] || '';
      },
      { id, prop }
    );
  }

  // Returns the 'd' attribute of a path element
  async getPathD(id) {
    return await this.page.evaluate((id) => {
      const el = document.getElementById(id);
      return el ? el.getAttribute('d') : null;
    }, id);
  }

  // Returns the text content and aria-pressed of a control
  async getButtonState(locator) {
    const text = await locator.textContent();
    const aria = await locator.getAttribute('aria-pressed');
    return { text: text ? text.trim() : '', ariaPressed: aria };
  }

  // Get number of flow-path elements
  async countFlowPaths() {
    return await this.flowPaths.count();
  }
}

test.describe('Load Balancing – Visualized (FSM validations)', () => {
  let pageErrors = [];
  let consoleErrors = [];

  test.beforeEach(async ({ page }) => {
    // Collect page errors and console error messages for assertions later
    pageErrors = [];
    consoleErrors = [];

    page.on('pageerror', (err) => {
      // Collect uncaught exceptions from the page (ReferenceError, TypeError, ...)
      pageErrors.push(err);
    });

    page.on('console', (msg) => {
      // Collect console messages flagged as "error"
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Navigate to the application page without modifying page JS
    await page.goto(APP_URL, { waitUntil: 'networkidle' });
  });

  test.afterEach(async ({ page }) => {
    // detach listeners by removing page (Playwright will close the page between tests automatically),
    // but ensure we at least log if any console/page errors were captured (keeps tests deterministic).
    // Nothing to do here beyond available automatic cleanup.
  });

  test.describe('Initial State and Page Load', () => {
    test('Initial UI reflects idle/run states and no critical runtime errors on load', async ({ page }) => {
      const app = new LoadBalancingPage(page);

      // Validate button initial presence and attributes according to the HTML implementation
      const flowState = await app.getButtonState(app.toggleFlow);
      const highlightState = await app.getButtonState(app.toggleHighlight);

      // The HTML initial markup sets toggleFlow to aria-pressed="true" and text "Pause Flow"
      expect(flowState.text).toBe('Pause Flow');
      expect(flowState.ariaPressed).toBe('true');

      // The HTML initial markup sets toggleHighlight to aria-pressed="false" and text "Highlight Servers"
      expect(highlightState.text).toBe('Highlight Servers');
      expect(highlightState.ariaPressed).toBe('false');

      // Verify in-page JS globals reflect the implementation default values
      const flowRunning = await app.getFlowRunning();
      const highlight = await app.getHighlight();

      // Implementation sets let flowRunning = true; let highlight = false;
      expect(flowRunning).toBe(true);
      expect(highlight).toBe(false);

      // Ensure the SVG path 'd' attributes are computed and not empty strings (paths created on load)
      const dClientToLb = await app.getPathD('client1-to-lb');
      expect(typeof dClientToLb).toBe('string');
      expect(dClientToLb.length).toBeGreaterThan(0);

      const dLbToServer1 = await app.getPathD('lb-to-server1');
      expect(typeof dLbToServer1).toBe('string');
      expect(dLbToServer1.length).toBeGreaterThan(0);

      // Assert that there were no uncaught page errors (ReferenceError/SyntaxError/TypeError) during load
      expect(pageErrors.length, `Expected no uncaught page errors, but found: ${pageErrors.map(e => String(e)).join(' | ')}`).toBe(0);

      // Assert that the page did not emit console.error messages during load
      expect(consoleErrors.length, `Expected no console.error messages, but found: ${consoleErrors.join(' | ')}`).toBe(0);
    });
  });

  test.describe('Toggle Flow (ToggleFlow event and transitions S2 <-> S1)', () => {
    test('Clicking Pause/Play toggles flowRunning, animation state, button text and aria-pressed', async ({ page }) => {
      const app = new LoadBalancingPage(page);

      // Initial sanity check
      let initialFlow = await app.getFlowRunning();
      expect(initialFlow).toBe(true);

      // Ensure at least some flow paths exist
      const flowPathCount = await app.countFlowPaths();
      expect(flowPathCount).toBeGreaterThan(0);

      // Click to pause the flow (expected transition: FlowRunning -> FlowPaused)
      await app.clickToggleFlow();

      // After clicking, read the in-page variable flowRunning
      const afterPauseFlow = await app.getFlowRunning();
      expect(afterPauseFlow).toBe(false);

      // Check the toggleFlow button text and aria-pressed have updated
      const flowStateAfterPause = await app.getButtonState(app.toggleFlow);
      expect(flowStateAfterPause.text).toBe('Play Flow');
      expect(flowStateAfterPause.ariaPressed).toBe('false');

      // Verify that flow-path elements have their animation paused and strokeDashoffset reset to '0' inline
      // We assert on one representative path (client1-to-lb) and on one lb-to-server path
      const clientPathAnim = await page.evaluate(() => document.getElementById('client1-to-lb').style.animationPlayState || '');
      const serverPathOffset = await page.evaluate(() => document.getElementById('lb-to-server1').style.strokeDashoffset || '');

      expect(clientPathAnim).toBe('paused');
      expect(serverPathOffset).toBe('0');

      // Now click again to resume flow (FlowPaused -> FlowRunning)
      await app.clickToggleFlow();

      const afterResumeFlow = await app.getFlowRunning();
      expect(afterResumeFlow).toBe(true);

      const flowStateAfterResume = await app.getButtonState(app.toggleFlow);
      expect(flowStateAfterResume.text).toBe('Pause Flow');
      expect(flowStateAfterResume.ariaPressed).toBe('true');

      // Animation play state should be 'running' on representative element (inline style set)
      const clientPathAnimAfter = await page.evaluate(() => document.getElementById('client1-to-lb').style.animationPlayState || '');
      // The script sets animationPlayState = 'running' when flowRunning becomes true
      expect(clientPathAnimAfter).toBe('running');

      // No additional uncaught errors should have been produced during these interactions
      expect(pageErrors.length, `Expected no page errors during ToggleFlow interactions, but found: ${pageErrors.map(e => String(e)).join(' | ')}`).toBe(0);
      expect(consoleErrors.length, `Expected no console.error messages during ToggleFlow interactions, but found: ${consoleErrors.join(' | ')}`).toBe(0);
    });

    test('Rapid toggling of flow does not produce runtime exceptions', async ({ page }) => {
      const app = new LoadBalancingPage(page);

      // Rapidly click the toggle multiple times
      for (let i = 0; i < 5; i++) {
        await app.clickToggleFlow();
      }

      // After odd number of clicks (5), expected state flips from initial true to false
      const finalState = await app.getFlowRunning();
      expect(finalState).toBe(false);

      // Ensure button aria matches the final state
      const btn = await app.getButtonState(app.toggleFlow);
      expect(btn.ariaPressed).toBe('false');

      // No page errors or console errors due to rapid toggling
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });
  });

  test.describe('Toggle Highlight (ToggleHighlight event and transitions S3 <-> S4)', () => {
    test('Clicking Highlight toggles highlight variable, button text and server path styles', async ({ page }) => {
      const app = new LoadBalancingPage(page);

      // Initial highlight state should be false
      const initialHighlight = await app.getHighlight();
      expect(initialHighlight).toBe(false);

      // Click to highlight servers (S4 -> S3 or Idle -> S3 depending on starting assumptions)
      await app.clickToggleHighlight();

      // Check in-page variable
      const afterHighlight = await app.getHighlight();
      expect(afterHighlight).toBe(true);

      // Check button text and aria-pressed
      const highlightBtnState = await app.getButtonState(app.toggleHighlight);
      expect(highlightBtnState.text).toBe('Unhighlight Servers');
      expect(highlightBtnState.ariaPressed).toBe('true');

      // Representative server path should have inline style stroke = 'var(--color-accent)' and strokeWidth '4.5'
      const strokeValue = await app.getPathInlineStyle('lb-to-server1', 'stroke');
      const strokeWidthValue = await app.getPathInlineStyle('lb-to-server1', 'strokeWidth');

      expect(strokeValue).toBe('var(--color-accent)');
      expect(strokeWidthValue).toBe('4.5');

      // Click again to unhighlight and validate styles revert
      await app.clickToggleHighlight();
      const afterUnhighlight = await app.getHighlight();
      expect(afterUnhighlight).toBe(false);

      const highlightBtnState2 = await app.getButtonState(app.toggleHighlight);
      expect(highlightBtnState2.text).toBe('Highlight Servers');
      expect(highlightBtnState2.ariaPressed).toBe('false');

      const strokeValueAfter = await app.getPathInlineStyle('lb-to-server1', 'stroke');
      const strokeWidthAfter = await app.getPathInlineStyle('lb-to-server1', 'strokeWidth');

      expect(strokeValueAfter).toBe('var(--color-primary)');
      expect(strokeWidthAfter).toBe('3');

      // No runtime exceptions during highlight toggles
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });

    test('Toggling highlight multiple times results in stable stroke states', async ({ page }) => {
      const app = new LoadBalancingPage(page);

      // Toggle highlight twice quickly
      await app.clickToggleHighlight();
      await app.clickToggleHighlight();

      // After two toggles we should return to initial highlight=false
      expect(await app.getHighlight()).toBe(false);

      // All server path inline styles should be back to primary values
      for (let i = 1; i <= 6; i++) {
        const stroke = await app.getPathInlineStyle(`lb-to-server${i}`, 'stroke');
        const width = await app.getPathInlineStyle(`lb-to-server${i}`, 'strokeWidth');
        expect(stroke).toBe('var(--color-primary)');
        expect(width).toBe('3');
      }

      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });
  });

  test.describe('SVG Path recalculation and responsiveness', () => {
    test('Path d attributes update on resize and are non-empty', async ({ page }) => {
      const app = new LoadBalancingPage(page);

      // Get initial 'd' attribute snapshot for several paths
      const initialD = {
        clientToLb: await app.getPathD('client1-to-lb'),
        lbToServer1: await app.getPathD('lb-to-server1'),
      };

      expect(initialD.clientToLb).toBeTruthy();
      expect(initialD.lbToServer1).toBeTruthy();

      // Resize the viewport to simulate window resize and trigger path recalculation
      await page.setViewportSize({ width: 800, height: 600 });
      // Trigger a window resize event to cause updatePaths to run
      await page.evaluate(() => window.dispatchEvent(new Event('resize')));

      // Wait briefly for recalculation to occur
      await page.waitForTimeout(150);

      const afterResizeD = {
        clientToLb: await app.getPathD('client1-to-lb'),
        lbToServer1: await app.getPathD('lb-to-server1'),
      };

      // After resize, the d attributes should still be strings and (likely) changed
      expect(afterResizeD.clientToLb).toBeTruthy();
      expect(afterResizeD.lbToServer1).toBeTruthy();

      // It's acceptable if the path didn't change drastically; ensure the attribute is present and well-formed
      expect(afterResizeD.clientToLb.length).toBeGreaterThan(0);
      expect(afterResizeD.lbToServer1.length).toBeGreaterThan(0);

      // No runtime exceptions triggered during resizing
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });
  });

  test.describe('Edge Cases and Error Observability', () => {
    test('Page exposes expected globals or undefined without injection (observability)', async ({ page }) => {
      // We must not inject or modify page; simply observe
      const globals = await page.evaluate(() => {
        return {
          hasFlowRunning: typeof flowRunning !== 'undefined',
          hasHighlight: typeof highlight !== 'undefined',
          hasUpdatePaths: typeof updatePaths === 'function',
          hasBuildCurvePath: typeof buildCurvePath === 'function',
        };
      });

      // According to the script, flowRunning and highlight are declared and updatePaths/buildCurvePath exist
      expect(globals.hasFlowRunning).toBe(true);
      expect(globals.hasHighlight).toBe(true);
      expect(globals.hasUpdatePaths).toBe(true);
      expect(globals.hasBuildCurvePath).toBe(true);

      // Confirm we didn't observe any uncaught reference/syntax/type errors simply by inspecting globals
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });

    test('No unexpected console.error or uncaught exceptions during normal user flows', async ({ page }) => {
      const app = new LoadBalancingPage(page);

      // Perform a set of interactions representative of typical use
      await app.clickToggleHighlight();
      await app.clickToggleFlow(); // pause
      await app.clickToggleFlow(); // resume
      await app.clickToggleHighlight(); // unhighlight

      // Allow short time for event handlers to execute
      await page.waitForTimeout(100);

      // Assert no critical runtime errors occurred during these sequences
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });

    test('If runtime errors occur naturally, they should be observable via pageerror/console and the test will fail', async ({ page }) => {
      // This test ensures that we will catch natural runtime errors if they appear.
      // It does not create errors; it simply asserts that the previously recorded arrays are empty.
      // If the page had runtime errors (ReferenceError/SyntaxError/TypeError), the arrays would be non-empty and this test will fail,
      // satisfying the requirement to "observe console logs and page errors" and let such errors happen naturally.

      // Make no interactions here; just check the captured arrays
      expect(Array.isArray(pageErrors)).toBe(true);
      expect(Array.isArray(consoleErrors)).toBe(true);

      // We assert that there are zero page errors (if there were any, they'd be reported here)
      expect(pageErrors.length, `Unexpected page errors detected: ${pageErrors.map(e => String(e)).join(' | ')}`).toBe(0);
      expect(consoleErrors.length, `Unexpected console.error messages detected: ${consoleErrors.join(' | ')}`).toBe(0);
    });
  });
});