import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/122bb0e1-fa7b-11f0-814c-dbec508f0b3b.html';

// Page Object representing the interactive app controls
class TimSortPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.input = page.locator('#input');
    this.addBtn = page.locator('#add');
    this.subtractBtn = page.locator('#subtract');
    this.multiplyBtn = page.locator('#multiply');
    this.divideBtn = page.locator('#divide');
    this.equalBtn = page.locator('#equal');
    this.clearBtn = page.locator('#clear');
    this.undoBtn = page.locator('#undo');
    this.redoBtn = page.locator('#redo');
    this.nextBtn = page.locator('#next');
    this.prevBtn = page.locator('#prev');
    this.output = page.locator('#output');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async setInput(text) {
    await this.input.fill(text);
  }

  async clickAdd() { await this.addBtn.click(); }
  async clickSubtract() { await this.subtractBtn.click(); }
  async clickMultiply() { await this.multiplyBtn.click(); }
  async clickDivide() { await this.divideBtn.click(); }
  async clickEqual() { await this.equalBtn.click(); }
  async clickClear() { await this.clearBtn.click(); }
  async clickUndo() { await this.undoBtn.click(); }
  async clickRedo() { await this.redoBtn.click(); }
  async clickNext() { await this.nextBtn.click(); }
  async clickPrev() { await this.prevBtn.click(); }

  async outputText() {
    // Use textContent to match innerText semantics for this test
    const txt = await this.output.textContent();
    return txt === null ? '' : txt;
  }

  async inputValue() {
    return await this.input.inputValue();
  }
}

