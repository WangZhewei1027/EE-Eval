import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/d3d80ca0-fa73-11f0-83e0-8d7be1d51901.html';

/**
 * Page Object Models for the three demos to keep tests readable.
 */
class CoinDemo {
  constructor(page) { this.page = page; }
  async coinsListText() { return this.page.locator('#coins-list').textContent(); }
  async remainingText() { return this.page.locator('#coin-remaining').textContent(); }
  async pickedText() { return this.page.locator('#coin-picked').textContent(); }
  async stepsText() { return this.page.locator('#coin-steps').textContent(); }
  async chipsCount() { return this.page.locator('#coins-chips .chip').count(); }
  async autoButtonText() { return this.page.locator('#coin-auto').textContent(); }
  async compareHTML() { return this.page.locator('#coin-compare').innerHTML(); }

  async selectCoinSet(value) {
    await this.page.selectOption('#coin-set', value);
    // change triggers coinReset via onchange
    // Wait for coins-list to update
    await this.page.waitForTimeout(50);
  }
  async setCustomCoins(value) {
    await this.page.fill('#custom-coins', value);
    // trigger change
    await this.page.dispatchEvent('#custom-coins', 'change');
    await this.page.waitForTimeout(50);
  }
  async setAmount(value) {
    await this.page.fill('#amount', String(value));
    await this.page.dispatchEvent('#amount', 'change');
    await this.page.waitForTimeout(50);
  }
  async clickNext() { await this.page.click('#coin-next'); }
  async clickReset() { await this.page.click('#coin-reset'); }
  async clickAuto() { await this.page.click('#coin-auto'); }
  async clickShowOpt() { await this.page.click('#coin-show-opt'); }
}

class ActivityDemo {
  constructor(page) { this.page = page; }
  async isVisible() {
    return (await this.page.locator('#panel-activity').evaluate(el => getComputedStyle(el).display !== 'none'));
  }
  async presetValue() { return this.page.locator('#activity-preset').inputValue(); }
  async selectPreset(value) {
    await this.page.selectOption('#activity-preset', value);
    // onchange triggers actReset
    await this.page.waitForTimeout(100);
  }
  async clickNext() { await this.page.click('#act-next'); }
  async clickReset() { await this.page.click('#act-reset'); }
  async clickAuto() { await this.page.click('#act-auto'); }
  async intervalListCount() { return this.page.locator('#interval-list .interval').count(); }
  async chosenCount() { return this.page.locator('#activity-chosen .chip').count(); }
  async barChosenCount() { return this.page.locator('#activity-bar .chosen').count(); }
}

class KnapDemo {
  constructor(page) { this.page = page; }
  async isVisible() {
    return (await this.page.locator('#panel-knap').evaluate(el => getComputedStyle(el).display !== 'none'));
  }
  async selectPreset(value) {
    await this.page.selectOption('#knap-preset', value);
    await this.page.waitForTimeout(50);
  }
  async setCapacity(value) {
    await this.page.fill('#knap-cap', String(value));
    await this.page.dispatchEvent('#knap-cap', 'change');
    await this.page.waitForTimeout(50);
  }
  async clickNext() { await this.page.click('#knap-next'); }
  async clickReset() { await this.page.click('#knap-reset'); }
  async clickAuto() { await this.page.click('#knap-auto'); }
  async remainingText() { return this.page.locator('#knap-rem').textContent(); }
  async itemsCount() { return this.page.locator('#knap-items .chip').count(); }
  async takenCount() { return this.page.locator('#knap-taken .chip').count(); }
  async totalValueText() { return this.page.locator('#knap-value').textContent(); }
}

/**
 * Global setup/teardown and capturing of console errors and page errors.
 * Each test will navigate to the app page and collect console messages / errors.
 */
test.describe('Greedy Algorithms Interactive