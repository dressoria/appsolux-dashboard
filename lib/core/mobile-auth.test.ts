import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import test, { mock } from "node:test";
import type { MembershipRole } from "@prisma/client";
import type { NextRequest } from "next/server";

// Load production authentication modules and HTTP handlers. Only external
// dependencies (Clerk, request headers, Prisma and policy services) are mocked.
// The Prisma fixture applies query predicates; authorization stays in real code.
type Membership = {
  userId: string; tenantId: string; status: "active" | "inactive";
  role: MembershipRole;
  tenant: { id: string; name: string; slug: string; status: string };
};
type UserRecord = {
  id: string; clerkUserId: string; name: string; email: string;
  status: "active" | "disabled"; memberships: Membership[];
};
type PlanState = {
  planKey: string; planName: string; status: string;
  features: Record<string, boolean>; currentPeriodEndsAt: Date | null;
};
type UserQuery = {
  where: { clerkUserId?: string; id?: string; email?: string };
  include?: { memberships: { where: { status: string; tenantId?: string }; take?: number } };
};

const USERS: UserRecord[] = [
  {
    id: "u1",
    clerkUserId: "clerk_active_owner",
    name: "Active Owner",
    email: "owner@example.com",
    status: "active",
    memberships: [
      {
        userId: "u1",
        tenantId: "t1",
        status: "active",
        role: "owner",
        tenant: { id: "t1", name: "Empresa A", slug: "empresa-a", status: "active" },
      },
      {
        userId: "u1",
        tenantId: "t2",
        status: "active",
        role: "seller",
        tenant: { id: "t2", name: "Empresa B", slug: "empresa-b", status: "active" },
      },
    ],
  },
  {
    id: "u2",
    clerkUserId: "clerk_disabled",
    name: "Disabled User",
    email: "disabled@example.com",
    status: "disabled",
    memberships: [
      {
        userId: "u2",
        tenantId: "t1",
        status: "active",
        role: "viewer",
        tenant: { id: "t1", name: "Empresa A", slug: "empresa-a", status: "active" },
      },
    ],
  },
  {
    id: "u3",
    clerkUserId: "clerk_no_company",
    name: "No Company",
    email: "nocompany@example.com",
    status: "active",
    memberships: [],
  },
  {
    id: "u4",
    clerkUserId: "clerk_single",
    name: "Single Tenant",
    email: "single@example.com",
    status: "active",
    memberships: [
      {
        userId: "u4",
        tenantId: "t1",
        status: "active",
        role: "admin",
        tenant: { id: "t1", name: "Empresa A", slug: "empresa-a", status: "active" },
      },
    ],
  },
  {
    id: "u5",
    clerkUserId: "clerk_inactive_membership",
    name: "Inactive Membership",
    email: "inactive@example.com",
    status: "active",
    memberships: [
      {
        userId: "u5",
        tenantId: "t1",
        status: "inactive",
        role: "seller",
        tenant: { id: "t1", name: "Empresa A", slug: "empresa-a", status: "active" },
      },
    ],
  },
  {
    id: "u6",
    clerkUserId: "clerk_suspended_tenant",
    name: "Suspended Tenant User",
    email: "suspended@example.com",
    status: "active",
    memberships: [
      {
        userId: "u6",
        tenantId: "t3",
        status: "active",
        role: "owner",
        tenant: { id: "t3", name: "Suspended Corp", slug: "suspended-corp", status: "suspended" },
      },
      {
        userId: "u6",
        tenantId: "t1",
        status: "active",
        role: "viewer",
        tenant: { id: "t1", name: "Empresa A", slug: "empresa-a", status: "active" },
      },
    ],
  },
  {
    id: "u7",
    clerkUserId: "clerk_multi_mixed",
    name: "Mixed Memberships",
    email: "mixed@example.com",
    status: "active",
    memberships: [
      {
        userId: "u7",
        tenantId: "t1",
        status: "active",
        role: "owner",
        tenant: { id: "t1", name: "Empresa A", slug: "empresa-a", status: "active" },
      },
      {
        userId: "u7",
        tenantId: "t4",
        status: "inactive",
        role: "admin",
        tenant: { id: "t4", name: "Old Corp", slug: "old-corp", status: "active" },
      },
      {
        userId: "u7",
        tenantId: "t5",
        status: "active",
        role: "seller",
        tenant: { id: "t5", name: "Provisioning Corp", slug: "prov-corp", status: "provisioning" },
      },
    ],
  },
];

