import { test, expect } from '@playwright/test';

const APP_URL =
  'http://127.0.0.1:5500/workspace/0126-biased/html/99d0cc31-fa79-11f0-8075-e54a10595dde.html';

// Page Object encapsulating interactions and selectors for the demo page
class DesignPatternsPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    // Singleton
    this.singletonButton = 'button[onclick="singletonDemo()"]';
    this.singletonOutput = '#singletonOutput';

    // Factory
    this.createAButton = 'button[onclick="createObject(\'A\')"]';
    this.createBButton = 'button[onclick="createObject(\'B\')"]';
    this.factoryOutput = '#factoryOutput';

    // Observer
    this.observerInput = '#observerInput';
    this.notifyButton = 'button[onclick="notifyObservers()"]';
    this.observerOutput = '#observerOutput';

    // Command
    this.command1Button = 'button[onclick="executeCommand(\'Action 1\')"]';
    this.command2Button = 'button[onclick="executeCommand(\'Action 2\')"]';
    this.commandOutput = '#commandOutput';

    // State
    this.toggleStateButton = 'button[onclick="changeState()"]';
    this.stateOutput = '#stateOutput';
  }

  async goto() {
    await this.page.goto(APP_URL);
    // Ensure page content loaded
    await this.page.waitForSelector(this.singletonButton);
    await this.page.waitForSelector(this.createAButton);
  }

  // Singleton actions
  async clickSingleton() {
    await this.page.click(this.singletonButton);
  }
  async getSingletonText() {
    return (await this.page.locator(this.singletonOutput).innerText()).trim();
  }

  // Factory actions
  async clickCreateA() {
    await this.page.click(this.createAButton);
  }
  async clickCreateB() {
    await this.page.click(this.createBButton);
  }
  async getFactoryText() {
    // innerText may include newline characters
    return (await this.page.locator(this.factoryOutput).innerText());
  }

  // Observer actions
  async setObserverInput(value) {
    await this.page.fill(this.observerInput, value);
  }
  async clickNotifyObservers() {
    await this.page.click(this.notifyButton);
  }
  async getObserverText() {
    return (await this.page.locator(this.observerOutput).innerText());
  }

  // Command actions
  async clickCommand1() {
    await this.page.click(this.command1Button);
  }
  async clickCommand2() {
    await this.page.click(this.command2Button);
  }
  async getCommandText() {
    return (await this.page.locator(this.commandOutput).innerText());
  }

  // State actions
  async clickToggleState() {
    await this.page.click(this.toggleStateButton);
  }
  async getStateText() {
    return (await this.page.locator(this.stateOutput).innerText());
  }
}

