import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f1f8ec00-fa77-11f0-a6a1-c765f41a13c7.html';

/**
 * Page object encapsulating interactions and queries for the AST visual page.
 */
class ASTPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.regen = page.locator('#regenBtn');
    this.toggle = page.locator('#toggleAnim');
    this.panel = page.locator('#rootPanel');
    this.nodesGroup = page.locator('#nodes');
    this.linksGroup = page.locator('#links');
    this.svg = page.locator('#svg');
    this.defs = page.locator('#svg defs');
  }

  async waitForInitialRender(timeout = 3000) {
    // Wait until nodes group has at least one child node (rendered tree)
    await this.page.waitForFunction(() => {
      const nodes = document.getElementById('nodes');
      return nodes && nodes.children && nodes.children.length > 0;
    }, null, { timeout });
  }

  async getNodesCount() {
    return this.page.evaluate(() => {
      const nodes = document.getElementById('nodes');
      return nodes ? nodes.children.length : 0;
    });
  }

  async getLinksCount() {
    return this.page.evaluate(() => {
      const links = document.getElementById('links');
      return links ? links.children.length : 0;
    });
  }

  async getClipPathCount() {
    return this.page.evaluate(() => {
      const defs = document.querySelector('#svg defs');
      if (!defs) return 0;
      // count clipPath entries whose id starts with 'clip-'
      return Array.from(defs.children).filter(n => n.id && n.id.startsWith('clip-')).length;
    });
  }

  async isPaused() {
    return this.page.evaluate(() => {
      const panel = document.getElementById('rootPanel');
      return document.documentElement.classList.contains('paused') && panel.classList.contains('paused');
    });
  }

  async toggleAnimation() {
    await this.toggle.click();
  }

  async regenerate() {
    await this.regen.click();
  }

  async getToggleText() {
    return this.toggle.textContent();
  }

  async getRegenText() {
    return this.regen.textContent();
  }
}

