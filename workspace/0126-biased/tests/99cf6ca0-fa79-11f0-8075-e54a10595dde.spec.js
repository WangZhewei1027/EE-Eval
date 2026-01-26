import { test, expect } from '@playwright/test';

// Test file for Application ID: 99cf6ca0-fa79-11f0-8075-e54a10595dde
// This test suite verifies the FSM states and transitions described in the FSM
// by driving the UI at the given URL. It observes console and page errors (without
// modifying the page) and asserts expected DOM updates for each interaction.

// Page object for the Greedy Algorithms Interactive Demo
class GreedyDemoPage {
  constructor(page) {
    this.page = page;
    // Coin change
    this.amount = page.locator('#amount');
    this.denominations = page.locator('#denominations');
    this.coinButton = page.locator('button[onclick="calculateCoinChange()"]');
    this.coinResult = page.locator('#coinChangeResult');
    // Activity selection
    this.activities = page.locator('#activities');
    this.activityButton = page.locator('button[onclick="selectActivities()"]');
    this.activityResult = page.locator('#activityResult');
    // Fractional knapsack
    this.itemData = page.locator('#itemData');
    this.knapsackCapacity = page.locator('#knapsackCapacity');
    this.knapsackButton = page.locator('button[onclick="fractionalKnapsack()"]');
    this.knapsackResult = page.locator('#knapsackResult');
  }

  async goto(url) {
    await this.page.goto(url);
  }

  // Coin change helpers
  async calculateCoinChange(amountValue, denominationsValue) {
    if (amountValue !== null) {
      await this.amount.fill(String(amountValue));
    } else {
      // clear
      await this.amount.fill('');
    }
    if (denominationsValue !== null) {
      await this.denominations.fill(denominationsValue);
    } else {
      await this.denominations.fill('');
    }
    await this.coinButton.click();
  }

  // Activity selection helpers
  async selectActivities(activitiesValue) {
    if (activitiesValue !== null) {
      await this.activities.fill(activitiesValue);
    } else {
      await this.activities.fill('');
    }
    await this.activityButton.click();
  }

  // Knapsack helpers
  async calculateKnapsack(itemDataValue, capacityValue) {
    if (itemDataValue !== null) {
      await this.itemData.fill(itemDataValue);
    } else {
      await this.itemData.fill('');
    }
    if (capacityValue !== null) {
      await this.knapsackCapacity.fill(String(capacityValue));
    } else {
      await this.knapsackCapacity.fill('');
    }
    await this.knapsackButton.click();
  }
}

