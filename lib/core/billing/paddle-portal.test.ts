import test from "node:test";
import assert from "node:assert/strict";

import {
  createPaddlePortalWith,
  type PaddlePortalDeps,
} from "./paddle-billing.ts";

function mockDeps(overrides?: Partial<PaddlePortalDeps>): PaddlePortalDeps {
  return {
    findSubscription: async () => ({
      providerCustomerId: "ctm_test_123",
      providerSubscriptionId: "sub_test_456",
    }),
    createPortalSession: async () => ({
      urls: { general: { overview: "https://customer-portal.paddle.com/test" } },
    }),
    ...overrides,
  };
}

// 1. createPaddlePortal usa customerPortalSessions.create
test("portal: usa createPortalSession (customerPortalSessions.create)", async () => {
  let called = false;
  const deps = mockDeps({
    createPortalSession: async (customerId, subscriptionIds) => {
      called = true;
      assert.equal(typeof customerId, "string");
      assert.ok(Array.isArray(subscriptionIds));
      return { urls: { general: { overview: "https://portal.test" } } };
    },
  });
  await createPaddlePortalWith(deps, { tenantId: "t1" });
  assert.ok(called, "createPortalSession debe ser invocado");
});

// 2. utiliza providerCustomerId local
test("portal: utiliza providerCustomerId del registro local", async () => {
  let capturedCustomerId: string | undefined;
  const deps = mockDeps({
    findSubscription: async () => ({
      providerCustomerId: "ctm_from_db_record",
      providerSubscriptionId: "sub_from_db",
    }),
    createPortalSession: async (customerId) => {
      capturedCustomerId = customerId;
      return { urls: { general: { overview: "https://portal.test" } } };
    },
  });
  await createPaddlePortalWith(deps, { tenantId: "t1" });
  assert.equal(capturedCustomerId, "ctm_from_db_record");
});

// 3. pasa providerSubscriptionId si existe
test("portal: pasa providerSubscriptionId cuando existe", async () => {
  let capturedSubIds: string[] | undefined;
  const deps = mockDeps({
    findSubscription: async () => ({
      providerCustomerId: "ctm_test",
      providerSubscriptionId: "sub_specific_789",
    }),
    createPortalSession: async (_customerId, subscriptionIds) => {
      capturedSubIds = subscriptionIds;
      return { urls: { general: { overview: "https://portal.test" } } };
    },
  });
  await createPaddlePortalWith(deps, { tenantId: "t1" });
  assert.deepEqual(capturedSubIds, ["sub_specific_789"]);
});

// 4. no acepta IDs desde frontend
test("portal: no acepta IDs desde frontend (solo tenantId)", async () => {
  let capturedCustomerId: string | undefined;
  let capturedSubIds: string[] | undefined;
  const deps = mockDeps({
    findSubscription: async () => ({
      providerCustomerId: "ctm_real_from_db",
      providerSubscriptionId: "sub_real_from_db",
    }),
    createPortalSession: async (customerId, subscriptionIds) => {
      capturedCustomerId = customerId;
      capturedSubIds = subscriptionIds;
      return { urls: { general: { overview: "https://portal.test" } } };
    },
  });
  await createPaddlePortalWith(deps, {
    tenantId: "t1",
    customerId: "ctm_evil_frontend",
    subscriptionId: "sub_evil_frontend",
  } as { tenantId: string });
  assert.equal(capturedCustomerId, "ctm_real_from_db");
  assert.deepEqual(capturedSubIds, ["sub_real_from_db"]);
});

// 5. devuelve session.urls.general.overview
test("portal: devuelve session.urls.general.overview", async () => {
  const expectedUrl = "https://customer-portal.paddle.com/session/temp_abc123";
  const deps = mockDeps({
    createPortalSession: async () => ({
      urls: { general: { overview: expectedUrl } },
    }),
  });
  const result = await createPaddlePortalWith(deps, { tenantId: "t1" });
  assert.equal(result.url, expectedUrl);
});

// 6. no persiste la URL del portal
test("portal: no persiste la URL (solo lectura de DB)", async () => {
  let findCallCount = 0;
  const deps = mockDeps({
    findSubscription: async () => {
      findCallCount++;
      return { providerCustomerId: "ctm_test", providerSubscriptionId: null };
    },
  });
  const result = await createPaddlePortalWith(deps, { tenantId: "t1" });
  assert.equal(findCallCount, 1);
  assert.ok(result.url);
});

// 7. customer ausente => error controlado
test("portal: customer ausente => error controlado", async () => {
  const deps = mockDeps({ findSubscription: async () => null });
  await assert.rejects(
    () => createPaddlePortalWith(deps, { tenantId: "t_no_sub" }),
    (err: Error) => {
      assert.ok(err.message.includes("suscripción"));
      return true;
    },
  );
});
