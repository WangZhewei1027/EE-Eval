import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/d3dc2b51-fa73-11f0-83e0-8d7be1d51901.html';

// Page Object Model for the demo page
class DemoPage {
  constructor(page) {
    this.page = page;
    // Simple cipher
    this.simplePlain = page.locator('#simple-plaintext');
    this.simpleOut = page.locator('#simple-output');
    this.simpleAlgo = page.locator('#simple-algo');
    this.shift = page.locator('#shift');
    this.shiftVal = page.locator('#shift-val');
    this.vigenereKey = page.locator('#vigenere-key');
    this.simpleEncryptBtn = page.locator('#simple-encrypt');
    this.simpleDecryptBtn = page.locator('#simple-decrypt');
    this.simpleClearBtn = page.locator('#simple-clear');

    // AES
    this.aesPlain = page.locator('#aes-plaintext');
    this.aesGenBtn = page.locator('#aes-gen');
    this.aesEncryptBtn = page.locator('#aes-encrypt');
    this.aesDecryptBtn = page.locator('#aes-decrypt');
    this.aesExportBtn = page.locator('#aes-export');
    this.aesIv = page.locator('#aes-iv');
    this.aesCipher = page.locator('#aes-cipher');
    this.aesKey = page.locator('#aes-key');
    this.aesDecrypted = page.locator('#aes-decrypted');