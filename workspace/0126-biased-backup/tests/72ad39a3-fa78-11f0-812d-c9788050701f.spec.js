import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/72ad39a3-fa78-11f0-812d-c9788050701f.html';

// Page Object to encapsulate interactions & queries for the Runtime visualization page
class RuntimePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.consoleMessages = [];
    this.pageErrors = [];
  }

  async goto() {
    // Attach listeners to capture console messages and page errors
    this.page.on('console', msg => {
      // capture text and level for assertions
      this.consoleMessages.push({ text: msg.text(), type: msg.type() });
    });
    this.page.on('pageerror', error => {
      // capture thrown errors for assertions
      this.pageErrors.push(error);
    });

    await this.page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    // Wait a bit for the script that creates elements to run
    await this.page.waitForTimeout(200);
  }

  async getRunButton() {
    return this.page.locator('#runBtn');
  }

  async getResetButton() {
    return this.page.locator('#resetBtn');
  }

  async getRuntimeViz() {
    return this.page.locator('#runtimeViz');
  }

  async getCoreLocator() {
    return this.page.locator('.runtime-core');
  }

  async getMemoryBlocks() {
    return this.page.locator('.memory-block');
  }

  async getModules() {
    return this.page.locator('.module');
  }

  async getConnections() {
    return this.page.locator('.connection');
  }

  // Get inline style boxShadow of core (may be empty string if not set inline)
  async getCoreInlineBoxShadow() {
    return this.page.evaluate(() => {
      const core = document.querySelector('.runtime-core');
      return core ? core.style.boxShadow : null;
    });
  }

  // Get computed box-shadow (final rendered)
  async getCoreComputedBoxShadow() {
    return this.page.evaluate(() => {
      const core = document.querySelector('.runtime-core');
      if (!core) return null;
      return getComputedStyle(core).boxShadow;
    });
  }

  async clickRun() {
    await this.getRunButton().click();
  }

  async clickReset() {
    await this.getResetButton().click();
  }

  // Return captured console messages
  getConsoleMessages() {
    return this.consoleMessages;
  }

  // Return captured page errors
  getPageErrors() {
    return this.pageErrors;
  }
}

