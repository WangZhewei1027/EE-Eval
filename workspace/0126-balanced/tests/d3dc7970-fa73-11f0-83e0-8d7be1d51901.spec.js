import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/d3dc7970-fa73-11f0-83e0-8d7be1d51901.html';

// Page object encapsulating common interactions and selectors
class AuthPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.sel = {
      regUser: '#regUser',
      regPass: '#regPass',
      reg2fa: '#reg2fa',
      btnRegister: '#btnRegister',
      btnClearUsers: '#btnClearUsers',

      loginUser: '#loginUser',
      loginPass: '#loginPass',
      remember: '#remember',
      btnLogin: '#btnLogin',
      btnLogout: '#btnLogout',
      loginResult: '#loginResult',

      otpSection: '#otpSection',
      otpInput: '#otpInput',
      btnVerifyOtp: '#btnVerifyOtp',
      btnResendOtp: '#btnResendOtp',
      otpSent: '#otpSent',

      tokenView: '#tokenView',
      tokenPayload: '#tokenPayload',
      btnInspect: '#btnInspect',
      btnClearToken: '#btnClearToken',

      demoPass: '#demoPass',
      btnHashDemo: '#btnHashDemo',
      plainView: '#plainView',
      saltedView: '#saltedView',

      usersView: '#usersView'
    };
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  // Helpers for reading UI state
  async getUsersText() {
    return (await this.page.locator(this.sel.usersView).textContent())?.trim();
  }
  async getTokenText() {
    return (await this.page.locator(this.sel.tokenView).textContent())?.trim();
  }
  async getTokenPayloadText() {
    return (await this.page.locator(this.sel.tokenPayload).textContent())?.trim();
  }
  async getLoginResultText() {
    return (await this.page.locator(this.sel.loginResult).textContent())?.trim();
  }
  async getOtpSectionVisible() {
    const el = this.page.locator(this.sel.otpSection);
    return (await el.evaluate((e) => e.style.display !== 'none'));
  }
  async getOtpSentText() {
    return (await this.page.locator(this.sel.otpSent).textContent())?.trim();
  }
  async getPlainViewText() {
    return (await this.page.locator(this.sel.plainView).textContent())?.trim();
  }
  async getSaltedViewText() {
    return (await this.page.locator(this.sel.saltedView).textContent())?.trim();
  }

  // Actions
  async register(username, password, enable2fa = false) {
    await this.page.fill(this.sel.regUser, username);
    await this.page.fill(this.sel.regPass, password);
    const reg2fa = this.page.locator(this.sel.reg2fa);
    const isChecked = await reg2fa.isChecked();
    if (isChecked !== enable2fa) {
      await reg2fa.click();
    }

    await this.page.click(this.sel.btnRegister);
  }

  async clearUsers(acceptConfirm = true) {
    // This triggers a confirm dialog; tests typically accept.
    this.page.once('dialog', async (dialog) => {
      if (acceptConfirm) await dialog.accept();
      else await dialog.dismiss();
    });
    await this.page.click(this.sel.btnClearUsers);
  }

  async login(username, password, remember = false) {
    await this.page.fill(this.sel.loginUser, username);
    await this.page.fill(this.sel.loginPass, password);
    const rem = this.page.locator(this.sel.remember);
    if ((await rem.isChecked()) !== remember) {
      await rem.click();
    }
    await this.page.click(this.sel.btnLogin);
  }

  async logout() {
    // logout triggers no confirm, but shows UI updates and clears token
    await this.page.click(this.sel.btnLogout);
  }

  async verifyOtp(code) {
    await this.page.fill(this.sel.otpInput, code);
    await this.page.click(this.sel.btnVerifyOtp);
  }

  async resendOtp() {
    await this.page.click(this.sel.btnResendOtp);
  }

  async inspectToken() {
    // If no token, this triggers an alert dialog. Caller may handle.
    await this.page.click(this.sel.btnInspect);
  }

  async clearToken(acceptAlert = true) {
    // btnClearToken triggers alert('Token cleared.'); we accept to continue
    this.page.once('dialog', async (dialog) => {
      if (