const ACTIVE_PLAN: PlanState = {
  planKey: "pro", planName: "Negocio", status: "active",
  features: { basic_pos: true, basic_sales: true, sri: true, advanced_reports: true },
  currentPeriodEndsAt: new Date("2027-01-01"),
};
const FREE_PLAN: PlanState = {
  ...ACTIVE_PLAN, planKey: "free", planName: "Gratis",
  features: { basic_pos: true, basic_sales: true, sri: false, advanced_reports: false },
  currentPeriodEndsAt: null,
};

let users: UserRecord[];
let clerkUserId: string | null;
let requestHeaders: Headers;
let userQueries: UserQuery[];
let writes: number;
let clerkLookups: number;
let planState: PlanState;
let operationalAccess: { canOperate: boolean; canRead: boolean; trialDaysRemaining: number | null };
let effectiveFeatures: Record<string, boolean>;
let failOperational: boolean;
let failEffective: boolean;
let policyTenantIds: string[];
let clerkProfile: {
  id: string; firstName: string; lastName: string; primaryEmailAddressId: string;
  emailAddresses: { id: string; emailAddress: string; verification: { status: string } }[];
} | null;

const db = {
  user: {
    findUnique: async (query: UserQuery) => {
      userQueries.push(query);
      const user = users.find((candidate) => Object.entries(query.where).every(
        ([key, value]) => candidate[key as keyof UserRecord] === value,
      ));
      if (!user) return null;
      if (!query.include) return user;
      const { where, take } = query.include.memberships;
      const memberships = user.memberships.filter((m) =>
        Object.entries(where).every(([key, value]) => m[key as keyof Membership] === value),
      );
      return {
        ...user,
        memberships: memberships.slice(0, take).map((m) => ({
          ...m, tenant: { ...m.tenant, integrations: [], planKey: "pro" },
        })),
      };
    },
    create: async ({ data }: { data: Omit<UserRecord, "id" | "memberships"> }) => {
      writes++;
      const user: UserRecord = { ...data, id: "created-user", memberships: [] };
      users.push(user);
      return user;
    },
  },
  membership: {
    findFirst: async ({ where }: { where: { userId: string; tenantId: string; status: string } }) =>
      users.flatMap((u) => u.memberships).find((m) =>
        Object.entries(where).every(([key, value]) => m[key as keyof Membership] === value),
      ) ?? null,
  },
};

let appUser: typeof import("../auth/require-app-user");
let mobileUser: typeof import("../auth/mobile-user");
let me: typeof import("../../app/api/mobile/me/route");
let selectTenant: typeof import("../../app/api/mobile/select-tenant/route");

