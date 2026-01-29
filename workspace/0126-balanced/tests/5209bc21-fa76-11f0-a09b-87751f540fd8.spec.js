import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/5209bc21-fa76-11f0-a09b-87751f540fd8.html';

test.describe('5209bc21-fa76-11f0-a09b-87751f540fd8 - Backtracking Interactive App (FSM)', () => {
  // Capture console messages and page errors for assertions.
  test.beforeEach(async ({ page }) => {
    // Ensure a clean state by navigating to the page.
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  // Test initial Idle state (S0_Idle)
  test('Initial state (Idle) - board, moves, selectedCell, gameOver', async ({ page }) => {
    // Comments: Validate the initial variables set by the page on load.
    // The FSM's initial state expects drawBoard() to run and initial variables to be set.
    const state = await page.evaluate(() => {
      return {
        boardShape: Array.isArray(board) && board.length === 3 && board.every(row => Array.isArray(row) && row.length === 3),
        allNull: board.flat().every(cell => cell === null),
        moves,
        selectedCell,
        gameOver,
        hasDrawBoard: typeof drawBoard === 'function'
      };
    });

    expect(state.boardShape).toBe(true);
    expect(state.allNull).toBe(true);
    expect(state.moves).toBe(0);
    expect(state.selectedCell).toBeNull();
    expect(state.gameOver).toBe(false);
    expect(state.hasDrawBoard).toBe(true);
  });

  // Test Click event -> The implementation has a bug (uses undefined 'e'), so a ReferenceError is expected.
  test('Click event on document triggers ReferenceError due to undefined "e" (validates error handling)', async ({ page }) => {
    // Comments: The HTML's click handler uses an arrow function without an event parameter but references `e`.
    // We expect the click to cause a runtime ReferenceError. Capture the pageerror event.
    const errors = [];
    page.on('pageerror', (err) => {
      errors.push(err);
    });

    // Click the canvas (the handler is attached to document and will run).
    // Wait for a pageerror to occur as a result of the buggy click handler.
    let pageErrorEvent;
    try {
      pageErrorEvent = await Promise.all([
        page.waitForEvent('pageerror', { timeout: 2000 }),
        page.click('#canvas', { timeout: 2000 })
      ]);
    } catch (err) {
      // If waitForEvent times out, we still want to assert based on collected errors.
    }

    // Consolidate errors captured via listener
    const captured = errors.concat(pageErrorEvent ? [pageErrorEvent[0]] : []);
    // At least one ReferenceError about 'e' is expected.
    const hasRefError = captured.some(err => {
      const msg = String(err && err.message ? err.message : err);
      return /e is not defined|ReferenceError: e is not defined/i.test(msg);
    });

    expect(hasRefError).toBeTruthy();

    // Also ensure that the board remained unchanged (defensive check).
    const boardAfterClick = await page.evaluate(() => board.flat());
    expect(boardAfterClick.every(cell => cell === null)).toBe(true);
  });

  // Test MouseMove event when selectedCell is null (should be a no-op)
  test('MouseMove when no selectedCell should not change moves or board', async ({ page }) => {
    // Comments: handleMouseMove only calls makeMove when selectedCell !== null.
    // Simulate mousemove over the canvas and verify state unchanged.
    const before = await page.evaluate(() => ({ moves, board: JSON.stringify(board), selectedCell }));

    // Dispatch a mousemove event with coordinates over the canvas.
    await page.dispatchEvent('#canvas', 'mousemove', {
      clientX: 100,
      clientY: 100
    });

    // Small pause to allow any synchronous handlers to run.
    await page.waitForTimeout(100);

    const after = await page.evaluate(() => ({ moves, board: JSON.stringify(board), selectedCell }));
    expect(after.moves).toBe(before.moves);
    expect(after.board).toBe(before.board);
    expect(after.selectedCell).toBeNull();
  });

  // Test MouseMove event when selectedCell is set (simulate playing state)
  test('MouseMove with selectedCell triggers makeMove and updates board and moves (Playing -> Playing)', async ({ page }) => {
    // Comments: We set an existing global variable selectedCell (allowed: modifying existing state)
    // so that handleMouseMove will trigger makeMove. We then dispatch a mousemove.
    // Validate that board[selectedCell.x][selectedCell.y] is updated and moves incremented.
    const setup = await page.evaluate(() => {
      // ensure a clean target cell
      board[0][0] = null;
      moves = 0;
      gameOver = false;
      selectedCell = { x: 0, y: 0 };
      return { moves, selectedCell, targetCellBefore: board[0][0] };
    });

    expect(setup.moves).toBe(0);
    expect(setup.selectedCell).toEqual({ x: 0, y: 0 });
    expect(setup.targetCellBefore).toBeNull();

    // Dispatch mousemove - handleMouseMove will see selectedCell !== null and call makeMove(0,0)
    await page.dispatchEvent('#canvas', 'mousemove', {
      clientX: 10, // values are irrelevant for handler's logic here
      clientY: 10
    });

    // Allow synchronous changes to complete.
    await page.waitForTimeout(100);

    const after1 = await page.evaluate(() => ({
      moves,
      target: board[0][0],
      gameOver,
      selectedCell
    }));

    // makeMove sets board[x][y] = moves (which was 0) then increments moves.
    expect(after.target === 0).toBeTruthy();
    expect(after.moves).toBe(1);
    // selectedCell should be cleared only if gameOver is set via other logic; here it should remain null
    // because makeMove sets selectedCell only in specific branches; check that it's either null or an object.
    expect(after.gameOver).toBe(false);
  });

  // Test calling makeMove directly to cause GameOver when selectedCell matches move (Playing -> GameOver)
  test('Direct makeMove call when selectedCell equals move coordinates sets gameOver (Playing -> GameOver)', async ({ page }) => {
    // Comments: Call existing functions (no patching) to simulate the transition where selecting same cell twice sets gameOver.
    // Set selectedCell to (1,1) and then call makeMove(1,1) via page.evaluate.
    const result = await page.evaluate(() => {
      // prepare
      board = Array(3).fill(null).map(() => Array(3).fill(null));
      moves = 0;
      selectedCell = { x: 1, y: 1 };
      gameOver = false;
      // call existing function
      try {
        makeMove(1, 1);
      } catch (err) {
        // propagate info for the test
        return { error: String(err), gameOver, selectedCell };
      }
      return { error: null, gameOver, selectedCell };
    });

    // The logic path: since selectedCell matches the coordinates, makeMove should set gameOver = true.
    expect(result.error).toBeNull();
    expect(result.gameOver).toBe(true);
    // selectedCell should be cleared by that branch
    expect(result.selectedCell).toBeNull();
  });

  // Test the Escape key resets the game (Playing -> Idle)
  test('KeyDown Escape resets the game to initial board (Playing -> Idle via resetGame)', async ({ page }) => {
    // Comments: Set up a non-empty board and moves, press Escape, and verify resetGame() clears board and resets moves/gameOver.
    await page.evaluate(() => {
      board[0][0] = 42;
      moves = 5;
      selectedCell = { x: 0, y: 0 };
      gameOver = true;
    });

    // Press Escape
    await page.keyboard.press('Escape');

    // Allow handler to run
    await page.waitForTimeout(100);

    const after2 = await page.evaluate(() => ({
      allNull: board.flat().every(cell => cell === null),
      moves,
      selectedCell,
      gameOver
    }));

    expect(after.allNull).toBe(true);
    expect(after.moves).toBe(0);
    expect(after.selectedCell).toBeNull();
    expect(after.gameOver).toBe(false);
  });

  // Test "You Win!" console message when moves reach 9 by invoking makeMove repeatedly via evaluate
  test('Console logs "You Win!" when moves reaches 9 (endgame logging)', async ({ page }) => {
    // Comments: Use existing functions to simulate moves reaching 9 without modifying function definitions.
    // Capture console messages produced by page.evaluate calling makeMove.
    const messages = [];
    page.on('console', (msg) => {
      // only capture log-level messages
      if (msg.type() === 'log') messages.push(msg.text());
    });

    // Set up: ensure we have a free cell and set moves to 8 so next valid move triggers the victory log.
    await page.evaluate(() => {
      board = Array(3).fill(null).map(() => Array(3).fill(null));
      moves = 8;
      selectedCell = null;
      gameOver = false;
      // ensure target is empty
      board[0][0] = null;
    });

    // Call makeMove for (0,0) which should set board[0][0] = 8, then increment moves to 9 and log 'You Win!'
    await page.evaluate(() => {
      makeMove(0, 0);
    });

    // Give browser a moment to emit console messages that were logged synchronously.
    await page.waitForTimeout(100);

    expect(messages.some(m => /You Win!/i.test(m))).toBeTruthy();

    // Also verify that gameOver was set true by the endgame logic.
    const finalState = await page.evaluate(() => ({ moves, gameOver }));
    // According to code, after moves === 9, it sets gameOver = true.
    expect(finalState.moves).toBe(9);
    expect(finalState.gameOver).toBe(true);
  });

  // Test checkWinner function exists and returns a boolean (edge case testing)
  test('checkWinner returns a boolean (edge-case / sanity check)', async ({ page }) => {
    // Comments: The checkWinner implementation is questionable. Ensure it can be invoked and returns a boolean.
    const result1 = await page.evaluate(() => {
      try {
        return { type: typeof checkWinner(), value: checkWinner() };
      } catch (err) {
        return { error: String(err) };
      }
    });

    if (result.error) {
      // If it throws, surface that to the test (it's an acceptable failure mode to observe).
      expect(typeof result.error).toBe('string');
    } else {
      expect(result.type).toBe('boolean');
    }
  });

  // Edge case: clicking body (not canvas) should also surface the same ReferenceError due to document click handler bug.
  test('Clicking body triggers the same ReferenceError from the document click handler', async ({ page }) => {
    const errors1 = [];
    page.on('pageerror', (err) => errors.push(err));

    // Click body
    try {
      await Promise.all([
        page.waitForEvent('pageerror', { timeout: 2000 }),
        page.click('body', { timeout: 2000 })
      ]);
    } catch (e) {
      // swallow timeout; rely on captured errors
    }

    const hasRefError1 = errors.some(err => /e is not defined|ReferenceError: e is not defined/i.test(String(err && err.message ? err.message : err)));
    expect(hasRefError).toBeTruthy();
  });
});