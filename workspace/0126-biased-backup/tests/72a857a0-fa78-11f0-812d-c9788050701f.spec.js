import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/72a857a0-fa78-11f0-812d-c9788050701f.html';

test.describe('Cosmic Linked List - FSM and UI validation', () => {
  // Collect console errors and page errors for each test
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Capture console error messages
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push({
          text: msg.text(),
          location: msg.location()
        });
      }
    });

    // Capture uncaught page errors (e.g., ReferenceError, TypeError)
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Navigate to the application page
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });

    // Ensure initial DOM is ready
    await page.waitForSelector('#visualization');
    await page.waitForSelector('#animateBtn');
  });

  test.afterEach(async () => {
    // Nothing to tear down explicitly; assertions in tests will validate there are no errors
  });

  test.describe('Initial State (S0_Idle) validations', () => {
    test('S0_Idle entry action createLinkedList() produces 4 nodes and 3 connectors', async ({ page }) => {
      // This validates that the createLinkedList() entry action was executed on DOMContentLoaded.
      const nodeCount = await page.locator('.visualization .node').count();
      const connectorCount = await page.locator('.visualization .connector').count();

      // Expect the linked list visualization to contain 4 nodes and 3 connectors
      expect(nodeCount).toBe(4);
      expect(connectorCount).toBe(3);

      // Validate node contents: values A, B, C, D and pointers show next or NULL
      const values = await page.$$eval('.visualization .node .node-value', els => els.map(e => e.textContent.trim()));
      expect(values).toEqual(['A', 'B', 'C', 'D']);

      const pointers = await page.$$eval('.visualization .node .node-pointer', els => els.map(e => e.textContent.trim()));
      expect(pointers[0]).toContain('B');
      expect(pointers[1]).toContain('C');
      expect(pointers[2]).toContain('D');
      expect(pointers[3]).toContain('NULL');

      // Validate initial left positions computed by createLinkedList for desktop width:
      // left = 100 + index * 200 -> [100, 300, 500, 700]
      const lefts = await page.$$eval('.visualization .node', nodes =>
        nodes.map(n => n.style.left)
      );
      const parsedLefts = lefts.map(l => parseInt(l || '0', 10));
      expect(parsedLefts).toEqual([100, 300, 500, 700]);

      // Assert no console errors or page errors occurred during initial load
      expect(consoleErrors.length, `console.error messages: ${JSON.stringify(consoleErrors)}`).toBe(0);
      expect(pageErrors.length, `pageerrors: ${JSON.stringify(pageErrors)}`).toBe(0);
    });
  });

  test.describe('Animating State (S1_Animating) and transitions', () => {
    test('Clicking #animateBtn transitions to S1_Animating and nodes animate then revert (S0_Idle)', async ({ page }) => {
      // Comments:
      // - This test triggers the AnimateNodes event by clicking the button.
      // - It verifies that node inline styles are changed to the animated transform,
      //   connector styles are updated, and then verifies they revert back to the original state.
      const animateBtn = page.locator('#animateBtn');
      await expect(animateBtn).toBeVisible();

      // Click the animate button to trigger animation
      await animateBtn.click();

      // After click, nodes are animated with staggered timeouts:
      // For node 0: delay 0ms, inner timeout 500ms -> it becomes scaled immediately then reverts after ~500ms
      // For node 3 (last): outer delay = 3*300 = 900ms, inner revert after 500ms later -> ~1400ms total
      // We'll check shortly after click for first node being scaled, then wait for full duration and check revert.

      // Wait up to 600ms for the first node to reach animated transform
      await page.waitForFunction(() => {
        const node = document.querySelector('.visualization .node');
        return node && node.style.transform.includes('scale(1.2)');
      }, null, { timeout: 800 });

      // Assert first node inline transform contains the animated transform
      const firstNodeTransform = await page.$eval('.visualization .node', n => n.style.transform);
      expect(firstNodeTransform).toContain('scale(1.2)');

      // Also assert first connector (if exists) got transformed and opacity set to '1' during animation
      const firstConnector = await page.locator('.visualization .connector').first();
      // Only check if connector exists
      if (await firstConnector.count() > 0) {
        // connector inline style should reflect transform or opacity during animation
        const connectorTransform = await firstConnector.evaluate(n => n.style.transform || '');
        const connectorOpacity = await firstConnector.evaluate(n => n.style.opacity || '');
        // During the animation phase we expect transform to be 'scaleX(1.2)' and opacity '1'
        expect(connectorTransform).toContain('scaleX(1.2)');
        expect(connectorOpacity).toBe('1');
      }

      // Wait for full animation cycle to complete (safe margin)
      await page.waitForTimeout(1600);

      // After full animation cycle, all nodes should revert to 'scale(1) translateY(0)'
      const transforms = await page.$$eval('.visualization .node', nodes => nodes.map(n => n.style.transform));
      // Each transform should either be exactly 'scale(1) translateY(0)' or include those values
      transforms.forEach(t => {
        expect(t).toBeTruthy();
        // Allow 'scale(1) translateY(0)' as exact; some browsers may output without spaces - be flexible
        const normalized = t.replace(/\s+/g, '');
        expect(normalized).toContain('scale(1)');
        expect(normalized).toContain('translateY(0)');
      });

      // After completion, connectors should revert to scaleX(1) and opacity to '0.8' for those that exist
      const connectorCount = await page.locator('.visualization .connector').count();
      for (let i = 0; i < connectorCount; i++) {
        const cSel = `.visualization .connector:nth-of-type(${i + 1})`;
        const cTransform = await page.$eval(cSel, el => el.style.transform);
        const cOpacity = await page.$eval(cSel, el => el.style.opacity);
        expect(cTransform).toContain('scaleX(1)');
        // allow '' if not explicitly set, but the code sets '0.8' on revert
        expect(cOpacity === '0.8' || cOpacity === '' || cOpacity === '0.8').toBeTruthy();
      }

      // No console or page errors during animation
      expect(consoleErrors.length, `console.error messages during animation: ${JSON.stringify(consoleErrors)}`).toBe(0);
      expect(pageErrors.length, `page errors during animation: ${JSON.stringify(pageErrors)}`).toBe(0);
    });

    test('Rapid repeated clicks do not produce uncaught exceptions and end in Idle state', async ({ page }) => {
      // Comments:
      // - This edge-case test simulates multiple quick clicks on the animate button to ensure
      //   there are no uncaught exceptions (ReferenceError/TypeError etc.) and that nodes end up reverted.
      const animateBtn = page.locator('#animateBtn');
      await expect(animateBtn).toBeVisible();

      // Rapidly click the button 4 times
      for (let i = 0; i < 4; i++) {
        await animateBtn.click();
      }

      // Wait long enough for all staggered animations to complete
      await page.waitForTimeout(2000);

      // Ensure nodes have reverted to idle transform
      const transforms = await page.$$eval('.visualization .node', nodes => nodes.map(n => n.style.transform));
      transforms.forEach(t => {
        const normalized = (t || '').replace(/\s+/g, '');
        expect(normalized).toContain('scale(1)');
        expect(normalized).toContain('translateY(0)');
      });

      // Ensure no uncaught page errors were emitted
      expect(pageErrors.length, `pageErrors after rapid clicks: ${JSON.stringify(pageErrors)}`).toBe(0);
      // Ensure no console.error messages
      expect(consoleErrors.length, `console.error after rapid clicks: ${JSON.stringify(consoleErrors)}`).toBe(0);
    });
  });

  test.describe('Resizing behavior and mobile layout adjustments', () => {
    test('Window resize triggers createLinkedList() and adjusts node positions for mobile', async ({ page }) => {
      // Comments:
      // - This validates the onResize handler calls createLinkedList() and repositions nodes
      //   to mobile left coordinates: left = 50 + index * 120

      // Resize viewport to mobile width (<768) which should cause createLinkedList to use mobile positions
      await page.setViewportSize({ width: 375, height: 800 });

      // Dispatch a resize event so the page's resize listener runs
      await page.evaluate(() => {
        window.dispatchEvent(new Event('resize'));
      });

      // Wait a tick for DOM changes
      await page.waitForTimeout(200);

      // Read left positions after resize
      const leftsAfterResize = await page.$$eval('.visualization .node', nodes => nodes.map(n => n.style.left));
      const parsedLefts = leftsAfterResize.map(l => parseInt(l || '0', 10));

      // Expected mobile left positions: [50, 170, 290, 410]
      expect(parsedLefts).toEqual([50, 170, 290, 410]);

      // No errors during resize
      expect(consoleErrors.length, `console.errors during resize: ${JSON.stringify(consoleErrors)}`).toBe(0);
      expect(pageErrors.length, `page errors during resize: ${JSON.stringify(pageErrors)}`).toBe(0);
    });
  });

  test.describe('Robustness and error observation', () => {
    test('No unexpected runtime errors (ReferenceError / TypeError / SyntaxError) during interactions', async ({ page }) => {
      // Comments:
      // - Comprehensive smoke test: interact with the app (click, resize) and confirm no uncaught errors were emitted.

      // Interact: click animate, resize to mobile, click again
      await page.click('#animateBtn');
      await page.waitForTimeout(200);
      await page.setViewportSize({ width: 640, height: 800 });
      await page.evaluate(() => window.dispatchEvent(new Event('resize')));
      await page.waitForTimeout(200);
      await page.click('#animateBtn');
      await page.waitForTimeout(1500);

      // Assert that no pageerror events were captured (these correspond to uncaught exceptions)
      expect(pageErrors.length, `Uncaught page errors captured: ${JSON.stringify(pageErrors)}`).toBe(0);

      // Assert no console.error messages were emitted during interactions
      expect(consoleErrors.length, `Console errors captured: ${JSON.stringify(consoleErrors)}`).toBe(0);
    });
  });
});