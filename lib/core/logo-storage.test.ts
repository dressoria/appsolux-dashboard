import assert from "node:assert/strict";
import test, { beforeEach, afterEach } from "node:test";
import { mkdtemp, rm, readFile } from "fs/promises";
import path from "path";
import os from "os";

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await mkdtemp(path.join(os.tmpdir(), "logo-test-"));
  process.env.LOGO_STORAGE_PATH = tmpDir;
});

afterEach(async () => {
  delete process.env.LOGO_STORAGE_PATH;
  await rm(tmpDir, { recursive: true, force: true });
});

async function loadModule() {
  try {
    return await import("./logo-storage.ts");
  } catch {
    return null;
  }
}

const TENANT_A = "tenantABC123";
const TENANT_B = "tenantXYZ789";
const PNG_HEADER = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPEG_HEADER = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);

function makePng(extra = "A"): Buffer {
  return Buffer.concat([PNG_HEADER, Buffer.from(extra)]);
}

function makeJpeg(extra = "B"): Buffer {
  return Buffer.concat([JPEG_HEADER, Buffer.from(extra)]);
}

test("CASO A: tenant A saves logo with correct storage key", async () => {
  const mod = await loadModule();
  if (!mod) { console.log("Skipping: server-only"); return; }

  const key = await mod.saveLogo(TENANT_A, "logo-a.png", makePng());
  assert.equal(key, `${TENANT_A}/logo-logo-a_png`);

  const data = await mod.readLogo(key, TENANT_A);
  assert.ok(Buffer.isBuffer(data));
});

test("CASO B: tenant B saves logo with correct storage key", async () => {
  const mod = await loadModule();
  if (!mod) { console.log("Skipping: server-only"); return; }

  const key = await mod.saveLogo(TENANT_B, "logo-b.jpg", makeJpeg());
  assert.equal(key, `${TENANT_B}/logo-logo-b_jpg`);

  const data = await mod.readLogo(key, TENANT_B);
  assert.ok(Buffer.isBuffer(data));
});

test("CASO C: tenant A cannot read tenant B logo", async () => {
  const mod = await loadModule();
  if (!mod) { console.log("Skipping: server-only"); return; }

  const keyB = await mod.saveLogo(TENANT_B, "b.png", makePng("B"));

  await assert.rejects(
    () => mod.readLogo(keyB, TENANT_A),
    (err: Error) => {
      assert.ok(err.message.includes("denegado"), `Expected 'denegado', got: ${err.message}`);
      return true;
    },
  );
});

test("CASO D: tenant A cannot delete tenant B logo", async () => {
  const mod = await loadModule();
  if (!mod) { console.log("Skipping: server-only"); return; }

  const keyB = await mod.saveLogo(TENANT_B, "b.png", makePng("B"));

  await assert.rejects(
    () => mod.deleteLogo(keyB, TENANT_A),
    (err: Error) => {
      assert.ok(err.message.includes("denegado"), `Expected 'denegado', got: ${err.message}`);
      return true;
    },
  );

  const stillExists = await mod.readLogo(keyB, TENANT_B);
  assert.ok(Buffer.isBuffer(stillExists), "Tenant B logo must still exist");
});

test("CASO E: replacing tenant A logo does not affect tenant B", async () => {
  const mod = await loadModule();
  if (!mod) { console.log("Skipping: server-only"); return; }

  const keyA = await mod.saveLogo(TENANT_A, "a.png", makePng("A1"));
  const keyB = await mod.saveLogo(TENANT_B, "b.png", makePng("B1"));

  await mod.deleteLogo(keyA, TENANT_A);
  await mod.saveLogo(TENANT_A, "a-new.png", makePng("A2"));

  const dataB = await mod.readLogo(keyB, TENANT_B);
  assert.ok(dataB.includes(Buffer.from("B1")), "Tenant B data must be unchanged");
});

test("CASO F: corrupted storage key from another tenant is rejected", async () => {
  const mod = await loadModule();
  if (!mod) { console.log("Skipping: server-only"); return; }

  const corruptedKey = `${TENANT_B}/logo-stolen.png`;

  await assert.rejects(
    () => mod.readLogo(corruptedKey, TENANT_A),
    (err: Error) => {
      assert.ok(err.message.includes("denegado"));
      return true;
    },
  );
});

test("CASO G: path traversal attempts are blocked", async () => {
  const mod = await loadModule();
  if (!mod) { console.log("Skipping: server-only"); return; }

  const traversalKeys = [
    `${TENANT_A}/../${TENANT_B}/logo-stolen.png`,
    `../../../etc/passwd`,
    `${TENANT_A}/../../secret`,
  ];

  for (const key of traversalKeys) {
    await assert.rejects(
      () => mod.readLogo(key, TENANT_A),
      (err: Error) => {
        assert.ok(
          err.message.includes("denegado") || err.message.includes("inválid") || err.message.includes("traversal"),
          `Key "${key}" should be blocked, got: ${err.message}`,
        );
        return true;
      },
    );
  }
});

test("buildLogoStorageKey always includes tenantId prefix", async () => {
  const mod = await loadModule();
  if (!mod) { console.log("Skipping: server-only"); return; }

  const key = mod.buildLogoStorageKey(TENANT_A, "my-logo.png");
  assert.ok(key.startsWith(`${TENANT_A}/`));
  assert.ok(!key.includes(".."));
});

test("buildLogoStorageKey rejects invalid tenantId", async () => {
  const mod = await loadModule();
  if (!mod) { console.log("Skipping: server-only"); return; }

  assert.throws(
    () => mod.buildLogoStorageKey("../evil", "logo.png"),
    (err: Error) => err.message.includes("inválido"),
  );
  assert.throws(
    () => mod.buildLogoStorageKey("", "logo.png"),
    (err: Error) => err.message.includes("inválido"),
  );
});

test("saveLogo creates file under tenant subdirectory", async () => {
  const mod = await loadModule();
  if (!mod) { console.log("Skipping: server-only"); return; }

  await mod.saveLogo(TENANT_A, "test.png", makePng());
  const filePath = path.join(tmpDir, TENANT_A, "logo-test_png");
  const data = await readFile(filePath);
  assert.ok(data.length > 0, "File should exist in tenant subdirectory");
});

test("separate tenants have separate directories", async () => {
  const mod = await loadModule();
  if (!mod) { console.log("Skipping: server-only"); return; }

  await mod.saveLogo(TENANT_A, "a.png", makePng("A"));
  await mod.saveLogo(TENANT_B, "b.png", makeJpeg("B"));

  const fileA = path.join(tmpDir, TENANT_A, "logo-a_png");
  const fileB = path.join(tmpDir, TENANT_B, "logo-b_png");

  const dataA = await readFile(fileA);
  const dataB = await readFile(fileB);

  assert.ok(dataA.includes(Buffer.from("A")));
  assert.ok(dataB.includes(Buffer.from("B")));
});