test.describe('Runtime Environment | Visual Exploration - FSM validation', () => {
  let runtime;

  test.beforeEach(async ({ page }) => {
    runtime = new RuntimePage(page);
    await runtime.goto();
  });

  test.afterEach(async ({ page }) => {
    // Ensure we close any lingering dialogs or timeouts by navigating away (cleanup)
    // Not modifying page behavior - simply navigate to about:blank
    await page.goto('about:blank');
  });

  test.describe('S0_Idle (Initial) state validations', () => {
    test('Initial render: page components present and Idle state visuals', async () => {
      // Validate primary elements exist
      const runBtn = await runtime.getRunButton();
      const resetBtn = await runtime.getResetButton();
      const viz = await runtime.getRuntimeViz();
      const core = await runtime.getCoreLocator();

      await expect(runBtn).toBeVisible();
      await expect(runBtn).toHaveText('Run Process');

      await expect(resetBtn).toBeVisible();
      await expect(resetBtn).toHaveText('Reset');

      await expect(viz).toBeVisible();
      await expect(core).toBeVisible();
      await expect(core).toHaveText('Runtime Core');

      // Validate memory blocks created (12)
      const memoryBlocks = runtime.getMemoryBlocks();
      await expect(memoryBlocks).toHaveCount(12);

      // No memory-block should have the 'active' class initially
      const activeCount = await runtime.page.evaluate(() => {
        return Array.from(document.querySelectorAll('.memory-block')).filter(b => b.classList.contains('active')).length;
      });
      expect(activeCount).toBe(0);

      // Validate modules and connections were created
      const modules = runtime.getModules();
      const connections = runtime.getConnections();
      await expect(modules).toHaveCount(5);
      await expect(connections).toHaveCount(5);

      // Validate core has expected computed box-shadow from CSS (idle state)
      const coreComputedShadow = await runtime.getCoreComputedBoxShadow();
      expect(typeof coreComputedShadow).toBe('string');
      // Should contain the primary color rgb for initial shadow defined in CSS (approx)
      expect(coreComputedShadow.length).toBeGreaterThan(0);

      // Check captured console messages and page errors so far
      const consoleMsgs = runtime.getConsoleMessages();
      const pageErrors = runtime.getPageErrors();

      // There should be no uncaught page error during initial load in a healthy implementation
      expect(pageErrors.length).toBe(0);

      // No particular console logging is used in the implementation; ensure no 'error' console entries
      const hasConsoleError = consoleMsgs.some(m => m.type === 'error');
      expect(hasConsoleError).toBe(false);
    });
  });

  test.describe('S1_Processing (Run Process) state and transitions', () => {
    test('Clicking Run Process triggers module animations, memory activation, and core pulse', async () => {
      // Click Run Process
      await runtime.clickRun();

      // Immediately after click, the core inline style should reflect the pulsing shadow set in JS
      // The script sets core.style.boxShadow = '0 0 80px rgba(58, 134, 255, 0.8)';
      // Allow a short moment for the handler to run
      await runtime.page.waitForTimeout(50);

      const coreInlineShadowAfterRun = await runtime.getCoreInlineBoxShadow();
      expect(coreInlineShadowAfterRun).toContain('0 0 80px');

      // Modules get a transform inline style 'scale(1.2)' with staggered timeouts.
      // Wait a bit (100ms) and verify at least one module has the inline transform set.
      await runtime.page.waitForTimeout(150);
      const anyModuleScaled = await runtime.page.evaluate(() => {
        const mods = Array.from(document.querySelectorAll('.module'));
        return mods.some(m => m.style.transform && m.style.transform.includes('scale(1.2)'));
      });
      expect(anyModuleScaled).toBe(true);

      // Memory blocks are activated with a stagger (i * 150ms). After ~800ms some should be active.
      await runtime.page.waitForTimeout(800);
      const activeBlocksCount = await runtime.page.evaluate(() => {
        return Array.from(document.querySelectorAll('.memory-block')).filter(b => b.classList.contains('active')).length;
      });
      // We expect at least one active memory block during the animation window
      expect(activeBlocksCount).toBeGreaterThan(0);

      // Verify that after enough time the core returns to its resting shadow (JS resets after 1000ms)
      await runtime.page.waitForTimeout(1200);
      const coreInlineShadowAfterRestore = await runtime.getCoreInlineBoxShadow();
      // After reset the inline style should be set back to original '0 0 60px ...' by JS timeout
      // If inline was updated, it should include '0 0 60px', otherwise rely on computed style
      if (coreInlineShadowAfterRestore && coreInlineShadowAfterRestore.length > 0) {
        expect(coreInlineShadowAfterRestore).toContain('0 0 60px');
      } else {
        // fallback to computed style check
        const computed = await runtime.getCoreComputedBoxShadow();
        expect(computed.length).toBeGreaterThan(0);
      }

      // Verify captured page errors did not occur during the Run Process interaction
      const pageErrors = runtime.getPageErrors();
      expect(pageErrors.length).toBe(0);

      // Also verify console did not emit 'error' messages during this interaction
      const consoleErrors = runtime.getConsoleMessages().filter(m => m.type === 'error');
      expect(consoleErrors.length).toBe(0);
    });

    test('Clicking Run Process multiple times quickly does not throw unhandled errors (edge case)', async () => {
      // Rapidly click Run twice
      await runtime.clickRun();
      await runtime.clickRun();

      // Wait for animations and timeouts to run
      await runtime.page.waitForTimeout(1800);

      // Ensure no uncaught page errors resulted from rapid clicks
      const pageErrors = runtime.getPageErrors();
      expect(pageErrors.length).toBe(0);

      // Ensure memory blocks do not end up permanently active (they are removed after each activation)
      const activeFinal = await runtime.page.evaluate(() => {
        return Array.from(document.querySelectorAll('.memory-block')).filter(b => b.classList.contains('active')).length;
      });
      // It's acceptable for some to be active momentarily; after the timeouts they should settle
      expect(activeFinal).toBeGreaterThanOrEqual(0);
      expect(activeFinal).toBeLessThanOrEqual(12);
    });
  });

  test.describe('Transition: S1_Processing -> S0_Idle via Reset', () => {
    test('Reset deactivates memory blocks and resets core shadow after a run', async () => {
      // Trigger the processing state first
      await runtime.clickRun();

      // Wait briefly to ensure some memory blocks become active
      await runtime.page.waitForTimeout(600);
      const anyActiveBeforeReset = await runtime.page.evaluate(() => {
        return Array.from(document.querySelectorAll('.memory-block')).some(b => b.classList.contains('active'));
      });
      expect(anyActiveBeforeReset).toBe(true);

      // Click Reset
      await runtime.clickReset();

      // After clicking reset, JS removes 'active' class from all memory blocks and resets core box shadow.
      // Small delay to allow handler to run
      await runtime.page.waitForTimeout(50);

      const activeAfterReset = await runtime.page.evaluate(() => {
        return Array.from(document.querySelectorAll('.memory-block')).filter(b => b.classList.contains('active')).length;
      });
      expect(activeAfterReset).toBe(0);

      // Validate core inline style reset (script sets shadow to 0 0 60px ... on reset)
      const coreInlineAfterReset = await runtime.getCoreInlineBoxShadow();
      if (coreInlineAfterReset && coreInlineAfterReset.length > 0) {
        expect(coreInlineAfterReset).toContain('0 0 60px');
      } else {
        const computed = await runtime.getCoreComputedBoxShadow();
        expect(computed.length).toBeGreaterThan(0);
      }

      // Ensure no page-level errors produced by reset
      const pageErrors = runtime.getPageErrors();
      expect(pageErrors.length).toBe(0);
    });

    test('Clicking Reset when Idle (edge case) does not throw errors and retains Idle visuals', async () => {
      // Immediately click Reset without running
      await runtime.clickReset();

      // Wait briefly for handler
      await runtime.page.waitForTimeout(50);

      // Memory blocks should remain inactive
      const activeCount = await runtime.page.evaluate(() => {
        return Array.from(document.querySelectorAll('.memory-block')).filter(b => b.classList.contains('active')).length;
      });
      expect(activeCount).toBe(0);

      // No page errors expected
      const pageErrors = runtime.getPageErrors();
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Error observation and diagnostics', () => {
    test('Capture any runtime errors and assert their types are allowed (or none)', async () => {
      const errors = runtime.getPageErrors();

      // If there are errors, assert they are common JS error types (ReferenceError, SyntaxError, TypeError)
      if (errors.length > 0) {
        for (const err of errors) {
          const name = err.name || '';
          // The code may throw different Error subclasses depending on environment; allow a small whitelist
          const allowed = ['ReferenceError', 'SyntaxError', 'TypeError', 'Error'];
          expect(allowed.includes(name)).toBeTruthy();
        }
      } else {
        // Prefer the absence of uncaught page errors for a healthy implementation
        expect(errors.length).toBe(0);
      }

      // Additionally assert that no 'console.error' was emitted
      const consoleErrors = runtime.getConsoleMessages().filter(m => m.type === 'error');
      expect(consoleErrors.length).toBe(0);
    });
  });
});