test.before(async () => {
  // tsx loads this project's TS files as CommonJS; mock Clerk's matching export.
  const require = createRequire(import.meta.url);
  mock.module(resolve("lib/security/server-only.ts"), { namedExports: {} });
  mock.module(require.resolve("@clerk/nextjs/server"), { namedExports: {
    auth: async () => ({ userId: clerkUserId }),
    currentUser: async () => { clerkLookups++; return clerkProfile; },
    clerkClient: async () => ({ users: { getUser: async () => { clerkLookups++; return clerkProfile; } } }),
  } });
  mock.module("next/headers", { namedExports: { headers: async () => requestHeaders } });
  mock.module("next/navigation", { namedExports: {
    redirect: (path: string) => { throw new Error(`redirect:${path}`); },
  } });
  mock.module(resolve("lib/db/prisma.ts"), { namedExports: { getPrismaClient: () => db } });
  mock.module(resolve("lib/core/plans.ts"), { namedExports: {
    getTenantPlanState: async (tenantId: string) => { policyTenantIds.push(tenantId); return planState; },
  } });
  mock.module(resolve("lib/core/tenant-operational-access.ts"), { namedExports: {
    getTenantOperationalAccess: async (tenantId: string) => {
      policyTenantIds.push(tenantId);
      if (failOperational) throw new Error("operational service unavailable");
      return operationalAccess;
    },
  } });
  mock.module(resolve("lib/core/tenant-features.ts"), { namedExports: {
    resolveEffectiveTenantAccessForTenant: async ({ tenantId }: { tenantId: string }) => {
      policyTenantIds.push(tenantId);
      if (failEffective) throw new Error("effective permissions unavailable");
      return { features: effectiveFeatures };
    },
  } });
  appUser = await import("../auth/require-app-user");
  mobileUser = await import("../auth/mobile-user");
  me = await import("../../app/api/mobile/me/route");
  selectTenant = await import("../../app/api/mobile/select-tenant/route");
});

test.beforeEach(() => {
  users = structuredClone(USERS);
  clerkUserId = "clerk_active_owner";
  requestHeaders = new Headers({ authorization: "Bearer test-token" });
  userQueries = []; writes = 0; clerkLookups = 0; policyTenantIds = [];
  planState = structuredClone(ACTIVE_PLAN);
  operationalAccess = { canOperate: true, canRead: true, trialDaysRemaining: null };
  effectiveFeatures = {
    pos_basic: true, sales_basic: true, customers_basic: true, inventory_basic: true,
    sri_invoicing: true, sri_configuration: true, advanced_reports: false, dedicated_erp: false,
  };
  failOperational = false; failEffective = false;
  clerkProfile = null;
});

const context = async (tenantId = "t1", userId = "clerk_active_owner") => {
  const result = await mobileUser.resolveMobileTenantContext(userId, tenantId);
  if (!result.ok) throw new Error(result.message);
  return result.context;
};
const assertDenied = (result: Awaited<ReturnType<typeof context>>) => {
  assert.equal(result.subscription.canOperate, false);
  assert.equal(result.subscription.status, "error");
  assert.ok(Object.values(result.access).every((value) => value === false), "no unverified capability is granted");
};
const tenantRequest = (tenantId: string) => new Request("http://localhost/api/mobile/select-tenant", {
  method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tenantId }),
}) as NextRequest;

test("getAppUser rejects an unauthenticated request before querying Prisma", async () => {
  clerkUserId = null;
  requestHeaders.set("x-tenant-id", "t1");
  assert.equal(await appUser.getAppUser(), null);
  assert.equal(userQueries.length, 0);
});

for (const userId of ["clerk_no_company", "clerk_single", "clerk_active_owner"]) {
  for (const tenantId of [null, "", "   "]) {
    test(`Bearer user ${userId} with tenant ${JSON.stringify(tenantId)} is denied without fallback`, async () => {
      clerkUserId = userId;
      if (tenantId !== null) requestHeaders.set("x-tenant-id", tenantId);
      assert.equal(await appUser.getAppUser(), null);
      assert.equal(userQueries.length, 0, "no first-membership lookup");
      assert.equal(clerkLookups, 0, "no provisioning fallback");
      assert.equal(writes, 0);
    });
  }
}

for (const authorization of ["bearer test-token", "BEARER test-token", "Bearer"]) {
  test(`Bearer scheme ${authorization} cannot bypass the tenant requirement`, async () => {
    requestHeaders.set("authorization", authorization);
    assert.equal(await appUser.getAppUser(), null);
    assert.equal(userQueries.length, 0);
  });
}

for (const tenantId of ["t1", "t2"]) {
  test(`getAppUser selects only the explicitly requested tenant ${tenantId}`, async () => {
    requestHeaders.set("x-tenant-id", tenantId);
    const user = await appUser.getAppUser();
    assert.equal(user?.tenant?.id, tenantId);
    assert.deepEqual(userQueries[0].include?.memberships.where, { status: "active", tenantId });
    assert.equal(userQueries[0].include?.memberships.take, 1);
    assert.equal(clerkLookups, 0);
  });
}