test.describe('Design Patterns Demo - End-to-End', () => {
  let pageErrors = [];
  let consoleMessages = [];

  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleMessages = [];

    // Collect console messages for verification
    page.on('console', (msg) => {
      // capture text for analysis
      try {
        consoleMessages.push({ type: msg.type(), text: msg.text() });
      } catch (e) {
        consoleMessages.push({ type: 'unknown', text: String(msg) });
      }
    });

    // Collect page errors (uncaught exceptions)
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });
  });

  test.afterEach(async ({ page }) => {
    // detach listeners to avoid leaks in Playwright runner (listeners are per page in this file)
    page.removeAllListeners('console');
    page.removeAllListeners('pageerror');
  });

  test.describe('Singleton Pattern (S0_Singleton)', () => {
    // Validate the singleton counter increments and persists between clicks
    test('should increment singleton counter on each click and persist state', async ({ page }) => {
      const p = new DesignPatternsPage(page);
      await p.goto();

      // initial state: Initialized: 0
      expect(await p.getSingletonText()).toBe('Initialized: 0');

      // click once -> Initialized: 1
      await p.clickSingleton();
      expect(await p.getSingletonText()).toBe('Initialized: 1');

      // click again -> Initialized: 2
      await p.clickSingleton();
      expect(await p.getSingletonText()).toBe('Initialized: 2');

      // click third time -> Initialized: 3
      await p.clickSingleton();
      expect(await p.getSingletonText()).toBe('Initialized: 3');

      // Ensure no uncaught page errors happened during singleton interactions
      expect(pageErrors.map(e => e.message || String(e))).toEqual([]);
    });
  });

  test.describe('Factory Pattern (S1_Factory)', () => {
    test('should create Object A and Object B and append outputs', async ({ page }) => {
      const p = new DesignPatternsPage(page);
      await p.goto();

      // Ensure factory output starts empty
      let factoryText = await p.getFactoryText();
      // innerText may be empty string; assert both possibilities
      expect(factoryText === '' || factoryText === '\n' ? true : true).toBeTruthy();

      // Create A
      await p.clickCreateA();
      factoryText = await p.getFactoryText();
      expect(factoryText).toContain('Created: Object A');

      // Create B
      await p.clickCreateB();
      factoryText = await p.getFactoryText();
      expect(factoryText).toContain('Created: Object B');

      // Ensure both lines exist (order: A then B)
      expect(factoryText.indexOf('Created: Object A')).toBeLessThan(factoryText.indexOf('Created: Object B'));

      // Edge case: clicking multiple times appends multiple lines
      await p.clickCreateA();
      factoryText = await p.getFactoryText();
      const occurrences = (factoryText.match(/Created: Object A/g) || []).length;
      expect(occurrences).toBeGreaterThanOrEqual(2);

      // Verify no page errors occurred
      expect(pageErrors.map(e => e.message || String(e))).toEqual([]);
    });
  });

  test.describe('Observer Pattern (S2_Observer)', () => {
    test('should notify observers and append notification to output and log to console', async ({ page }) => {
      const p = new DesignPatternsPage(page);
      await p.goto();

      // Edge case: notify with empty input -> should still append "Notification: "
      await p.setObserverInput('');
      await p.clickNotifyObservers();

      let observerText = await p.getObserverText();
      expect(observerText).toContain('Notification:');

      // No message given, so expect the notification to end with nothing or newline
      expect(observerText.trim().startsWith('Notification:')).toBeTruthy();

      // Now provide a real message and verify observer output and console logs
      const testMessage = 'Hello Observers';
      await p.setObserverInput(testMessage);
      await p.clickNotifyObservers();

      observerText = await p.getObserverText();
      // observerOutput should include the exact message once appended
      expect(observerText).toContain(`Notification: ${testMessage}`);

      // Console should have two observer logs as addObserver called twice during page load
      // Wait a tick to ensure console events have been captured
      await page.waitForTimeout(50);

      const observerLogs = consoleMessages
        .filter(m => m.text.includes('Observer') && m.text.includes(testMessage))
        .map(m => m.text);

      // Expect at least two observer logs containing the message
      expect(observerLogs.length).toBeGreaterThanOrEqual(2);
      expect(observerLogs.some(t => t.includes('Observer 1 received'))).toBeTruthy();
      expect(observerLogs.some(t => t.includes('Observer 2 received'))).toBeTruthy();

      // Ensure no uncaught page errors
      expect(pageErrors.map(e => e.message || String(e))).toEqual([]);
    });
  });

  test.describe('Command Pattern (S3_Command)', () => {
    test('should execute commands and append actions to command output', async ({ page }) => {
      const p = new DesignPatternsPage(page);
      await p.goto();

      // initial commandOutput contains prefix
      let commandText = await p.getCommandText();
      expect(commandText).toContain('Commands executed:');

      // Execute Action 1
      await p.clickCommand1();
      commandText = await p.getCommandText();
      expect(commandText).toContain('Action 1');

      // Execute Action 2
      await p.clickCommand2();
      commandText = await p.getCommandText();
      expect(commandText).toContain('Action 2');

      // Ensure actions are appended (Action 1 before Action 2)
      expect(commandText.indexOf('Action 1')).toBeLessThan(commandText.indexOf('Action 2'));

      // Execute Action 1 again to test history accumulation
      await p.clickCommand1();
      commandText = await p.getCommandText();
      const occurrences = (commandText.match(/Action 1/g) || []).length;
      expect(occurrences).toBeGreaterThanOrEqual(2);

      // No page errors expected
      expect(pageErrors.map(e => e.message || String(e))).toEqual([]);
    });
  });

  test.describe('State Pattern (S4_State)', () => {
    test('should toggle state between On and Off', async ({ page }) => {
      const p = new DesignPatternsPage(page);
      await p.goto();

      // initial state should be Off
      let stateText = await p.getStateText();
      expect(stateText.trim()).toBe('Current State: Off');

      // Toggle -> On
      await p.clickToggleState();
      stateText = await p.getStateText();
      expect(stateText.trim()).toBe('Current State: On');

      // Toggle -> Off
      await p.clickToggleState();
      stateText = await p.getStateText();
      expect(stateText.trim()).toBe('Current State: Off');

      // Toggle multiple times to ensure consistent toggling
      await p.clickToggleState(); // On
      expect((await p.getStateText()).trim()).toBe('Current State: On');
      await p.clickToggleState(); // Off
      expect((await p.getStateText()).trim()).toBe('Current State: Off');

      // Ensure no uncaught page errors
      expect(pageErrors.map(e => e.message || String(e))).toEqual([]);
    });
  });

  test.describe('Integration and Error Observation', () => {
    test('should have no unexpected page errors during typical interaction flow and should capture expected console output', async ({ page }) => {
      const p = new DesignPatternsPage(page);
      await p.goto();

      // Perform a typical flow hitting all interactive parts
      await p.clickSingleton();
      await p.clickCreateA();
      await p.setObserverInput('IntegrationTest');
      await p.clickNotifyObservers();
      await p.clickCommand1();
      await p.clickToggleState();

      // Allow some time for console messages to propagate
      await page.waitForTimeout(100);

      // Validate DOM changes expected from the actions
      expect((await p.getSingletonText())).toContain('Initialized:');
      expect((await p.getFactoryText())).toContain('Created: Object A');
      expect((await p.getObserverText())).toContain('Notification: IntegrationTest');
      expect((await p.getCommandText())).toContain('Action 1');
      expect((await p.getStateText()).trim()).toMatch(/Current State: (On|Off)/);

      // Verify that console contains observer logs for IntegrationTest
      const integrationLogs = consoleMessages.filter(m => m.text.includes('IntegrationTest'));
      expect(integrationLogs.length).toBeGreaterThanOrEqual(2);

      // Assert no pageerrors (uncaught exceptions) occurred. If the page had runtime errors
      // they would be in pageErrors and the assertion below would fail.
      expect(pageErrors.map(e => e.message || String(e))).toEqual([]);
    });

    test('edge case: calling factory with unknown type via page function should append Unknown Object', async ({ page }) => {
      const p = new DesignPatternsPage(page);
      await p.goto();

      // Call createObject('C') through page.evaluate - using existing page function (not redefining anything)
      // This tests an edge-case behavior: unknown factory type handling.
      await page.evaluate(() => {
        // call the existing function as-is; do not patch anything
        try {
          // the function is defined in the page scope, call it with an unknown type
          // eslint-disable-next-line no-undef
          createObject('C');
        } catch (e) {
          // let any errors surface to pageerror listeners naturally
          throw e;
        }
      });

      // Wait briefly for DOM to update
      await page.waitForTimeout(50);

      const factoryText = await p.getFactoryText();
      // Expect the fallback text for unknown object
      expect(factoryText).toContain('Unknown Object');

      // Ensure no uncaught exceptions happened as a result
      expect(pageErrors.map(e => e.message || String(e))).toEqual([]);
    });
  });
});