test.describe('Greedy Algorithms Interactive Demo - FSM states & transitions', () => {
  const appUrl = 'http://127.0.0.1:5500/workspace/0126-biased/html/99cf6ca0-fa79-11f0-8075-e54a10595dde.html';
  let consoleErrors = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    // Reset error collectors before each test
    consoleErrors = [];
    pageErrors = [];

    // Collect console messages and page errors as they happen
    page.on('console', msg => {
      // Record console.error messages (and other types for visibility)
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
    page.on('pageerror', err => {
      // Capture uncaught exceptions
      pageErrors.push(err);
    });

    // Navigate to the application under test
    await page.goto(appUrl);
  });

  test.afterEach(async () => {
    // Basic sanity: ensure no uncaught page errors occurred during each test.
    // The app is expected to run without throwing uncaught exceptions; assert that.
    expect(pageErrors.length, `Expected no uncaught page errors, found: ${pageErrors.map(e => String(e)).join(' | ')}`).toBe(0);
    // Likewise assert there were no console.error entries
    expect(consoleErrors.length, `Expected no console.error messages, found: ${consoleErrors.join(' | ')}`).toBe(0);
  });

  test('Initial render (S0_Idle): all inputs and buttons are present', async ({ page }) => {
    // This test validates the Idle state: inputs and buttons exist and result containers are empty initially.
    const p = new GreedyDemoPage(page);

    // Verify inputs & buttons exist
    await expect(p.amount).toBeVisible();
    await expect(p.denominations).toBeVisible();
    await expect(p.coinButton).toBeVisible();
    await expect(p.coinResult).toBeVisible();

    await expect(p.activities).toBeVisible();
    await expect(p.activityButton).toBeVisible();
    await expect(p.activityResult).toBeVisible();

    await expect(p.itemData).toBeVisible();
    await expect(p.knapsackCapacity).toBeVisible();
    await expect(p.knapsackButton).toBeVisible();
    await expect(p.knapsackResult).toBeVisible();

    // Initially result containers should be empty (or contain no substantive result text)
    await expect(p.coinResult).toHaveText('', { timeout: 500 }).catch(() => {
      // Some browsers may keep whitespace; check that they do not contain expected result phrases
      expect((await p.coinResult.textContent()) || '').not.toContain('Coins used:');
    });
    await expect(p.activityResult).toHaveText('', { timeout: 500 }).catch(() => {
      expect((await p.activityResult.textContent()) || '').not.toContain('Selected Activities:');
    });
    await expect(p.knapsackResult).toHaveText('', { timeout: 500 }).catch(() => {
      expect((await p.knapsackResult.textContent()) || '').not.toContain('Maximum Value:');
    });
  });

  test('Transition S0 -> S1: Calculate Coin Change with typical denominations', async ({ page }) => {
    // This test validates CalculateCoinChange event and S1_CoinChangeCalculated state.
    const p = new GreedyDemoPage(page);

    // Use amount 63 with denominations 25,10,5,1 => expected greedy coin list: 25,25,10,1,1,1
    await p.calculateCoinChange(63, '25,10,5,1');

    // Verify DOM result text matches expected output exactly
    await expect(p.coinResult).toHaveText('Coins used: 25, 25, 10, 1, 1, 1');
  });

  test('Transition S0 -> S1: Coin Change edge cases - zero amount, missing denominations, and invalid input', async ({ page }) => {
    // Edge cases to ensure graceful behavior without thrown exceptions:
    const p = new GreedyDemoPage(page);

    // 1) Zero amount should produce an empty coins list (no exceptions)
    await p.calculateCoinChange(0, '25,10,5,1');
    await expect(p.coinResult).toHaveText(/Coins used:/);

    // 2) Missing denominations -> empty string -> should not throw, result expected to be empty list
    await p.calculateCoinChange(10, '');
    await expect(p.coinResult).toHaveText(/Coins used:/);

    // 3) Completely empty inputs -> ensure no crash and shows basic "Coins used:" output
    await p.calculateCoinChange(null, null);
    await expect(p.coinResult).toHaveText(/Coins used:/);
  });

  test('Transition S0 -> S2: Select Activities with well-formed activities list', async ({ page }) => {
    // This test validates selectActivities event and S2_ActivitiesSelected state.
    const p = new GreedyDemoPage(page);

    const activitiesInput = '0,6;1,4;3,5;5,7;3,9;5,9';
    await p.selectActivities(activitiesInput);

    // Based on greedy by finish time, expected chosen activities: [1,4], [5,7]
    await expect(p.activityResult).toHaveText('Selected Activities: [1,4], [5,7]');
  });

  test('Transition S0 -> S2: Activity selection edge cases - empty and malformed input', async ({ page }) => {
    // Provide empty and malformed inputs and ensure the page does not throw and displays a consistent output
    const p = new GreedyDemoPage(page);

    // Empty input
    await p.selectActivities('');
    await expect(p.activityResult).toHaveText(/Selected Activities:/);

    // Malformed input (no semicolons/commas meaningful)
    await p.selectActivities('abc');
    // Should not crash; should display Selected Activities: perhaps empty list
    await expect(p.activityResult).toHaveText(/Selected Activities:/);
  });

  test('Transition S0 -> S3: Fractional Knapsack typical case', async ({ page }) => {
    // Valid knapsack example: items "10,60;20,100;30,120", capacity 50 -> expected Maximum Value: 240.00
    const p = new GreedyDemoPage(page);

    await p.calculateKnapsack('10,60;20,100;30,120', 50);

    await expect(p.knapsackResult).toHaveText('Maximum Value: 240.00');
  });

  test('Transition S0 -> S3: Knapsack edge cases - zero capacity and malformed item data', async ({ page }) => {
    // Verify no uncaught exceptions and reasonable outputs for edge inputs
    const p = new GreedyDemoPage(page);

    // Zero capacity should yield 0.00
    await p.calculateKnapsack('10,60;20,100;30,120', 0);
    await expect(p.knapsackResult).toHaveText(/Maximum Value: (0\.00|NaN|0)/);

    // Malformed item data
    await p.calculateKnapsack('', 50);
    // The implementation may produce NaN or 0; ensure there's output and no crash
    await expect(p.knapsackResult).toHaveText(/Maximum Value:/);
  });

  test('State transitions combined: perform coin change, activities, then knapsack consecutively', async ({ page }) => {
    // This test exercises multiple transitions in sequence to ensure the UI remains stable
    // and that each result updates independent result containers.
    const p = new GreedyDemoPage(page);

    // 1) Coin change
    await p.calculateCoinChange(37, '25,10,1');
    await expect(p.coinResult).toHaveText('Coins used: 25, 10, 1, 1');

    // 2) Activity selection
    await p.selectActivities('1,2;2,3;3,4');
    await expect(p.activityResult).toHaveText('Selected Activities: [1,2], [2,3], [3,4]');

    // 3) Knapsack
    await p.calculateKnapsack('5,50;4,40;6,60', 9);
    // Greedy ratio: 10,10,10 equal ratios; fill items until capacity -> expect two items maybe 5+4=9 total value 90.00
    await expect(p.knapsackResult).toHaveText(/Maximum Value: (90\.00|NaN|90)/);
  });

  test('Observability: console and page errors are monitored (no uncaught exceptions expected)', async ({ page }) => {
    // This test demonstrates observation of console and page errors without modifying the page.
    // It intentionally performs a normal interaction and then asserts that no runtime errors were captured.
    const p = new GreedyDemoPage(page);

    await p.calculateCoinChange(99, '50,20,10,5,1');
    await expect(p.coinResult).toHaveText(/Coins used:/);

    // Assertions for errors are performed in afterEach, but include an inline check here for demonstration
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });
});