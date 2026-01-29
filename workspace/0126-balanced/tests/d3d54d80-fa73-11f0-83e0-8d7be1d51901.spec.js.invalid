import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/d3d54d80-fa73-11f0-83e0-8d7be1d51901.html';

/**
 * Page object representing the Binary Search Tree demo page.
 * Encapsulates common interactions so tests are more readable.
 */
class BSTPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.dialogs = [];
    this.console = [];
    this.pageErrors = [];

    // capture dialogs to allow assertions and avoid blocking
    this.page.on('dialog', async (dialog) => {
      this.dialogs.push({ type: dialog.type(), message: dialog.message() });
      try {
        // accept alerts/prompts so the page continues without user intervention
        await dialog.accept();
      } catch (e) {
        // ignore acceptance errors
      }
    });

    // capture console messages for assertions
    this.page.on('console', (msg) => {
      this.console.push({ type: msg.type(), text: msg.text() });
    });

    // capture runtime page errors
    this.page.on('pageerror', (err) => {
      this.pageErrors.push(err);
    });
  }

  // element getters
  async valueInput() { return this.page.locator('#valueInput'); }
  async countInput() { return this.page.locator('#countInput'); }
  async insertBtn() { return this.page.locator('#insertBtn'); }
  async removeBtn() { return this.page.locator('#removeBtn'); }
  async searchBtn() { return this.page.locator('#searchBtn'); }
  async randomBtn() { return this.page.locator('#randomBtn'); }
  async clearBtn() { return this.page.locator('#clearBtn'); }
  async preorderBtn() { return this.page.locator('#preorderBtn'); }
  async inorderBtn() { return this.page.locator('#inorderBtn'); }
  async postorderBtn() { return this.page.locator('#postorderBtn'); }
  async levelBtn() { return this.page.locator('#levelBtn'); }
  async balanceCheckBtn() { return this.page.locator('#balanceCheckBtn'); }
  async exportBtn() { return this.page.locator('#exportBtn'); }
  async clearLogBtn() { return this.page.locator('#clearLog'); }
  async exampleBtn() { return this.page.locator('#exampleBtn'); }

  // stats
  async nodeCountText() { return (await this.page.locator('#nodeCount').innerText()).trim(); }
  async treeHeightText() { return (await this.page.locator('#treeHeight').innerText()).trim(); }
  async rootValText() { return (await this.page.locator('#rootVal').innerText()).trim(); }
  async balancedText() { return (await this.page.locator('#balanced').innerText()).trim(); }
  async logText() { return (await this.page.locator('#log').innerText()).trim(); }

  // svg placeholder presence
  async svgContainsPlaceholder() {
    const svgText = await this.page.locator('svg').innerText();
    return svgText.includes('Tree is empty');
  }

  // basic interactions
  async navigate() {
    await this.page.goto(APP_URL, { waitUntil: 'networkidle' });
    // wait for initial render
    await this.page.waitForSelector('#svgCanvas');
  }

  async insertValue(val) {
    if (val !== null && val !== undefined) {
      await this.valueInput().fill(String(val));
    }
    await this.insertBtn().click();
  }

  async removeValue(val) {
    if (val !== null && val !== undefined) {
      await this.valueInput().fill(String(val));
    }
    await this.removeBtn().click();
  }

  async searchValue(val