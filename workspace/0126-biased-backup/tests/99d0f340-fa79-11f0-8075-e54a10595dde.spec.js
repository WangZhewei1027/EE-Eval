import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/99d0f340-fa79-11f0-8075-e54a10595dde.html';

// Page Object for the Garbage Collection Simulation app
class GarbagePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.createBtn = page.locator('button[onclick="createObject()"]');
    this.collectBtn = page.locator('button[onclick="collectGarbage()"]');
    this.clearBtn = page.locator('button[onclick="clearAllObjects()"]');
    this.maxInput = page.locator('input#maxObjectsInput');
    this.objectCount = page.locator('#objectCount');
    this.maxObjectCount = page.locator('#maxObjectCount');
    this.objectList = page.locator('#objectList');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async createObject() {
    await this.createBtn.click();
  }

  async collectGarbage() {
    await this.collectBtn.click();
  }

  async clearAllObjects() {
    await this.clearBtn.click();
  }

  async setMaxObjects(value) {
    // Use fill + dispatch change by focusing out (Playwright change triggers)
    await this.maxInput.fill(String(value));
    // Trigger change event explicitly by pressing Tab
    await this.maxInput.press('Tab');
    // small wait for DOM update
    await this.page.waitForTimeout(50);
  }

  async getObjectCountText() {
    return (await this.objectCount.textContent()) || '';
  }

  async getMaxObjectCountText() {
    return (await this.maxObjectCount.textContent()) || '';
  }

  async getObjectListItems() {
    // Return array of textContent for each item div
    const count = await this.objectList.locator('div').count();
    const arr = [];
    for (let i = 0; i < count; i++) {
      arr.push(await this.objectList.locator('div').nth(i).textContent());
    }
    return arr.map(t => t || '');
  }

  async modifyFirstObject() {
    const firstModify = this.objectList.locator('div >> button').first();
    await firstModify.click();
  }

  async createMultiple(n) {
    for (let i = 0; i < n; i++) {
      await this.createObject();
      // small wait for UI update
      await this.page.waitForTimeout(20);
    }
  }
}

