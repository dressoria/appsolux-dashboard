import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { handleTaxRequest, type TaxEndpoint } from "./api";
import type { AppsoluxUser } from "@/types/user";
import type { AppsoluxTenant } from "@/types/tenant";
import { parseTaxPeriod } from "./tax-period";
import type { TaxSnapshot } from "./types";

const user = { id: "user-a" } as AppsoluxUser;
const tenant = { id: "tenant-a", name: "Empresa A" } as AppsoluxTenant;
const noSync = {
  available: false as const,
  syncStatus: "PENDING_SETUP",
  credentialStatus: null,
  lastSyncAt: null,
  nextSyncAt: null,
  activeJob: null,
};
const snapshot: TaxSnapshot = {
  tenantId: "tenant-a",
  period: parseTaxPeriod({ year: 2025, month: 9 }),
  profile: null,
  documents: [],
  inbox: [],
  undatedCount: 0,
};
const services = {
  getCurrentUser: async () => user,
  getCurrentTenant: async (current: AppsoluxUser) => {
    assert.equal(current.id, "user-a");
    return tenant;
  },
  loadTaxSnapshot: async (tenantId: string) => {
    assert.equal(tenantId, "tenant-a");
    return snapshot;
  },
  getReceivedSyncState: async (tenantId: string) => {
    assert.equal(tenantId, "tenant-a");
    return noSync;
  },
};

test("all Tax Center endpoints return 401 without reading tenant data when there is no session", async () => {
  for (const endpoint of [
    "summary",
    "received",
    "received-action",
    "ats-preview",
    "ats-xml",
    "ats-summary",
    "iva-104",
    "validations",
  ] as TaxEndpoint[]) {
    const response = await handleTaxRequest(
      new NextRequest("http://localhost/api/sri-tax/test"),
      endpoint,
      {
        getCurrentUser: async () => null,
        loadTaxSnapshot: async () => {
          throw new Error("Must not read database");
        },
      },
    );
    assert.equal(response.status, 401, endpoint);
    assert.match(response.headers.get("cache-control") ?? "", /no-store/);
  }
});
test("summary, ATS and validations ignore malicious tenant query parameters", async () => {
  for (const endpoint of [
    "summary",
    "ats-preview",
    "ats-summary",
    "validations",
  ] as TaxEndpoint[]) {
    const response = await handleTaxRequest(
      new NextRequest(
        "http://localhost/api/sri-tax/test?year=2025&month=9&tenantId=tenant-b",
      ),
      endpoint,
      services,
    );
    assert.equal(response.status, 200, endpoint);
    assert.match(
      response.headers.get("cache-control") ?? "",
      /private, no-store/,
    );
  }
});
test("IVA POST ignores tenantId from the frontend and preserves unknown prior balances", async () => {
  const request = new NextRequest("http://localhost/api/sri-tax/iva-104", {
    method: "POST",
    body: JSON.stringify({ tenantId: "tenant-b", year: 2025, month: 9 }),
  });
  const response = await handleTaxRequest(request, "iva-104", services);
  assert.equal(response.status, 200);
  const report = await response.json();
  assert.equal(report.tax.previousPurchasesCredit, null);
  assert.equal(report.tax.totalEstimated, null);
});
test("received reads only the session tenant even if the query contains another tenant", async () => {
  const response = await handleTaxRequest(
    new NextRequest("http://localhost/api/sri-tax/received?tenantId=tenant-b"),
    "received",
    {
      ...services,
      listReceivedDocuments: async (tenantId, filters) => {
        assert.equal(tenantId, "tenant-a");
        assert.equal(filters.page, 1);
        return {
          items: [],
          total: 0,
          page: 1,
          pageSize: 25,
          totalPages: 0,
          supportedTypes: [],
          xmlNotice: "",
        };
      },
    },
  );
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).items, []);
});
test("invalid period and malformed JSON return 400 before persistence access", async () => {
  const unread = {
    ...services,
    loadTaxSnapshot: async () => {
      throw new Error("Must not query invalid periods");
    },
  };
  const invalid = await handleTaxRequest(
    new NextRequest("http://localhost/api/sri-tax/summary?year=9999&month=13"),
    "summary",
    unread,
  );
  assert.equal(invalid.status, 400);
  const badJson = await handleTaxRequest(
    new NextRequest("http://localhost/api/sri-tax/iva-104", {
      method: "POST",
      body: "{",
    }),
    "iva-104",
    unread,
  );
  assert.equal(badJson.status, 400);
});
test("ATS export responds 422 when required fiscal information is missing", async () => {
  const response = await handleTaxRequest(
    new NextRequest("http://localhost/api/sri-tax/ats/xml?year=2025&month=9"),
    "ats-xml",
    services,
  );
  assert.equal(response.status, 422);
  assert.equal(response.headers.get("content-disposition"), null);
  const data = await response.json();
  assert.equal(data.validation.xsdStatus, "XSD_VALIDATION_PENDING");
});
test("IVA exports return genuine PDF and XLSX content with attachment headers", async () => {
  for (const format of ["pdf", "xlsx"]) {
    const response = await handleTaxRequest(
      new NextRequest("http://localhost/api/sri-tax/iva-104", {
        method: "POST",
        body: JSON.stringify({
          year: 2025,
          month: 9,
          format,
          manualInputs: { previousPurchasesCredit: "1.25" },
        }),
      }),
      "iva-104",
      services,
    );
    assert.equal(response.status, 200);
    assert.match(
      response.headers.get("content-disposition") ?? "",
      new RegExp(`Facturom\\.${format}`),
    );
    const bytes = Buffer.from(await response.arrayBuffer());
    assert.equal(
      bytes.subarray(0, format === "pdf" ? 4 : 2).toString(),
      format === "pdf" ? "%PDF" : "PK",
    );
  }
});
