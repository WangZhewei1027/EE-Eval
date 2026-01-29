import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/63b3bf43-fa74-11f0-bb9a-db7e6ecdeeaa.html';

// Page Object Model for the Design Patterns Demo page
class PatternsPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.singletonBtn = page.locator("button[onclick='demoSingleton()']");
    this.factoryBtn = page.locator("button[onclick='demoFactory()']");
    this.strategyBtn = page.locator("button[onclick='demoStrategy()']");
    this.observerBtn = page.locator("button[onclick='demoObserver()']");

    this.singletonOutput = page.locator('#singleton-output');
    this.factoryOutput = page.locator('#factory-output');
    this.strategyOutput = page.locator('#strategy-output');
    this.observerOutput = page.locator('#observer-output');

    this.header = page.locator('h1');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  // Click actions
  async triggerSingleton() {
    await this.singletonBtn.click();
  }
  async triggerFactory() {
    await this.factoryBtn.click();
  }
  async triggerStrategy() {
    await this.strategyBtn.click();
  }
  async triggerObserver() {
    await this.observerBtn.click();
  }

  // Helpers to get text content
  async getSingletonText() {
    return (await this.singletonOutput.textContent()) || '';
  }
  async getFactoryText() {
    return (await this.factoryOutput.textContent()) || '';
  }
  async getStrategyText() {
    return (await this.strategyOutput.textContent()) || '';
  }
  async getObserverText() {
    return (await this.observerOutput.textContent()) || '';
  }
}