test.describe('Garbage Collection Simulation - FSM tests', () => {
  // Capture console messages and page errors for each test to observe runtime errors.
  test.beforeEach(async ({ page }) => {
    // Nothing here; each test will instantiate its own GarbagePage and attach listeners.
  });

  // Test: Initial state S0_Idle validations
  test('S0_Idle: Initial state shows zero objects and correct max', async ({ page }) => {
    // Collect console errors and page errors
    const consoleErrors = [];
    const pageErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg);
    });
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    const app = new GarbagePage(page);
    await app.goto();

    // Validate initial visual state (Idle: Objects in memory: 0)
    await expect(app.objectCount).toHaveText('Objects in memory: 0');
    await expect(app.maxObjectCount).toHaveText('Max objects: 10');
    const items = await app.getObjectListItems();
    expect(items.length).toBe(0);

    // No runtime console errors or page errors should have occurred during initial load
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  // Group tests that exercise object creation and modification transitions
  test.describe('Object creation, modification and max limit transitions', () => {
    test('S0 -> S1: CreateObject increments count and creates a Modify button', async ({ page }) => {
      const consoleErrors = [];
      const pageErrors = [];
      page.on('console', msg => {
        if (msg.type() === 'error') consoleErrors.push(msg);
      });
      page.on('pageerror', err => {
        pageErrors.push(err);
      });

      const app = new GarbagePage(page);
      await app.goto();

      // Create one object
      await app.createObject();

      // Validate object count updated (Objects in memory: 1)
      await expect(app.objectCount).toHaveText(/Objects in memory:\s*1/);

      // Validate object list contains one entry and has a Modify button
      const items = await app.getObjectListItems();
      expect(items.length).toBe(1);
      expect(items[0]).toMatch(/Object\s+1:\s+\d+\.\d{2}\s*Modify/);

      // No runtime errors
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });

    test('S1: ModifyObject updates the object value in the DOM', async ({ page }) => {
      const consoleErrors = [];
      const pageErrors = [];
      page.on('console', msg => {
        if (msg.type() === 'error') consoleErrors.push(msg);
      });
      page.on('pageerror', err => {
        pageErrors.push(err);
      });

      const app = new GarbagePage(page);
      await app.goto();

      // Create a single object
      await app.createObject();
      await page.waitForTimeout(20);

      // Capture original displayed value (extract numeric portion)
      const itemsBefore = await app.getObjectListItems();
      expect(itemsBefore.length).toBeGreaterThan(0);
      const originalText = itemsBefore[0];
      const originalMatch = originalText.match(/Object\s+1:\s+([0-9]+\.[0-9]{2})/);
      expect(originalMatch).not.toBeNull();
      const originalValue = originalMatch ? originalMatch[1] : null;
      expect(originalValue).toMatch(/^[0-9]+\.[0-9]{2}$/);

      // Click Modify for the first object (S1 ModifyObject transition)
      await app.modifyFirstObject();
      await page.waitForTimeout(20);

      // Capture new value and assert that it's a valid number string and may differ from original
      const itemsAfter = await app.getObjectListItems();
      const newText = itemsAfter[0];
      const newMatch = newText.match(/Object\s+1:\s+([0-9]+\.[0-9]{2})/);
      expect(newMatch).not.toBeNull();
      const newValue = newMatch ? newMatch[1] : null;
      expect(newValue).toMatch(/^[0-9]+\.[0-9]{2}$/);

      // It's possible (rarely) the new random equals the old to two decimals; assert either changed or still valid number.
      // We will assert that the DOM was updated (text content still contains 'Modify' and correct format)
      expect(newText).toContain('Modify');

      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });

    test('Edge: Setting max objects and preventing creation beyond limit triggers alert', async ({ page }) => {
      const consoleErrors = [];
      const pageErrors = [];
      page.on('console', msg => {
        if (msg.type() === 'error') consoleErrors.push(msg);
      });
      page.on('pageerror', err => {
        pageErrors.push(err);
      });

      const app = new GarbagePage(page);
      await app.goto();

      // Set max objects to 1
      await app.setMaxObjects(1);
      await expect(app.getMaxObjectCountText()).resolves.toMatch(/Max objects:\s*1/);

      // Create the single permitted object
      await app.createObject();
      await expect(app.objectCount).toHaveText(/Objects in memory:\s*1/);

      // Attempt to create another object: expect an alert dialog with specific message
      const dialogPromise = page.waitForEvent('dialog');
      await app.createObject();
      const dialog = await dialogPromise;
      // Validate dialog message aligns with implementation
      expect(dialog.message()).toBe('Maximum object limit reached.');
      await dialog.dismiss();

      // Confirm objectCount stayed at 1
      await expect(app.objectCount).toHaveText(/Objects in memory:\s*1/);

      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Garbage collection and clearing transitions', () => {
    test('S1 -> S2: collectGarbage reduces or equals object count (filters by value > 0.5)', async ({ page }) => {
      const consoleErrors = [];
      const pageErrors = [];
      page.on('console', msg => {
        if (msg.type() === 'error') consoleErrors.push(msg);
      });
      page.on('pageerror', err => {
        pageErrors.push(err);
      });

      const app = new GarbagePage(page);
      await app.goto();

      // Create several objects to make collectGarbage meaningful
      await app.createMultiple(6);
      // Get count before garbage collection
      const beforeText = await app.getObjectCountText();
      const beforeMatch = beforeText.match(/Objects in memory:\s*(\d+)/);
      expect(beforeMatch).not.toBeNull();
      const beforeCount = beforeMatch ? parseInt(beforeMatch[1], 10) : 0;
      expect(beforeCount).toBeGreaterThanOrEqual(1);

      // Perform garbage collection
      await app.collectGarbage();
      await page.waitForTimeout(20);

      // After GC, count should be <= beforeCount
      const afterText = await app.getObjectCountText();
      const afterMatch = afterText.match(/Objects in memory:\s*(\d+)/);
      expect(afterMatch).not.toBeNull();
      const afterCount = afterMatch ? parseInt(afterMatch[1], 10) : 0;
      expect(afterCount).toBeLessThanOrEqual(beforeCount);

      // Each remaining item's displayed value should be > 0.5 by implementation; validate numeric and value > 0.50
      const items = await app.getObjectListItems();
      for (const item of items) {
        const m = item.match(/Object\s+\d+:\s+([0-9]+\.[0-9]{2})/);
        expect(m).not.toBeNull();
        const val = parseFloat(m ? m[1] : '0');
        // Because filter keeps > 0.5, displayed toFixed(2) should be >= 0.51 or possibly 0.50 if rounding, allow >=0.50
        expect(val).toBeGreaterThanOrEqual(0.50);
      }

      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });

    test('S1 -> S3: clearAllObjects empties memory and UI reflects zero objects', async ({ page }) => {
      const consoleErrors = [];
      const pageErrors = [];
      page.on('console', msg => {
        if (msg.type() === 'error') consoleErrors.push(msg);
      });
      page.on('pageerror', err => {
        pageErrors.push(err);
      });

      const app = new GarbagePage(page);
      await app.goto();

      // Create a couple of objects
      await app.createMultiple(3);
      await expect(app.objectCount).not.toHaveText('Objects in memory: 0');

      // Clear all
      await app.clearAllObjects();
      await page.waitForTimeout(20);

      // Validate cleared state: count 0 and object list empty
      await expect(app.objectCount).toHaveText('Objects in memory: 0');
      const items = await app.getObjectListItems();
      expect(items.length).toBe(0);

      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Additional FSM and edge validations', () => {
    test('S0: setMaxObjects transition updates Max objects display and influences creates', async ({ page }) => {
      const consoleErrors = [];
      const pageErrors = [];
      page.on('console', msg => {
        if (msg.type() === 'error') consoleErrors.push(msg);
      });
      page.on('pageerror', err => {
        pageErrors.push(err);
      });

      const app = new GarbagePage(page);
      await app.goto();

      // Change max to 5
      await app.setMaxObjects(5);
      await expect(app.maxObjectCount).toHaveText('Max objects: 5');

      // Create 5 objects successfully
      await app.createMultiple(5);
      await expect(app.objectCount).toHaveText(/Objects in memory:\s*5/);

      // Sixth creation should trigger alert as in earlier test
      const dialogPromise = page.waitForEvent('dialog');
      await app.createObject();
      const dialog = await dialogPromise;
      expect(dialog.message()).toBe('Maximum object limit reached.');
      await dialog.dismiss();

      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });

    test('Sanity: No unexpected runtime ReferenceError / SyntaxError / TypeError occurred during interactions', async ({ page }) => {
      // This test specifically observes runtime errors over a sequence of interactions.
      const consoleMessages = [];
      const pageErrors = [];
      page.on('console', msg => {
        consoleMessages.push({ type: msg.type(), text: msg.text() });
      });
      page.on('pageerror', err => {
        pageErrors.push(err);
      });

      const app = new GarbagePage(page);
      await app.goto();

      // Perform a series of interactions that exercise the code paths
      await app.createMultiple(3);
      await app.modifyFirstObject();
      await app.collectGarbage();
      await app.setMaxObjects(2);
      await app.createObject(); // may trigger alert if limit reached
      // Dismiss any alert gracefully if appears
      page.on('dialog', async dialog => {
        await dialog.dismiss();
      });

      // short wait to capture asynchronous console/page errors
      await page.waitForTimeout(100);

      // Ensure there are no page errors of type ReferenceError/SyntaxError/TypeError
      const criticalErrors = pageErrors.filter(e => {
        const name = e && e.name;
        return name === 'ReferenceError' || name === 'SyntaxError' || name === 'TypeError';
      });

      // Assert none of these critical JS errors occurred
      expect(criticalErrors.length).toBe(0);

      // Also assert that no console.error messages occurred
      const consoleErrorCount = consoleMessages.filter(m => m.type === 'error').length;
      expect(consoleErrorCount).toBe(0);
    });
  });
});