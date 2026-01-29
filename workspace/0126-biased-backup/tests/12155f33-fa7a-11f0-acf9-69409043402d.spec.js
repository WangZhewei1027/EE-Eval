import { test, expect } from '@playwright/test';

const BASE_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/12155f33-fa7a-11f0-acf9-69409043402d.html';

/**
 * Page object helpers for the Thread Interactive app.
 */
class ThreadPage {
  constructor(page) {
    this.page = page;
  }

  // Navigate to the app and wait for main elements
  async goto() {
    await this.page.goto(BASE_URL);
    await Promise.all([
      this.page.waitForSelector('#threadList'),
      this.page.waitForSelector('#currentThread'),
      this.page.waitForSelector('#log'),
    ]);
  }

  // Return the textarea log content
  async getLog() {
    return await this.page.$eval('#log', el => el.value);
  }

  // Click a button by selector
  async click(selector) {
    await this.page.click(selector);
  }

  // Create a thread using the creation controls
  async createThread(name, priority) {
    if (name !== undefined) {
      await this.page.fill('#threadName', name);
    } else {
      await this.page.fill('#threadName', '');
    }
    if (priority !== undefined) {
      await this.page.fill('#threadPriority', String(priority));
    } else {
      await this.page.fill('#threadPriority', '');
    }
    await this.page.click('#createThreadBtn');
  }

  // Get option value for first option whose text includes the given substring
  async getOptionValueByText(selectSelector, textSubstr) {
    return await this.page.$eval(selectSelector, (sel, textSubstr) => {
      const options = Array.from(sel.options);
      const match = options.find(o => o.textContent.includes(textSubstr));
      return match ? match.value : null;
    }, textSubstr);
  }

  // Select an option by its value on a select element
  async selectByValue(selectSelector, value) {
    // page.selectOption expects value as string
    await this.page.selectOption(selectSelector, String(value));
    // dispatch change to ensure any change handlers react
    await this.page.$eval(selectSelector, el => el.dispatchEvent(new Event('change')));
  }

  // Get option text for the selected option in a select
  async getSelectedOptionText(selectSelector) {
    return await this.page.$eval(selectSelector, sel => {
      const s = sel;
      if (s.selectedIndex === -1) return null;
      return s.options[s.selectedIndex].textContent;
    });
  }

  // Set changePriority input and click apply
  async applyPriorityForSelected(newPriority) {
    await this.page.fill('#changePriority', String(newPriority));
    await this.page.click('#applyPriority');
  }

  // Set changeName input and click apply
  async applyNameForSelected(newName) {
    await this.page.fill('#changeName', String(newName));
    await this.page.click('#applyName');
  }

  // Send a message from one thread to another
  async sendMessage(fromNameSubstr, toNameSubstr, content) {
    const fromVal = await this.getOptionValueByText('#sendFromThread', fromNameSubstr);
    const toVal = await this.getOptionValueByText('#sendToThread', toNameSubstr);
    if (!fromVal || !toVal) throw new Error('Cannot find sendFrom/sendTo option values');

    await this.selectByValue('#sendFromThread', fromVal);
    await this.selectByValue('#sendToThread', toVal);
    await this.page.fill('#messageContent', content);
    await this.page.click('#sendMessageBtn');
  }

  // Perform a simulation step
  async stepSimulation() {
    await this.page.click('#stepSimulation');
  }

  // Clear the log via UI
  async clearLog() {
    await this.page.click('#clearLogBtn');
  }

  // Select a thread in the 'currentThread' control by name substring
  async selectCurrentThreadByName(nameSubstr) {
    const val = await this.getOptionValueByText('#currentThread', nameSubstr);
    if (!val) throw new Error(`No currentThread option matching ${nameSubstr}`);
    await this.selectByValue('#currentThread', val);
  }