test.describe('Tim Sort Interactive App - FSM based tests', () => {
  let pageErrors = [];
  let consoleErrors = [];

  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleErrors = [];

    // Capture uncaught page errors
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Capture console messages (especially errors)
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg);
      }
    });
  });

  test.describe('Initial render and Idle state (S0_Idle)', () => {
    test('renders expected controls and initial state', async ({ page }) => {
      // Verify entry render and presence of all components reflecting S0_Idle
      const app = new TimSortPage(page);
      await app.goto();

      // Check input placeholder and presence of buttons and output container
      await expect(app.input).toHaveAttribute('placeholder', 'Enter text');

      await expect(app.addBtn).toBeVisible();
      await expect(app.subtractBtn).toBeVisible();
      await expect(app.multiplyBtn).toBeVisible();
      await expect(app.divideBtn).toBeVisible();
      await expect(app.equalBtn).toBeVisible();
      await expect(app.clearBtn).toBeVisible();
      await expect(app.undoBtn).toBeVisible();
      await expect(app.redoBtn).toBeVisible();
      await expect(app.nextBtn).toBeVisible();
      await expect(app.prevBtn).toBeVisible();
      await expect(app.output).toBeVisible();

      // Initial output should be empty
      expect(await app.outputText()).toBe('');

      // Ensure no uncaught errors during initial render
      expect(pageErrors.map(String)).toEqual([]);
      expect(consoleErrors.map(m => m.text())).toEqual([]);
    });
  });

  test.describe('Text operations (Add, Subtract, Multiply, Divide, Equal)', () => {
    test('AddText appends input text with newline', async ({ page }) => {
      // This test validates the AddText transition and expected observable output.innerText += text + "\\n";
      const app = new TimSortPage(page);
      await app.goto();

      await app.setInput('Hello');
      await app.clickAdd();

      expect(await app.outputText()).toBe('Hello\n');

      // Add with empty input should not change output
      await app.setInput('');
      await app.clickAdd();
      expect(await app.outputText()).toBe('Hello\n');

      // No unexpected console/page errors
      expect(pageErrors.map(String)).toEqual([]);
      expect(consoleErrors.map(m => m.text())).toEqual([]);
    });

    test('SubtractText replaces last character-tail then appends new input', async ({ page }) => {
      // Validates subtractText: output.innerText = output.innerText.slice(0, -1) + text + "\\n";
      const app = new TimSortPage(page);
      await app.goto();

      // Prepare initial output
      await app.setInput('One');
      await app.clickAdd(); // "One\n"
      await app.setInput('Two');
      await app.clickAdd(); // "One\nTwo\n"

      // Now subtract with "X" should remove last char then append "X\n"
      await app.setInput('X');
      await app.clickSubtract();

      const expected = (() => {
        const prev = 'One\nTwo\n';
        return prev.slice(0, -1) + 'X\n';
      })();

      expect(await app.outputText()).toBe(expected);

      // Subtract with empty input should not change output
      await app.setInput('');
      const before = await app.outputText();
      await app.clickSubtract();
      expect(await app.outputText()).toBe(before);

      expect(pageErrors.map(String)).toEqual([]);
      expect(consoleErrors.map(m => m.text())).toEqual([]);
    });

    test('MultiplyText and DivideText append like Add', async ({ page }) => {
      // Both multiplyText and divideText append input text + newline if non-empty
      const app = new TimSortPage(page);
      await app.goto();

      await app.setInput('M1');
      await app.clickMultiply();
      expect(await app.outputText()).toBe('M1\n');

      await app.setInput('D1');
      await app.clickDivide();
      expect(await app.outputText()).toBe('M1\nD1\n');

      // Multiply with empty input shouldn't change
      await app.setInput('');
      await app.clickMultiply();
      expect(await app.outputText()).toBe('M1\nD1\n');

      expect(pageErrors.map(String)).toEqual([]);
      expect(consoleErrors.map(m => m.text())).toEqual([]);
    });

    test('EqualText replaces the last character/line ending with current input', async ({ page }) => {
      // equalText: output.innerText = output.innerText.slice(0, -1) + input.value + "\n";
      const app = new TimSortPage(page);
      await app.goto();

      // Prepare content
      await app.setInput('Alpha');
      await app.clickAdd(); // "Alpha\n"
      await app.setInput('Beta');
      await app.clickAdd(); // "Alpha\nBeta\n"

      // Use equal to overwrite tail
      await app.setInput('Gamma');
      await app.clickEqual();

      const prev = 'Alpha\nBeta\n';
      const expected = prev.slice(0, -1) + 'Gamma\n';
      expect(await app.outputText()).toBe(expected);

      // Edge case: when output is empty, equal will still perform slice and append newline
      await app.clickClear();
      await app.setInput('');
      await app.clickEqual();
      // prev output was '', slice(0, -1) gives '', input '' -> output becomes '\n'
      expect(await app.outputText()).toBe('\n');

      expect(pageErrors.map(String)).toEqual([]);
      expect(consoleErrors.map(m => m.text())).toEqual([]);
    });
  });

  test.describe('Stateful operations (Clear, Undo, Redo, Next, Prev) and edge cases', () => {
    test('ClearText empties both input and output', async ({ page }) => {
      // clearText should set output.innerText = '' and input.value = '';
      const app = new TimSortPage(page);
      await app.goto();

      await app.setInput('ToBeCleared');
      await app.clickAdd();
      expect(await app.outputText()).toContain('ToBeCleared');

      await app.clickClear();

      expect(await app.outputText()).toBe('');
      expect(await app.inputValue()).toBe('');

      expect(pageErrors.map(String)).toEqual([]);
      expect(consoleErrors.map(m => m.text())).toEqual([]);
    });

    test('UndoText removes the last character from output if present', async ({ page }) => {
      // undoText: output.innerText = output.innerText.slice(0, -1);
      const app = new TimSortPage(page);
      await app.goto();

      // Build output "ABC\n"
      await app.setInput('ABC');
      await app.clickAdd();
      expect(await app.outputText()).toBe('ABC\n');

      // Undo should remove the final newline (and last char)
      await app.clickUndo();
      expect(await app.outputText()).toBe('ABC');

      // Undo again will remove last char if non-empty
      await app.clickUndo();
      // previous 'ABC' -> slice(0,-1) => 'AB'
      expect(await app.outputText()).toBe('AB');

      // Undo on empty output should do nothing and not throw
      await app.clickClear();
      await app.clickUndo();
      expect(await app.outputText()).toBe('');

      expect(pageErrors.map(String)).toEqual([]);
      expect(consoleErrors.map(m => m.text())).toEqual([]);
    });

    test('RedoText performs slice-based idempotent transformation', async ({ page }) => {
      // redoText: output.innerText = output.innerText.slice(0, -1) + output.innerText.slice(-1);
      // For many inputs this is a no-op, but test that it doesn't crash and matches expected expression.
      const app = new TimSortPage(page);
      await app.goto();

      await app.setInput('Z');
      await app.clickAdd(); // "Z\n"
      const before = await app.outputText();
      await app.clickRedo();
      const after = await app.outputText();

      // Compute expected per implementation
      const expected = (() => {
        const s = before;
        return s.slice(0, -1) + s.slice(-1);
      })();

      expect(after).toBe(expected);

      // If empty, redo shouldn't change and shouldn't throw
      await app.clickClear();
      await app.clickRedo();
      expect(await app.outputText()).toBe('');

      expect(pageErrors.map(String)).toEqual([]);
      expect(consoleErrors.map(m => m.text())).toEqual([]);
    });

    test('NextText duplicates trailing newline when output non-empty, leaves empty output unchanged', async ({ page }) => {
      // nextText: output.innerText = text + '\n' if non-empty else ''
      const app = new TimSortPage(page);
      await app.goto();

      await app.setInput('L');
      await app.clickAdd(); // "L\n"
      await app.clickNext();
      expect(await app.outputText()).toBe('L\n\n');

      // For empty output must remain empty
      await app.clickClear();
      await app.clickNext();
      expect(await app.outputText()).toBe('');

      expect(pageErrors.map(String)).toEqual([]);
      expect(consoleErrors.map(m => m.text())).toEqual([]);
    });

    test('PrevText slices last char then appends newline if non-empty, leaves empty unchanged', async ({ page }) => {
      // prevText: output.innerText = text.slice(0, -1) + '\n' if non-empty else ''
      const app = new TimSortPage(page);
      await app.goto();

      await app.setInput('P');
      await app.clickAdd(); // "P\n"
      await app.clickPrev();

      // For "P\n", slice(0,-1) => "P", + '\n' => "P\n" (idempotent in this simple case)
      expect(await app.outputText()).toBe('P\n');

      // For empty output remains empty
      await app.clickClear();
      await app.clickPrev();
      expect(await app.outputText()).toBe('');

      expect(pageErrors.map(String)).toEqual([]);
      expect(consoleErrors.map(m => m.text())).toEqual([]);
    });
  });

  test.describe('Combinational and robustness scenarios', () => {
    test('Sequence of operations maintains consistent output and no exceptions', async ({ page }) => {
      // This test runs a longer sequence through many transitions to validate overall FSM stability.
      const app = new TimSortPage(page);
      await app.goto();

      // Build a few entries
      await app.setInput('a1'); await app.clickAdd();   // a1\n
      await app.setInput('b2'); await app.clickMultiply(); // a1\nb2\n
      await app.setInput('c3'); await app.clickDivide(); // a1\nb2\nc3\n

      // Modify last entry with equal
      await app.setInput('C3'); await app.clickEqual(); // a1\nb2\nC3\n

      // Undo once: remove last char
      await app.clickUndo();
      // Redo to reapply idempotent transform
      await app.clickRedo();

      // Prev and Next manipulations
      await app.clickPrev();
      await app.clickNext();

      // Subtract with new input
      await app.setInput('X'); await app.clickSubtract();

      // Final expected is constructed by simulating steps
      // Instead of exact string assembly, verify containment and newline structure
      const final = await app.outputText();
      expect(typeof final).toBe('string');
      // Should at least contain 'a1' and 'b2' and 'X' somewhere as the sequence included them
      expect(final).toContain('a1');
      expect(final).toContain('b2');
      expect(final).toContain('X');

      // No runtime errors during the long sequence
      expect(pageErrors.map(String)).toEqual([]);
      expect(consoleErrors.map(m => m.text())).toEqual([]);
    });

    test('Edge cases: clicking operations with empty input/output do not throw', async ({ page }) => {
      const app = new TimSortPage(page);
      await app.goto();

      // Ensure clear state
      await app.clickClear();

      // Sequence of clicks when input/output are empty
      await app.clickAdd();      // should be no-op
      await app.clickSubtract(); // no-op
      await app.clickMultiply(); // no-op
      await app.clickDivide();   // no-op
      await app.clickUndo();     // no-op
      await app.clickRedo();     // no-op
      await app.clickNext();     // stays empty
      await app.clickPrev();     // stays empty

      expect(await app.outputText()).toBe('');

      // equalText with empty input will produce a single newline per implementation
      await app.clickEqual();
      expect(await app.outputText()).toBe('\n');

      // Nothing should have produced uncaught exceptions
      expect(pageErrors.map(String)).toEqual([]);
      expect(consoleErrors.map(m => m.text())).toEqual([]);
    });
  });
});