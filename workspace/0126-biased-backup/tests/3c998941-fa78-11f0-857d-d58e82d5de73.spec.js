import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/3c998941-fa78-11f0-857d-d58e82d5de73.html';

/**
 * Page Object for the SQL visualization page.
 * Encapsulates commonly used selectors and interactions.
 */
class DiagramPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.btnToggle = page.locator('#btn-toggle-connections');
    this.btnHighlight = page.locator('#btn-highlight-fk');
    this.lineCustOrders = page.locator('#line-cust-orders');
    this.fkItems = page.locator('ul.columns li.fk');
    this.customersTable = page.locator('#table-customers');
    this.ordersTable = page.locator('#table-orders');
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
    // Wait a short moment for initial scripts to run (updateConnectionLines called on load)
    await this.page.waitForTimeout(50);
  }

  async clickToggleRelations() {
    await this.btnToggle.click();
    // Allow any DOM updates to propagate
    await this.page.waitForTimeout(20);
  }

  async clickHighlightFK() {
    await this.btnHighlight.click();
    await this.page.waitForTimeout(20);
  }

  async getLineDisplay() {
    return await this.lineCustOrders.evaluate((el) => el.style.display);
  }

  async getLineD() {
    return await this.lineCustOrders.evaluate((el) => el.getAttribute('d'));
  }

  async getAriaPressed() {
    return await this.btnToggle.getAttribute('aria-pressed');
  }

  async getFKStyles() {
    return await this.fkItems.evaluateAll((els) =>
      els.map((el) => ({ color: el.style.color, textShadow: el.style.textShadow }))
    );
  }

  async dispatchResize() {
    await this.page.evaluate(() => window.dispatchEvent(new Event('resize')));
    // Wait briefly for potential handler to run
    await this.page.waitForTimeout(30);
  }
}