  // Select a thread in the 'threadList' control by name substring
  async selectThreadListByName(nameSubstr) {
    const val = await this.getOptionValueByText('#threadList', nameSubstr);
    if (!val) throw new Error(`No threadList option matching ${nameSubstr}`);
    await this.selectByValue('#threadList', val);
  }

  // Delete selected thread in the threadList
  async deleteSelectedThread() {
    await this.page.click('#deleteThreadBtn');
  }

  // Helper to retrieve whether an option exists in a select by substring
  async hasOption(selectSelector, nameSubstr) {
    const val = await this.getOptionValueByText(selectSelector, nameSubstr);
    return !!val;
  }
}

// Global listeners containers so tests can assert on them
test.describe('Thread Concept Interactive Exploration - E2E', () => {
  let pageErrors;
  let consoleMessages;
  let dialogMessages;

  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleMessages = [];
    dialogMessages = [];

    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    page.on('dialog', async dialog => {
      // capture and accept/dismiss based on type
      dialogMessages.push({ type: dialog.type(), message: dialog.message() });
      // Accept confirmations/alerts/prompts to allow tests to continue
      try {
        await dialog.accept();
      } catch {
        try {
          await dialog.dismiss();
        } catch {
          // ignore
        }
      }
    });
  });

  test.describe('Initial state and basic UI', () => {
    test('Initial sample threads exist and app logs creation', async ({ page }) => {
      // Validate that the page loads and initial sample threads are present in selects and log mentions their creation.
      const tp = new ThreadPage(page);
      await tp.goto();

      const log = await tp.getLog();
      expect(log).toContain('Sample threads created: Main, WorkerA, WorkerB, Helper.');
      // Verify presence of sample threads in multiple selects
      expect(await tp.hasOption('#threadList', 'Main')).toBeTruthy();
      expect(await tp.hasOption('#currentThread', 'WorkerA')).toBeTruthy();
      expect(await tp.hasOption('#sendFromThread', 'WorkerB')).toBeTruthy();

      // Ensure no page runtime errors occurred on load
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Thread lifecycle transitions', () => {
    test('Start -> Pause -> Resume -> Stop -> Restart transitions update state and log', async ({ page }) => {
      // This test validates the major thread state transitions as exposed by the UI.
      const tp = new ThreadPage(page);
      await tp.goto();

      // Select the 'Main' thread to control
      await tp.selectCurrentThreadByName('Main');

      // Start
      await tp.click('#startThread');
      let selectedText = await tp.getSelectedOptionText('#currentThread');
      expect(selectedText).toContain('[RUNNING]');
      expect(await tp.getLog()).toContain('Thread "Main" started.');

      // Pause
      await tp.click('#pauseThread');
      selectedText = await tp.getSelectedOptionText('#currentThread');
      expect(selectedText).toContain('[PAUSED]');
      expect(await tp.getLog()).toContain('Thread "Main" paused.');

      // Resume
      await tp.click('#resumeThread');
      selectedText = await tp.getSelectedOptionText('#currentThread');
      expect(selectedText).toContain('[RUNNING]');
      expect(await tp.getLog()).toContain('Thread "Main" resumed.');

      // Stop
      await tp.click('#stopThread');
      selectedText = await tp.getSelectedOptionText('#currentThread');
      expect(selectedText).toContain('[STOPPED]');
      expect(await tp.getLog()).toContain('Thread "Main" stopped.');

      // Restart (only allowed from STOPPED)
      await tp.click('#restartThread');
      selectedText = await tp.getSelectedOptionText('#currentThread');
      expect(selectedText).toContain('[RUNNING]');
      expect(await tp.getLog()).toContain('Thread "Main" restarted');

      // Confirm no JS page errors in the transition sequence
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Thread creation, deletion and attributes', () => {
    test('Create thread with blank name and out-of-range priority applies defaults/clamping', async ({ page }) => {
      // Create a thread with empty name and priority > 10 to exercise input sanitization and defaulting
      const tp = new ThreadPage(page);
      await tp.goto();

      // Create with empty name and priority 20 (should clamp to 10)
      await tp.createThread('', 20);

      const log = await tp.getLog();
      // Created thread message should exist
      expect(log).toMatch(/Created thread ".+" with priority 10\./);

      // Confirm a thread entry exists in list with Pri: 10
      // Use a substring search for 'Pri: 10'
      const foundVal = await tp.getOptionValueByText('#threadList', 'Pri: 10');
      expect(foundVal).not.toBeNull();
    });

    test('Apply priority and name changes reflect in UI and log', async ({ page }) => {
      // This tests the applyPriorityChange and applyNameChange flows plus the currentThread change handler.
      const tp = new ThreadPage(page);
      await tp.goto();

      // Pick WorkerA to modify
      await tp.selectCurrentThreadByName('WorkerA');

      // Change priority to 2
      await tp.applyPriorityForSelected(2);
      let selectedText = await tp.getSelectedOptionText('#currentThread');
      expect(selectedText).toContain('Pri: 2');
      expect(await tp.getLog()).toContain('Changed priority of');

      // Change name to "WorkerA-Renamed"
      await tp.applyNameForSelected('WorkerA-Renamed');
      selectedText = await tp.getSelectedOptionText('#currentThread');
      expect(selectedText).toContain('WorkerA-Renamed');
      expect(await tp.getLog()).toContain('Changed thread name');

      // Ensure change inputs were used and selections updated (no page errors)
      expect(pageErrors.length).toBe(0);
    });

    test('Delete stopped thread succeeds and logs deletion; deleting with no selection alerts', async ({ page }) => {
      // This tests deleteThread behavior both when a thread is stopped (allowed) and when none is selected (alerts).
      const tp = new ThreadPage(page);
      await tp.goto();

      // Select 'Helper' and stop it first
      await tp.selectCurrentThreadByName('Helper');
      await tp.click('#stopThread');
      expect((await tp.getSelectedOptionText('#currentThread'))).toContain('[STOPPED]');

      // Now select that thread in the threadList and delete -> should succeed without confirm (state is stopped)
      await tp.selectThreadListByName('Helper');
      // Ensure the threadList actually has that option selected
      await tp.deleteSelectedThread();

      // After deletion, the option should no longer be present in the list
      const exists = await tp.hasOption('#threadList', 'Helper');
      expect(exists).toBe(false);
      expect(await tp.getLog()).toContain('Deleted thread');

      // Now create a scenario for "no selection" deletion to trigger an alert
      // Ensure one option exists, then set selectedIndex = -1 and attempt delete -> alert expected
      await page.evaluate(() => {
        const list = document.getElementById('threadList');
        list.selectedIndex = -1;
      });

      // Click delete; our dialog handler will capture the alert
      await tp.deleteSelectedThread();

      // We expect a dialog message about no thread selected
      const found = dialogMessages.find(d => d.message.includes('No thread selected for deletion.'));
      expect(found).toBeTruthy();
    });
  });

  test.describe('Messaging and simulation', () => {
    test('Send message enqueues and stepSimulation processes messages for running thread', async ({ page }) => {
      // This test validates sendMessage, stepSimulation, and processing logs.
      const tp = new ThreadPage(page);
      await tp.goto();

      // Ensure 'WorkerB' (receiver) is running so it can process a message
      await tp.selectCurrentThreadByName('WorkerB');
      await tp.click('#startThread');
      expect((await tp.getSelectedOptionText('#currentThread'))).toContain('[RUNNING]');

      // Send message from 'WorkerA' to 'WorkerB'
      await tp.sendMessage('WorkerA', 'WorkerB', 'Hello Playwright');
      // Verify send logged and input cleared
      let log = await tp.getLog();
      expect(log).toContain('Message sent from "WorkerA" to "WorkerB": "Hello Playwright"');

      // Now step the simulation -> WorkerB should process the message
      await tp.stepSimulation();

      log = await tp.getLog();
      expect(log).toMatch(/processed message: "Hello Playwright" from "WorkerA"/);

      // Also verify that stepSimulation logs 'No running threads' if none are running:
      // Stop WorkerB then step again
      await tp.click('#stopThread');
      expect((await tp.getSelectedOptionText('#currentThread'))).toContain('[STOPPED]');
      await tp.stepSimulation();
      expect(await tp.getLog()).toContain('No running threads to advance.');
    });

    test('Message UI validations: cannot send empty message or to same thread (alerts)', async ({ page }) => {
      // Validate error dialogs for bad messaging inputs
      const tp = new ThreadPage(page);
      await tp.goto();

      // Select same sender and receiver to trigger same-thread alert
      // Use first available option for both
      const firstOptionVal = await page.$eval('#sendFromThread', sel => sel.options[0].value);
      await tp.selectByValue('#sendFromThread', firstOptionVal);
      await tp.selectByValue('#sendToThread', firstOptionVal);

      // Fill empty message and click send -> code will alert 'Cannot send message to the same thread.' first
      await page.fill('#messageContent', 'This will not be sent');
      await tp.click('#sendMessageBtn');

      // Ensure dialog captured for same-thread
      let found = dialogMessages.find(d => d.message.includes('Cannot send message to the same thread.'));
      expect(found).toBeTruthy();

      // Now select valid different threads but empty message -> should alert about empty content
      // Choose different options if available
      const allToValues = await page.$$eval('#sendToThread option', opts => opts.map(o => o.value));
      if (allToValues.length >= 2) {
        await tp.selectByValue('#sendFromThread', allToValues[0]);
        await tp.selectByValue('#sendToThread', allToValues[1]);
        await page.fill('#messageContent', '');
        await tp.click('#sendMessageBtn');

        found = dialogMessages.find(d => d.message.includes('Message content cannot be empty.'));
        expect(found).toBeTruthy();
      } else {
        // If there aren't two distinct threads available, at least ensure no JS error occurred
        expect(pageErrors.length).toBe(0);
      }
    });
  });

  test.describe('Edge cases, dialogs and log management', () => {
    test('Invalid priority / name changes trigger alerts and clearLog empties the log', async ({ page }) => {
      // Test various edge validations that raise alerts and ensure clear log works
      const tp = new ThreadPage(page);
      await tp.goto();

      // Select a thread to control
      await tp.selectCurrentThreadByName('Main');

      // Try to apply an invalid priority (20 -> alert)
      await tp.applyPriorityForSelected(20);
      let found = dialogMessages.find(d => d.message.includes('Priority must be a number between 1 and 10.'));
      expect(found).toBeTruthy();

      // Try to apply an empty name -> alert
      await tp.page.fill('#changeName', '');
      await tp.click('#applyName');
      found = dialogMessages.find(d => d.message.includes('Name cannot be empty.'));
      expect(found).toBeTruthy();

      // Now ensure clearLog clears text area
      // Add some log content by creating a thread
      await tp.createThread('TempForClear', 4);
      let logBefore = await tp.getLog();
      expect(logBefore.length).toBeGreaterThan(0);

      await tp.clearLog();
      const logAfter = await tp.getLog();
      expect(logAfter).toBe('');
    });
  });

  test.afterEach(async ({ page }) => {
    // Final assertions about console/page errors to ensure app did not throw unexpected runtime exceptions
    // We assert that there were no uncaught page errors during the test suite.
    // Tests above have individually checked pageErrors in critical places; do a final check as well.
    expect(pageErrors.length).toBe(0);
    // It's acceptable for console messages to exist (the app uses console for nothing in current code),
    // but we still capture them to help debug if needed. Ensure no console messages of type 'error' exist.
    const errorConsole = consoleMessages.find(m => m.type === 'error');
    expect(errorConsole).toBeUndefined();
    // Dialog messages should have been captured during tests where expected; no further global assertions here.
  });
});