test.describe('AST Visual — f1f8ec00-fa77-11f0-a6a1-c765f41a13c7', () => {
  let consoleErrors = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    // Reset logs
    consoleErrors = [];
    pageErrors = [];

    // Capture console error messages
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push({ text: msg.text(), location: msg.location() });
      }
    });

    // Capture page errors (uncaught exceptions)
    page.on('pageerror', (err) => {
      pageErrors.push({ message: err.message, stack: err.stack });
    });

    // Navigate to the application page
    await page.goto(APP_URL);
  });

  test('Initial state: Idle -> Tree Generated (S0_Idle then S1_TreeGenerated)', async ({ page }) => {
    const ast = new ASTPage(page);

    // Wait for the initial render (refresh is called in the page script on load)
    await ast.waitForInitialRender();

    // Validate UI controls are present and have expected initial labels
    await expect(ast.regen).toBeVisible();
    await expect(ast.toggle).toBeVisible();

    const regenText = (await ast.getRegenText()) || '';
    const toggleText = (await ast.getToggleText()) || '';

    // Buttons contain expected labels per FSM/components evidence
    expect(regenText.includes('Regenerate')).toBeTruthy();
    expect(toggleText.trim().includes('Pause')).toBeTruthy();

    // Validate that nodes and links were rendered -> S1_TreeGenerated evidence (render(currentTree))
    const nodesCount = await ast.getNodesCount();
    const linksCount = await ast.getLinksCount();

    expect(nodesCount).toBeGreaterThan(0);
    expect(linksCount).toBeGreaterThanOrEqual(0); // sometimes leaf-only tree may have zero visible links

    // On initial load, paused class should NOT be present -> state is not paused
    const paused = await ast.isPaused();
    expect(paused).toBe(false);

    // Ensure no unexpected console errors or page errors happened during initial render
    expect(consoleErrors.length, `console.error messages: ${JSON.stringify(consoleErrors, null, 2)}`).toBe(0);
    expect(pageErrors.length, `page errors: ${JSON.stringify(pageErrors, null, 2)}`).toBe(0);
  });

  test('Regenerate event transitions Idle/S1 -> S1_TreeGenerated: clicking #regenBtn refreshes tree', async ({ page }) => {
    const ast = new ASTPage(page);
    await ast.waitForInitialRender();

    // Record some pre-click metrics
    const beforeNodes = await ast.getNodesCount();
    const beforeLinks = await ast.getLinksCount();
    const beforeClips = await ast.getClipPathCount();

    // Click regen and wait for nodes to be present and (likely) changed
    await ast.regenerate();

    // Wait for a short time to allow animation/rendering to occur
    await page.waitForTimeout(350);

    // After regenerate, nodes should still be present and often different (count or clipPaths changed)
    const afterNodes = await ast.getNodesCount();
    const afterLinks = await ast.getLinksCount();
    const afterClips = await ast.getClipPathCount();

    // Validate that render happened: at minimum nodes exist; prefer they changed
    expect(afterNodes).toBeGreaterThan(0);

    // Either nodes count or clipPath count or links count should differ (probabilistic check)
    const changed = (afterNodes !== beforeNodes) || (afterLinks !== beforeLinks) || (afterClips !== beforeClips);
    expect(changed, `expected tree to change after regenerate (beforeNodes=${beforeNodes}, afterNodes=${afterNodes}, beforeLinks=${beforeLinks}, afterLinks=${afterLinks}, beforeClips=${beforeClips}, afterClips=${afterClips})`).toBeTruthy();

    // Ensure no runtime errors were emitted during regeneration
    expect(consoleErrors.length, `console.error messages: ${JSON.stringify(consoleErrors, null, 2)}`).toBe(0);
    expect(pageErrors.length, `page errors: ${JSON.stringify(pageErrors, null, 2)}`).toBe(0);
  });

  test('ToggleAnimation event transitions S1_TreeGenerated <-> S2_Paused: pause and resume', async ({ page }) => {
    const ast = new ASTPage(page);
    await ast.waitForInitialRender();

    // Ensure starting not paused
    expect(await ast.isPaused()).toBe(false);

    // Click toggle to pause -> S2_Paused
    await ast.toggleAnimation();

    // Wait for DOM updates
    await page.waitForTimeout(120);

    // Verify paused classes are applied and button text changes to 'Resume'
    expect(await ast.isPaused()).toBe(true);
    const toggleTextPaused = (await ast.getToggleText()) || '';
    expect(toggleTextPaused.includes('Resume')).toBeTruthy();

    // Click toggle again to resume -> S1_TreeGenerated
    await ast.toggleAnimation();
    await page.waitForTimeout(120);

    // Verify paused classes removed and button text is 'Pause'
    expect(await ast.isPaused()).toBe(false);
    const toggleTextResume = (await ast.getToggleText()) || '';
    expect(toggleTextResume.trim().includes('Pause')).toBeTruthy();

    // No page errors during toggling
    expect(consoleErrors.length, `console.error messages: ${JSON.stringify(consoleErrors, null, 2)}`).toBe(0);
    expect(pageErrors.length, `page errors: ${JSON.stringify(pageErrors, null, 2)}`).toBe(0);
  });

  test('Edge case: rapid regenerations and toggles should not throw errors and should preserve paused state when regenerating', async ({ page }) => {
    const ast = new ASTPage(page);
    await ast.waitForInitialRender();

    // Pause the animation first
    await ast.toggleAnimation();
    await page.waitForTimeout(100);
    expect(await ast.isPaused()).toBe(true);

    // Rapidly regenerate several times
    const regenPromises = [];
    for (let i = 0; i < 5; i++) {
      regenPromises.push(ast.regenerate());
      // small stagger but intentionally rapid
      await page.waitForTimeout(40);
    }
    await Promise.all(regenPromises);

    // Allow time for rendering to settle
    await page.waitForTimeout(400);

    // After regenerations while paused, paused state should remain (S2_Paused)
    expect(await ast.isPaused()).toBe(true);

    // Now toggle rapidly multiple times and ensure parity
    for (let i = 0; i < 3; i++) {
      await ast.toggleAnimation();
      // quick spacing to allow class toggles
      await page.waitForTimeout(60);
    }

    // After 3 toggles starting from paused => paused toggled 3 times -> should be not paused (odd number)
    const finalPaused = await ast.isPaused();
    expect(finalPaused).toBe(false);

    // Finally, ensure no console or page errors after stress actions
    expect(consoleErrors.length, `console.error messages: ${JSON.stringify(consoleErrors, null, 2)}`).toBe(0);
    expect(pageErrors.length, `page errors: ${JSON.stringify(pageErrors, null, 2)}`).toBe(0);
  });

  test('DOM integrity checks: clipPaths and node/link classes exist as expected', async ({ page }) => {
    const ast = new ASTPage(page);
    await ast.waitForInitialRender();

    // Clip paths for node ribbons are created in defs; ensure there is at least one clipPath with id 'clip-*'
    const clipCount = await ast.getClipPathCount();
    expect(clipCount).toBeGreaterThan(0);

    // Ensure nodes have expected classes and links have 'path-animate' class on initial render
    const nodeClassCheck = await page.evaluate(() => {
      const nodes = Array.from(document.querySelectorAll('#nodes > g.node'));
      if (nodes.length === 0) return false;
      return nodes.every(n => n.classList.contains('enter') && n.classList.contains('floating'));
    });
    expect(nodeClassCheck).toBe(true);

    const linkClassCheck = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('#links > path'));
      // links might be zero for trivial trees, but if present they should have path-animate class
      if (links.length === 0) return true;
      return links.every(l => l.classList.contains('path-animate'));
    });
    expect(linkClassCheck).toBe(true);

    // No runtime errors encountered when inspecting DOM
    expect(consoleErrors.length, `console.error messages: ${JSON.stringify(consoleErrors, null, 2)}`).toBe(0);
    expect(pageErrors.length, `page errors: ${JSON.stringify(pageErrors, null, 2)}`).toBe(0);
  });
});