test.describe('SQL Concept — Exceptional Visual Design (Interactive Diagram)', () => {
  // Capture console errors and page errors during navigation and interactions.
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Listen for console messages of type 'error'
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push({ text: msg.text(), location: msg.location() });
      }
    });

    // Listen for unhandled exceptions on the page
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });
  });

  test.describe('Initialization and Idle state (S0_Idle)', () => {
    test('should load the page and call updateConnectionLines() to set the path (initial setup)', async ({ page }) => {
      // This test validates the on-entry action updateConnectionLines() by checking the line path 'd' attribute is set.
      const diagram = new DiagramPage(page);
      await diagram.goto();

      // The path 'd' attribute should be present and non-empty after initial setup
      const d = await diagram.getLineD();
      expect(typeof d).toBe('string');
      expect(d.length).toBeGreaterThan(0);

      // Also ensure there were no runtime console errors or page errors during load
      expect(consoleErrors.length, `console.error messages: ${JSON.stringify(consoleErrors)}`).toBe(0);
      expect(pageErrors.length, `page errors: ${JSON.stringify(pageErrors)}`).toBe(0);
    });
  });

  test.describe('Toggle Relations (ToggleRelations event)', () => {
    test('should hide relations when toggled from visible -> hidden (S1_RelationsVisible -> S2_RelationsHidden)', async ({ page }) => {
      // Validate that clicking the toggle hides the connection line and updates aria-pressed
      const diagram = new DiagramPage(page);
      await diagram.goto();

      // Precondition: the line has a path 'd' (initial drawing)
      const initialD = await diagram.getLineD();
      expect(initialD && initialD.length).toBeGreaterThan(0);

      // Click toggle -> expect the relation line to be hidden (style.display = 'none') and aria-pressed to be "false"
      await diagram.clickToggleRelations();
      const displayAfterHide = await diagram.getLineDisplay();
      expect(displayAfterHide).toBe('none');

      const ariaPressedAfterHide = await diagram.getAriaPressed();
      // The button uses setAttribute('aria-pressed', relationsShown) in the implementation; when hidden it should be "false".
      expect(ariaPressedAfterHide).toBe('false');

      // No console/page errors produced by the click
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });

    test('should show relations when toggled again -> visible (S2_RelationsHidden -> S1_RelationsVisible)', async ({ page }) => {
      // Validate toggling twice returns the connection line to visible and aria-pressed true
      const diagram = new DiagramPage(page);
      await diagram.goto();

      // Click once to hide
      await diagram.clickToggleRelations();
      const displayHidden = await diagram.getLineDisplay();
      expect(displayHidden).toBe('none');

      // Click again to show
      await diagram.clickToggleRelations();
      const displayShown = await diagram.getLineDisplay();
      // Implementation sets style.display to 'block' when shown
      expect(displayShown).toBe('block');

      const ariaPressedAfterShow = await diagram.getAriaPressed();
      expect(ariaPressedAfterShow).toBe('true');

      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });

    test('when relations are hidden, window resize should NOT call updateConnectionLines() (edge case)', async ({ page }) => {
      // This test checks the guard in updateConnectionLines(): when relationsShown is false, updateConnectionLines() returns early.
      // We infer this by ensuring the 'd' attribute remains unchanged after a resize when the lines are hidden.
      const diagram = new DiagramPage(page);
      await diagram.goto();

      // Ensure we have a starting path
      const beforeHideD = await diagram.getLineD();
      expect(beforeHideD && beforeHideD.length).toBeGreaterThan(0);

      // Hide relations
      await diagram.clickToggleRelations();
      const displayHidden = await diagram.getLineDisplay();
      expect(displayHidden).toBe('none');

      // Trigger resize event - updateConnectionLines should early return and not modify the path attribute.
      await diagram.dispatchResize();

      const afterResizeD = await diagram.getLineD();
      expect(afterResizeD).toBe(beforeHideD);

      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Highlight Foreign Keys (HighlightFK event)', () => {
    test('should highlight FK items when clicking the highlight button (S4_FKNotHighlighted -> S3_FKHighlighted)', async ({ page }) => {
      // Validate that clicking the highlight button sets inline styles on fk list items
      const diagram = new DiagramPage(page);
      await diagram.goto();

      // Precondition: FK items exist and initially have empty inline color/textShadow
      const initialFKStyles = await diagram.getFKStyles();
      expect(initialFKStyles.length).toBeGreaterThan(0);
      initialFKStyles.forEach((s) => {
        expect(s.color).toBe('');
        expect(s.textShadow).toBe('');
      });

      // Click to highlight
      await diagram.clickHighlightFK();

      // After highlight, each fk item should have the expected inline styles
      const highlightedStyles = await diagram.getFKStyles();
      expect(highlightedStyles.length).toBeGreaterThan(0);
      highlightedStyles.forEach((s) => {
        expect(s.color).toBe('#6c9ef8');
        expect(s.textShadow).toBe('0 0 6px #6c9ef8cc');
      });

      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });

    test('should remove highlight when clicking the highlight button again (S3_FKHighlighted -> S4_FKNotHighlighted)', async ({ page }) => {
      // Validate toggling highlight off restores empty inline styles
      const diagram = new DiagramPage(page);
      await diagram.goto();

      // Toggle on
      await diagram.clickHighlightFK();
      const afterOn = await diagram.getFKStyles();
      afterOn.forEach((s) => {
        expect(s.color).toBe('#6c9ef8');
      });

      // Toggle off
      await diagram.clickHighlightFK();
      const afterOff = await diagram.getFKStyles();
      afterOff.forEach((s) => {
        expect(s.color).toBe('');
        expect(s.textShadow).toBe('');
      });

      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });

    test('rapid toggles of highlight button should alternate states predictably (edge case)', async ({ page }) => {
      // Simulate rapid user clicks and ensure final state is consistent with number of toggles performed.
      const diagram = new DiagramPage(page);
      await diagram.goto();

      // Determine number of rapid toggles
      const toggles = 5; // odd -> final state should be highlighted
      for (let i = 0; i < toggles; i++) {
        // Rapid clicks without long delays
        await diagram.clickHighlightFK();
      }

      const finalStyles = await diagram.getFKStyles();
      if (toggles % 2 === 1) {
        // Expect highlighted
        finalStyles.forEach((s) => {
          expect(s.color).toBe('#6c9ef8');
          expect(s.textShadow).toBe('0 0 6px #6c9ef8cc');
        });
      } else {
        // Expect not highlighted
        finalStyles.forEach((s) => {
          expect(s.color).toBe('');
          expect(s.textShadow).toBe('');
        });
      }

      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Runtime and accessibility observations', () => {
    test('should not produce console.error or page errors on a typical interaction sequence', async ({ page }) => {
      // This test performs a sequence of interactions and asserts there were no console errors or page errors.
      const diagram = new DiagramPage(page);
      await diagram.goto();

      // Perform a series of interactions
      await diagram.clickHighlightFK(); // highlight
      await diagram.clickToggleRelations(); // hide relations
      await diagram.dispatchResize(); // fire resize while hidden
      await diagram.clickToggleRelations(); // show relations
      await diagram.clickHighlightFK(); // unhighlight

      // Assert no runtime errors were observed in console or pageerror events
      expect(consoleErrors.length, `console.error messages: ${JSON.stringify(consoleErrors)}`).toBe(0);
      expect(pageErrors.length, `page errors: ${JSON.stringify(pageErrors)}`).toBe(0);
    });

    test('basic accessibility attributes for controls are present', async ({ page }) => {
      // Validate aria attributes declared in components in the FSM
      const diagram = new DiagramPage(page);
      await diagram.goto();

      // The toggle button should have aria-pressed attribute and aria-label
      const ariaPressed = await diagram.getAriaPressed();
      const ariaLabelToggle = await diagram.btnToggle.getAttribute('aria-label');
      expect(ariaPressed).not.toBeNull();
      expect(ariaLabelToggle).toBe('Toggle display of relation lines');

      // The highlight button should have aria-label
      const ariaLabelHighlight = await diagram.btnHighlight.getAttribute('aria-label');
      expect(ariaLabelHighlight).toBe('Highlight foreign key columns');

      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });
  });
});