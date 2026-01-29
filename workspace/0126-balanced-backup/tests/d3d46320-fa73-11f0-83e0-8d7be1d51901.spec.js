import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/d3d46320-fa73-11f0-83e0-8d7be1d51901.html';

// Page object encapsulating common interactions and queries for the demo
class DoublyLinkedListPage {
  constructor(page) {
    this.page = page;
    this.dialogs = [];
    this.consoleMessages = [];
    this.pageErrors = [];

    // Collect dialogs, console messages, and page errors for assertions
    this.page.on('dialog', async (dialog) => {
      try {
        this.dialogs.push(dialog.message());
        await dialog.accept();
      } catch (err) {
        // ignore
      }
    });

    this.page.on('console', msg => {
      try {
        this.consoleMessages.push(msg.text());
      } catch (err) {
        // ignore
      }
    });

    this.page.on('pageerror', error => {
      this.pageErrors.push(error);
    });
  }

  // wait for initialization log and basic UI parts
  async waitForReady() {
    await this.page.goto(APP_URL);
    // Wait for DOM elements to be present
    await Promise.all([
      this.page.waitForSelector('#listRow'),
      this.page.waitForSelector('#forwardView'),
      this.page.waitForSelector('#backwardView'),
      this.page.waitForSelector('#logArea'),
    ]);
    // Wait for the demo init log to appear in the log area
    await this.page.waitForFunction(() => {
      const log = document.getElementById('logArea');
      return log && /Demo initialized/.test(log.textContent || '');
    });
  }

  // Helpers to interact with controls
  async fillValue(val) {
    await this.page.fill('#valueInput', String(val));
  }

  async fillTarget(val) {
    await this.page.fill('#targetValueInput', String(val));
  }

  async setRemoveIndex(idx) {
    await this.page.fill('#removeIndex', String(idx));
  }

  async clickInsertHead() {
    await this.page.click('#insertHeadBtn');
  }
  async clickInsertTail() {
    await this.page.click('#insertTailBtn');
  }
  async clickInsertAfterSelected() {
    await this.page.click('#insertAfterBtn');
  }
  async clickInsertAfterValue() {
    await this.page.click('#insertAfterValBtn');
  }
  async clickRemoveByValue() {
    await this.page.click('#removeValueBtn');
  }
  async clickRemoveAtIndex() {
    await this.page.click('#removeIndexBtn');
  }
  async clickSearch() {
    await this.page.click('#searchBtn');
  }
  async clickClear() {
    await this.page.click('#clearBtn');
  }
  async clickRandomize