test("getAppUser trims the explicit tenant before membership validation", async () => {
  requestHeaders.set("x-tenant-id", "  t2  ");
  assert.equal((await appUser.getAppUser())?.tenant?.id, "t2");
});

for (const [userId, tenantId] of [
  ["clerk_active_owner", "t999"], ["clerk_single", "t2"],
  ["clerk_inactive_membership", "t1"], ["clerk_disabled", "t1"],
  ["clerk_no_company", "t1"], ["clerk_nonexistent", "t1"],
]) {
  test(`getAppUser denies ${userId}/${tenantId} without trying another tenant or provisioning`, async () => {
    clerkUserId = userId;
    requestHeaders.set("x-tenant-id", tenantId);
    assert.equal(await appUser.getAppUser(), null);
    assert.equal(userQueries.length, 1);
    assert.equal(clerkLookups, 0);
    assert.equal(writes, 0);
  });
}

test("a revoked membership cannot be reused by a later Bearer request", async () => {
  requestHeaders.set("x-tenant-id", "t2");
  assert.equal((await appUser.getAppUser())?.tenant?.id, "t2");
  users[0].memberships[1].status = "inactive";
  assert.equal(await appUser.getAppUser(), null);
});

for (const authorization of [null, "Cookie session=test"]) {
  test(`web request with authorization=${authorization} ignores a supplied tenant header`, async () => {
    if (authorization === null) requestHeaders.delete("authorization");
    else requestHeaders.set("authorization", authorization);
    requestHeaders.set("x-tenant-id", "t999");
    assert.equal((await appUser.getAppUser())?.tenant?.id, "t1");
    assert.deepEqual(userQueries[0].include?.memberships.where, { status: "active" });
  });
}

test("web user without membership keeps the onboarding profile", async () => {
  clerkUserId = "clerk_no_company";
  requestHeaders.delete("authorization");
  const user = await appUser.getAppUser();
  assert.equal(user?.id, "u3");
  assert.equal(user?.tenant, null);
});

test("web first-login provisioning remains available", async () => {
  clerkUserId = "clerk_new_user";
  requestHeaders.delete("authorization");
  clerkProfile = {
    id: clerkUserId, firstName: "New", lastName: "User", primaryEmailAddressId: "email-new",
    emailAddresses: [{ id: "email-new", emailAddress: "new@example.com", verification: { status: "verified" } }],
  };
  const user = await appUser.getAppUser();
  assert.equal(user?.id, "created-user");
  assert.equal(user?.tenant, null);
  assert.equal(writes, 1);
});

test("requireAppUser does not return an enterprise user for an unscoped Bearer request", async () => {
  await assert.rejects(appUser.requireAppUser(), /redirect:\/sign-in/);
});

for (const [userId, tenantIds] of [
  ["clerk_no_company", []], ["clerk_single", ["t1"]],
  ["clerk_active_owner", ["t1", "t2"]], ["clerk_multi_mixed", ["t1", "t5"]],
  ["clerk_suspended_tenant", ["t1"]],
] as const) {
  test(`GET /api/mobile/me lists ${userId}'s tenants without X-Tenant-Id`, async () => {
    clerkUserId = userId;
    const response = await me.GET();
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.ok, true);
    assert.deepEqual(body.tenants.map((tenant: { id: string }) => tenant.id), tenantIds);
    assert.equal(writes, 0);
    assert.equal(policyTenantIds.length, 0);
  });
}

for (const [userId, status] of [[null, 401], ["clerk_disabled", 403]] as const) {
  test(`GET /api/mobile/me rejects user ${userId} with HTTP ${status}`, async () => {
    clerkUserId = userId;
    assert.equal((await me.GET()).status, status);
  });
}