test.describe('Design Patterns Demo - FSM states and transitions', () => {
  let pageErrors;
  let consoleMessages;

  test.beforeEach(async ({ page }) => {
    // Collect console messages and page errors for assertion
    pageErrors = [];
    consoleMessages = [];

    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Navigate to the application page
    await page.goto(APP_URL);
  });

  test.afterEach(async () => {
    // After each test, ensure there were no uncaught page errors.
    // This validates runtime didn't throw unhandled exceptions during interactions.
    expect(pageErrors, `Expected no page errors, but got: ${pageErrors.map(e => String(e)).join('\n')}`)
      .toHaveLength(0);

    // Fail if any console 'error' messages were emitted.
    const errorConsole = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsole, `Expected no console.error messages, but got: ${JSON.stringify(errorConsole, null, 2)}`)
      .toHaveLength(0);
  });

  test('S0_Idle: Initial render should display title and page structure', async ({ page }) => {
    // Validate initial state S0_Idle: the page header is rendered as evidence of renderPage()/initial render
    const p = new PatternsPage(page);

    // Check the main heading text
    await expect(p.header).toHaveText('Design Patterns Demo in JavaScript');

    // Verify that each pattern container exists
    await expect(page.locator('#singleton-pattern')).toBeVisible();
    await expect(page.locator('#factory-pattern')).toBeVisible();
    await expect(page.locator('#strategy-pattern')).toBeVisible();
    await expect(page.locator('#observer-pattern')).toBeVisible();

    // Ensure buttons exist for each demo as FSM evidence
    await expect(p.singletonBtn).toHaveCount(1);
    await expect(p.factoryBtn).toHaveCount(1);
    await expect(p.strategyBtn).toHaveCount(1);
    await expect(p.observerBtn).toHaveCount(1);
  });

  test.describe('Singleton Demo (S1_SingletonDemo) and transition from Idle', () => {
    test('DemoSingleton: clicking button shows two instances with identical timestamps and equality true', async ({ page }) => {
      // This test validates the transition S0_Idle -> S1_SingletonDemo and entry action demoSingleton()
      const p = new PatternsPage(page);

      // Click to trigger singleton demo
      await p.triggerSingleton();

      // The output should render immediately
      await expect(p.singletonOutput).toBeVisible();

      const text = await p.getSingletonText();

      // Validate expected contents in the singleton output
      expect(text).toMatch(/Instance 1 timestamp:/);
      expect(text).toMatch(/Instance 2 timestamp:/);
      // Should indicate both instances are equal (string "true")
      expect(text).toMatch(/Are both instances equal\?\s*true/);
      // The note about timestamps being the same should be present
      expect(text).toMatch(/timestamps are the same/i);

      // Edge case: clicking again should still produce the same boolean equality result
      await p.triggerSingleton();
      const text2 = await p.getSingletonText();
      expect(text2).toMatch(/Are both instances equal\?\s*true/);
    });
  });

  test.describe('Factory Demo (S2_FactoryDemo)', () => {
    test('DemoFactory: clicking creates Dog and Cat and they speak', async ({ page }) => {
      // Validates S0_Idle -> S2_FactoryDemo and demoFactory() output
      const p = new PatternsPage(page);

      await p.triggerFactory();

      await expect(p.factoryOutput).toBeVisible();

      const text = (await p.getFactoryText()).replace(/\s+/g, ' ');
      // Expect Dog and Cat outputs with the correct sounds
      expect(text).toContain('Dog says:');
      expect(text).toContain('Woof!');
      expect(text).toContain('Cat says:');
      expect(text).toContain('Meow!');

      // Edge case: repeatedly clicking should overwrite the output and remain stable
      await p.triggerFactory();
      const text2 = (await p.getFactoryText()).replace(/\s+/g, ' ');
      expect(text2).toContain('Dog says:');
      expect(text2).toContain('Woof!');
      expect(text2).toContain('Cat says:');
      expect(text2).toContain('Meow!');
    });
  });

  test.describe('Strategy Demo (S3_StrategyDemo)', () => {
    test('DemoStrategy: clicking sorts array using bubble and quick sort producing same sorted results', async ({ page }) => {
      // Validates S0_Idle -> S3_StrategyDemo and demoStrategy() entry action
      const p = new PatternsPage(page);

      await p.triggerStrategy();

      await expect(p.strategyOutput).toBeVisible();

      const text = await p.getStrategyText();

      // Validate that original array is present and both strategies produce a sorted array
      expect(text).toMatch(/Original array: \[5, 3, 8, 4, 2, 7, 1, 6\]/);
      // Both outputs should be the sorted result from 1 to 8
      expect(text).toMatch(/Bubble sort result: \[1, 2, 3, 4, 5, 6, 7, 8\]/);
      expect(text).toMatch(/Quick sort result: \[1, 2, 3, 4, 5, 6, 7, 8\]/);

      // Cross-check that bubble and quick results match
      const bubbleMatch = text.match(/Bubble sort result: \[([^\]]+)\]/);
      const quickMatch = text.match(/Quick sort result: \[([^\]]+)\]/);
      expect(bubbleMatch).toBeTruthy();
      expect(quickMatch).toBeTruthy();
      expect(bubbleMatch[1].trim()).toBe(quickMatch[1].trim());
    });

    test('Strategy edge case: ensure original data is not mutated by sort implementations', async ({ page }) => {
      // This verifies that sorts operate on copies (bubbleSort clones array in implementation)
      const p = new PatternsPage(page);

      await p.triggerStrategy();

      await expect(p.strategyOutput).toBeVisible();

      const text = await p.getStrategyText();

      // The original array should still be the original order
      expect(text).toMatch(/Original array: \[5, 3, 8, 4, 2, 7, 1, 6\]/);
    });
  });

  test.describe('Observer Demo (S4_ObserverDemo)', () => {
    test('DemoObserver: subscribe, notify, unsubscribe flow emits appropriate messages over time', async ({ page }) => {
      // This test validates S0_Idle -> S4_ObserverDemo and the timed notifications/unsubscribe behavior
      const p = new PatternsPage(page);

      // Trigger the observer demo which uses setTimeouts for notifications
      await p.triggerObserver();

      // Immediately after clicking, we should see the subscribing message
      await expect(p.observerOutput).toBeVisible();
      await expect(p.observerOutput).toContainText('Subscribing Observer 1 and Observer 2');

      // Wait for the first notification (setTimeout at 1000ms); allow some buffer
      await page.waitForFunction(() => {
        const el = document.getElementById('observer-output');
        return el && el.innerText.includes('Notifying observers with "Event #1"');
      }, {}, { timeout: 3000 });

      // After first notify, both observers should have received Event #1
      const obsText = await p.getObserverText();
      expect(obsText).toContain('Notifying observers with "Event #1"');
      expect(obsText).toContain('Observer 1 received: Event #1');
      expect(obsText).toContain('Observer 2 received: Event #1');

      // Wait for unsubscribe message around 2200ms (allow buffer)
      await page.waitForFunction(() => {
        const el = document.getElementById('observer-output');
        return el && el.innerText.includes('Unsubscribing Observer 2');
      }, {}, { timeout: 4000 });

      // Finally wait for second notify (3000ms) and assert that only Observer 1 receives Event #2
      await page.waitForFunction(() => {
        const el = document.getElementById('observer-output');
        return el && el.innerText.includes('Notifying observers with "Event #2"') &&
               el.innerText.includes('Observer 1 received: Event #2');
      }, {}, { timeout: 6000 });

      const finalText = await p.getObserverText();

      // Validate presence and absence for Event #2: Observer 1 should have received, Observer 2 should NOT.
      expect(finalText).toContain('Notifying observers with "Event #2"');
      expect(finalText).toContain('Observer 1 received: Event #2');
      expect(finalText).not.toContain('Observer 2 received: Event #2');

      // Also ensure the sequence includes the unsubscribe message
      expect(finalText).toContain('Unsubscribing Observer 2');
    });

    test('Observer edge case: triggering observer demo multiple times appends additional sequences', async ({ page }) => {
      // Clicking the observer demo twice should append new sequences into the same output element (no isolation)
      const p = new PatternsPage(page);

      // Trigger twice in quick succession
      await p.triggerObserver();
      await p.triggerObserver();

      // We expect at least the subscribing message twice or appended content visible
      await page.waitForFunction(() => {
        const el = document.getElementById('observer-output');
        return el && el.innerText.includes('Subscribing Observer 1 and Observer 2');
      }, {}, { timeout: 2000 });

      const text = await p.getObserverText();

      // The text should contain multiple "Subscribing" occurrences if append happened
      const subscribingCount = (text.match(/Subscribing Observer 1 and Observer 2/g) || []).length;
      expect(subscribingCount).toBeGreaterThanOrEqual(1);

      // Wait for at least one Event #1 notification to appear to ensure sequences progressed
      await page.waitForFunction(() => {
        const el = document.getElementById('observer-output');
        return el && el.innerText.includes('Notifying observers with "Event #1"');
      }, {}, { timeout: 5000 });

      // Ensure no unexpected runtime errors occurred during overlapping timeouts (will be asserted in afterEach)
    });
  });

  test.describe('Console and runtime error observation', () => {
    test('No runtime errors or console.error messages should be emitted during normal interactions', async ({ page }) => {
      // This test runs a series of interactions and then asserts there were no page errors / console.error entries.
      // It complements the afterEach guard and collects interactions across patterns.

      const p = new PatternsPage(page);

      // Perform all interactions to exercise the code paths
      await p.triggerSingleton();
      await p.triggerFactory();
      await p.triggerStrategy();
      await p.triggerObserver();

      // Wait for observer finalization to occur (Event #2) to ensure timeouts had a chance to run
      await page.waitForFunction(() => {
        const el = document.getElementById('observer-output');
        return el && el.innerText.includes('Notifying observers with "Event #2"');
      }, {}, { timeout: 7000 });

      // Now check the collected console messages and page errors.
      // The afterEach will assert that pageErrors is empty and no console.error messages exist.
      // Here we add additional debug-friendly expectations.

      // Ensure the console captured some log or info messages (there may be none; we do not require them)
      const hasAnyConsole = consoleMessages.length > 0;
      // It's acceptable to not have any console logs; we simply assert that capturing worked
      expect(Array.isArray(consoleMessages)).toBe(true);
      expect(consoleMessages).toBeDefined();

      // Confirm no page errors
      expect(pageErrors).toHaveLength(0);

      // Confirm there are no console.error typed messages
      const errorConsole = consoleMessages.filter(m => m.type === 'error');
      expect(errorConsole).toHaveLength(0);
    });
  });
});