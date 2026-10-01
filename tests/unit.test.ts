import { test } from "node:test";
import assert from "node:assert/strict";

import { toEn, toFa, formatNumber, formatDay, formatToman } from "../src/lib/format";
import { rateLimit } from "../src/lib/rate-limit";
import { validateBaseUrl } from "../src/lib/llm-providers";
import { getChannelAdapter } from "../src/lib/channel-adapters";
import { encryptSecret, decryptSecret } from "../src/lib/crypto";

test("toEn converts Persian and Arabic-Indic digits", () => {
  assert.equal(toEn("۰۹۱۲۳۴۵۶۷۸۹"), "09123456789");
  assert.equal(toEn("٠٩١٢"), "0912");
  assert.equal(toEn("abc123"), "abc123");
});

test("toFa converts latin digits", () => {
  assert.equal(toFa("0123"), "۰۱۲۳");
});

test("formatNumber groups with Persian locale", () => {
  assert.equal(formatNumber(1234567), "۱٬۲۳۴٬۵۶۷");
  assert.equal(formatToman(1000), "۱٬۰۰۰ تومان");
});

test("formatDay does not shift the day across timezones", () => {
  assert.equal(formatDay("2026-03-21"), "۱ فروردین");
});

test("rateLimit blocks after the limit and allows other keys", () => {
  const key = `test:${Math.random()}`;
  for (let i = 0; i < 3; i++) {
    assert.equal(rateLimit(key, 3, 60_000).ok, true);
  }
  const blocked = rateLimit(key, 3, 60_000);
  assert.equal(blocked.ok, false);
  assert.ok(blocked.retryAfterSec >= 1);
  assert.equal(rateLimit(`other:${Math.random()}`, 3, 60_000).ok, true);
});

test("validateBaseUrl rejects SSRF targets and non-https", () => {
  assert.equal(validateBaseUrl("http://api.openai.com/v1").ok, false);
  assert.equal(validateBaseUrl("https://127.0.0.1/v1").ok, false);
  assert.equal(validateBaseUrl("https://169.254.169.254/latest/meta-data").ok, false);
  assert.equal(validateBaseUrl("https://10.0.0.5/v1").ok, false);
  assert.equal(validateBaseUrl("https://localhost:8080/v1").ok, false);
  assert.equal(validateBaseUrl("not a url").ok, false);
  assert.equal(validateBaseUrl("https://api.openai.com/v1/").ok, true);
});

test("telegram adapter verifies webhook secret and extracts event key", () => {
  const adapter = getChannelAdapter("telegram");
  assert.ok(adapter);
  const ctx = { secret: "s3cret", credentials: {} };
  assert.equal(adapter.verifyWebhook({ "x-telegram-bot-api-secret-token": "s3cret" }, "", ctx), true);
  assert.equal(adapter.verifyWebhook({ "x-telegram-bot-api-secret-token": "wrong" }, "", ctx), false);
  assert.equal(adapter.verifyWebhook({}, "", ctx), false);

  const parsed = adapter.parseIncomingMessage({
    update_id: 42,
    message: { message_id: 7, text: "سلام", chat: { id: 123 }, from: { first_name: "علی" } },
  });
  assert.ok(parsed);
  assert.equal(parsed.eventKey, "42");
  assert.equal(parsed.senderId, "123");
  assert.equal(parsed.text, "سلام");
});

test("instagram adapter rejects missing app secret", () => {
  const adapter = getChannelAdapter("instagram");
  assert.ok(adapter);
  assert.equal(adapter.verifyWebhook({}, "{}", { secret: "x", credentials: {} }), false);
});

test("stub adapters reject webhooks instead of accepting everything", () => {
  for (const platform of ["widget", "voice", "airbnb"]) {
    const adapter = getChannelAdapter(platform);
    assert.ok(adapter);
    assert.equal(adapter.verifyWebhook({}, "{}", { secret: "x", credentials: {} }), false, platform);
  }
});

test("secret encryption round-trips and leaves legacy plaintext readable", () => {
  const plain = JSON.stringify({ botToken: "123:ABC", apiKey: "sk-test" });
  const encrypted = encryptSecret(plain);
  assert.notEqual(encrypted, plain);
  assert.ok(encrypted.startsWith("enc:v1:"));
  assert.equal(decryptSecret(encrypted), plain);
  assert.equal(decryptSecret('{"legacy":true}'), '{"legacy":true}');
  assert.equal(encryptSecret(encrypted), encrypted, "already encrypted values are not double-encrypted");
});