test("a valid mobile context uses only the selected membership and tenant policy", async () => {
  const result = await context("t2");
  assert.equal(result.tenant.id, "t2");
  assert.equal(result.user.role, "seller");
  assert.equal(result.subscription.canOperate, true);
  assert.equal(result.subscription.status, "active");
  assert.equal(result.access.pos_basic, true);
  assert.equal(result.access.advanced_reports, false, "effective denial overrides an enabled base plan");
  assert.deepEqual(result.access, effectiveFeatures, "successful responses preserve the effective permission map");
  assert.deepEqual(policyTenantIds, ["t2", "t2", "t2"]);
});

for (const [userId, tenantId, code] of [
  ["clerk_disabled", "t1", "USER_DISABLED"],
  ["clerk_nonexistent", "t1", "USER_DISABLED"],
  ["clerk_single", "t2", "NO_MEMBERSHIP"],
  ["clerk_inactive_membership", "t1", "NO_MEMBERSHIP"],
  ["clerk_active_owner", "nonexistent", "NO_MEMBERSHIP"],
  ["clerk_suspended_tenant", "t3", "TENANT_SUSPENDED"],
]) {
  test(`resolveMobileTenantContext rejects ${userId}/${tenantId} before querying policy`, async () => {
    const result = await mobileUser.resolveMobileTenantContext(userId, tenantId);
    assert.equal(result.ok, false);
    if (result.ok) throw new Error("Expected denied context");
    assert.equal(result.code, code);
    assert.equal(result.status, 403);
    assert.equal(policyTenantIds.length, 0);
  });
}

test("a free plan does not override explicitly resolved capabilities", async () => {
  planState = structuredClone(FREE_PLAN);
  effectiveFeatures.sri_invoicing = false;
  effectiveFeatures.sri_configuration = false;
  const result = await context();
  assert.equal(result.access.pos_basic, true);
  assert.equal(result.access.sri_invoicing, false);
  assert.equal(result.access.dedicated_erp, false);
});

for (const status of ["suspended", "trialing"]) {
  test(`${status} subscription preserves only verified existing read capabilities`, async () => {
    planState.status = status;
    operationalAccess.canOperate = false;
    const result = await context();
    assert.equal(result.subscription.canOperate, false);
    assert.equal(result.subscription.status, status);
    assert.equal(result.access.pos_basic, false);
    assert.equal(result.access.sales_basic, false);
    assert.equal(result.access.sri_invoicing, true);
    assert.equal(result.access.sri_configuration, true);
  });
}

test("an explicitly denied read capability is never restored by the plan", async () => {
  operationalAccess.canOperate = false;
  effectiveFeatures.sri_configuration = false;
  const result = await context();
  assert.equal(result.access.sri_invoicing, true);
  assert.equal(result.access.sri_configuration, false);
});

test("without verified operational read access all capabilities are denied", async () => {
  operationalAccess = { canOperate: false, canRead: false, trialDaysRemaining: null };
  const result = await context();
  assert.equal(result.subscription.canOperate, false);
  assert.ok(Object.values(result.access).every((value) => value === false));
});

for (const failure of ["operational", "effective", "both"] as const) {
  test(`${failure} service failure denies operations and every unverified capability`, async (t) => {
    t.mock.method(console, "error", () => undefined);
    failOperational = failure !== "effective";
    failEffective = failure !== "operational";
    assertDenied(await context());
  });
}

test("POST /api/mobile/select-tenant returns a fail-closed context when permissions fail", async (t) => {
  t.mock.method(console, "error", () => undefined);
  failEffective = true;
  const response = await selectTenant.POST(tenantRequest("t2"));
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.ok, true, "membership is valid; operational access remains explicitly denied");
  assert.equal(body.tenant.id, "t2");
  assert.equal(body.subscription.canOperate, false);
  assert.equal(body.subscription.status, "error");
  assert.ok(Object.values(body.access).every((value) => value === false));
});

test("POST /api/mobile/select-tenant rejects another company's ID", async () => {
  clerkUserId = "clerk_single";
  const response = await selectTenant.POST(tenantRequest("t2"));
  assert.equal(response.status, 403);
  assert.equal((await response.json()).error.code, "NO_MEMBERSHIP");
});
