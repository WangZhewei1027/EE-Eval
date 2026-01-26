import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/3c9ae8d2-fa78-11f0-857d-d58e82d5de73.html';

test.describe('Integration Testing — Visual Journey (FSM validation)', () => {
  // Collect runtime console errors and page errors to assert there are none unexpected.
  let consoleErrors = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Capture console errors emitted by the page
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push({ text: msg.text(), location: msg.location() });
      }
    });

    // Capture unhandled page errors (ReferenceError, TypeError, etc.)
    page.on('pageerror', error => {
      pageErrors.push(error && (error.message || String(error)));
    });

    // Navigate to the application page (do not modify the page)
    await page.goto(APP_URL, { waitUntil: 'load' });

    // Wait for key UI elements to be present
    await expect(page.locator('#animateBtn')).toBeVisible();
    await expect(page.locator('#resetBtn')).toBeVisible();
    await expect(page.locator('.node')).toHaveCount(5); // 5 nodes in the diagram
  });

  test.afterEach(async () => {
    // Assert that no unexpected console errors or uncaught page errors occurred during the test.
    // If there are errors, include them in the assertion message for debugging.
    expect(consoleErrors, `Console errors were emitted: ${JSON.stringify(consoleErrors, null, 2)}`).toHaveLength(0);
    expect(pageErrors, `Page errors were emitted: ${JSON.stringify(pageErrors, null, 2)}`).toHaveLength(0);
  });

  // Page object helpers grouped in an object for reuse
  const app = {
    // Retrieve strokeDashoffset and actual path lengths for all flow paths
    async getPathOffsets(page) {
      return page.evaluate(() => {
        const paths = [
          document.getElementById('path1'),
          document.getElementById('path2'),
          document.getElementById('path3'),
          document.getElementById('path4'),
          document.getElementById('path5'),
          document.getElementById('path6'),
          document.getElementById('path7'),
        ];
        return paths.map(p => {
          if (!p) return null;
          // style.strokeDashoffset should have been set by JS; fall back to computed style if necessary
          const styleValue = p.style.strokeDashoffset;
          const computed = window.getComputedStyle(p).getPropertyValue('stroke-dashoffset');
          const offset = (styleValue && styleValue !== '') ? styleValue : computed;
          const len = (() => {
            try {
              return p.getTotalLength();
            } catch (e) {
              return null;
            }
          })();
          return { id: p.id, offset: offset != null ? String(offset).trim() : null, length: len };
        });
      });
    },

    // Click animate button
    async clickAnimate(page) {
      await page.click('#animateBtn');
    },

    // Click reset button
    async clickReset(page) {
      await page.click('#resetBtn');
    },

    // Get animate button's aria-pressed state
    async animatePressed(page) {
      return page.getAttribute('#animateBtn', 'aria-pressed');
    },

    // Get tooltip visibility and text
    async getTooltipState(page) {
      return page.evaluate(() => {
        const tooltip = document.getElementById('tooltip');
        return {
          visible: tooltip.classList.contains('visible'),
          text: tooltip.textContent,
          top: tooltip.style.top,
          left: tooltip.style.left
        };
      });
    },

    // Hover node selector
    async hoverNode(page, selector) {
      await page.hover(selector);
    },

    // Focus node selector
    async focusNode(page, selector) {
      await page.focus(selector);
    },

    // Blur currently focused element
    async blurActive(page) {
      await page.evaluate(() => {
        if (document.activeElement && typeof document.activeElement.blur === 'function') {
          document.activeElement.blur();
        }
      });
    }
  };

  test.describe('FSM States & Transitions', () => {
    test('S0_Idle initial state: resetPaths() applied on load', async ({ page }) => {
      // This test validates the Idle state entry action resetPaths() invoked on load.
      // Expectation: each SVG flow path should have strokeDashoffset equal to its total length,
      // and animate button aria-pressed should be "false".
      const offsets = await app.getPathOffsets(page);

      // All paths should exist and have numeric lengths and offsets set equal to the lengths
      offsets.forEach((p, idx) => {
        expect(p, `path ${idx + 1} should exist`).not.toBeNull();
        expect(typeof p.length, `path ${p && p.id} length should be a number`).toBe('number');
        // style value may be a number-like string (e.g., "300"), ensure it matches the numeric length when coerced
        expect(Number(p.offset), `path ${p.id} strokeDashoffset should equal its length`).toBeCloseTo(Number(p.length), 0);
      });

      // Animate button should be aria-pressed="false" by default (Idle)
      const pressed = await app.animatePressed(page);
      expect(pressed).toBe('false');
    });

    test('AnimateFlow event transitions to S1_Animating and animates paths', async ({ page }) => {
      // This test validates clicking the Animate Flow button triggers animatePaths()
      // and the UI reflects the Animating state (aria-pressed true, at least one path reaches 0 offset).
      // Click the animate button
      await app.clickAnimate(page);

      // Animate button should indicate pressed state
      const pressedAfter = await app.animatePressed(page);
      expect(pressedAfter).toBe('true');

      // Wait up to 3s for animations to start and at least one path to have offset 0 (visible evidence of animatePaths())
      await page.waitForTimeout(1200); // give some time for the JS timeouts and transitions to set the offsets

      // Re-evaluate path offsets
      const offsetsAfter = await app.getPathOffsets(page);
      // At least one path should have offset 0 (string '0' or numeric 0)
      const anyZero = offsetsAfter.some(p => {
        if (!p) return false;
        const off = Number(p.offset);
        return !Number.isNaN(off) && Math.abs(off - 0) < 0.001;
      });
      expect(anyZero, `At least one path should have strokeDashoffset 0 after animation`).toBe(true);

      // Edge-case: clicking animate again should not throw and should still reflect pressed="true"
      await app.clickAnimate(page);
      const pressedAfterSecond = await app.animatePressed(page);
      expect(pressedAfterSecond).toBe('true');
    });

    test('ResetFlow event transitions back to S0_Idle and resetPaths() applied', async ({ page }) => {
      // Ensure we first animate to move into S1_Animating
      await app.clickAnimate(page);
      await page.waitForTimeout(800); // allow some change

      // Now click reset to return to idle
      await app.clickReset(page);

      // After reset, animate button should be aria-pressed="false"
      const pressedAfterReset = await app.animatePressed(page);
      expect(pressedAfterReset).toBe('false');

      // And the strokeDashoffsets should be reset to their lengths
      const offsetsReset = await app.getPathOffsets(page);
      offsetsReset.forEach(p => {
        expect(p).not.toBeNull();
        expect(Number(p.offset), `path ${p.id} offset should equal length after reset`).toBeCloseTo(Number(p.length), 0);
      });

      // Edge-case: clicking reset repeatedly should not cause errors and should leave offsets at lengths
      await app.clickReset(page);
      const offsetsResetAgain = await app.getPathOffsets(page);
      offsetsResetAgain.forEach(p => {
        expect(Number(p.offset)).toBeCloseTo(Number(p.length), 0);
      });
    });
  });

  test.describe('Tooltip Behavior (Show/Hide on Hover & Focus)', () => {
    test('ShowTooltip and HideTooltip via mouseenter/mouseleave', async ({ page }) => {
      // This test verifies tooltips appear on hover and disappear on mouse leave.
      const nodeSelector = '.node.requirements';
      // Hover to trigger mouseenter handler
      await app.hoverNode(page, nodeSelector);

      // Allow microtask to run
      await page.waitForTimeout(120);

      const tooltipState = await app.getTooltipState(page);
      expect(tooltipState.visible, 'Tooltip should be visible after mouseenter').toBe(true);
      expect(tooltipState.text).toContain('Requirements Gathering');

      // Move mouse away to hide tooltip
      await page.mouse.move(0, 0);
      await page.waitForTimeout(120);

      const tooltipAfterLeave = await app.getTooltipState(page);
      expect(tooltipAfterLeave.visible, 'Tooltip should not be visible after mouseleave').toBe(false);
    });

    test('ShowTooltipFocus and HideTooltipBlur via focus/blur (keyboard accessibility)', async ({ page }) => {
      // This test verifies tooltips appear on focus and disappear on blur.
      const nodeSelector = '.node.integration-tests';
      // Focus the node
      await app.focusNode(page, nodeSelector);

      // Allow microtask to run
      await page.waitForTimeout(120);

      const tooltipState = await app.getTooltipState(page);
      expect(tooltipState.visible, 'Tooltip should be visible after focus').toBe(true);
      expect(tooltipState.text).toContain('Integration Testing');

      // Blur by moving focus to body
      await app.blurActive(page);
      await page.waitForTimeout(120);

      const tooltipAfterBlur = await app.getTooltipState(page);
      expect(tooltipAfterBlur.visible, 'Tooltip should not be visible after blur').toBe(false);
    });

    test('Tooltip positioning should update relative to the node bounding box', async ({ page }) => {
      // Verify tooltip top/left are set after showing (basic sanity of positioning math)
      const selector = '.node.system-tests';
      await app.hoverNode(page, selector);
      await page.waitForTimeout(120);
      const tooltipState = await app.getTooltipState(page);
      expect(tooltipState.visible).toBe(true);
      // top and left style values should be non-empty strings (pixel values)
      expect(typeof tooltipState.top).toBe('string');
      expect(tooltipState.top.length).toBeGreaterThan(0);
      expect(typeof tooltipState.left).toBe('string');
      expect(tooltipState.left.length).toBeGreaterThan(0);
      // hide afterwards
      await page.mouse.move(0, 0);
      await page.waitForTimeout(120);
    });
  });

  test.describe('Edge Cases & Robustness', () => {
    test('Repeated animate and reset cycles do not produce errors and maintain invariants', async ({ page }) => {
      // Click animate & reset multiple times to exercise the timing logic and ensure no runtime exceptions
      for (let i = 0; i < 3; i++) {
        await app.clickAnimate(page);
        // Wait a bit for timeouts/transitions to apply
        await page.waitForTimeout(600);
        // Expect animate pressed true
        expect(await app.animatePressed(page)).toBe('true');

        await app.clickReset(page);
        await page.waitForTimeout(200);
        // Expect animate pressed false
        expect(await app.animatePressed(page)).toBe('false');

        // Offsets should be reset to lengths after reset
        const offsets = await app.getPathOffsets(page);
        offsets.forEach(p => {
          expect(Number(p.offset)).toBeCloseTo(Number(p.length), 0);
        });
      }
    });

    test('No uncaught runtime errors occur when interacting rapidly', async ({ page }) => {
      // Rapid interactions: hover, focus, click animate, click reset, blur, move mouse
      const actions = [
        async () => app.hoverNode(page, '.node.requirements'),
        async () => app.focusNode(page, '.node.unit-tests'),
        async () => page.click('#animateBtn'),
        async () => page.click('#resetBtn'),
        async () => app.blurActive(page),
        async () => page.mouse.move(10, 10)
      ];

      // Perform actions in quick succession
      for (const act of actions) {
        await act();
      }

      // Allow any pending microtasks or timeouts to run
      await page.waitForTimeout(800);

      // Assert no page errors or console errors were emitted during this burst
      expect(consoleErrors).toHaveLength(0);
      expect(pageErrors).toHaveLength(0);
    });
  });
});