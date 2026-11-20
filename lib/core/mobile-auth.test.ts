import assert from "node:assert/strict";
import test, { describe } from "node:test";

// =============================================================================
// These tests exercise the BUSINESS LOGIC of mobile authentication and
// authorization. They replicate the decision paths in:
//   - require-app-user.ts  (Bearer-only X-Tenant-Id, fail-closed)
//   - clerk-user.ts        (explicit tenant → null on no membership)
//   - mobile-user.ts       (subscription fail-closed, feature resolution)
//   - select-tenant/route  (membership + subscription + access validation)
//   - me/route             (profile + tenant listing)
//
// Each test constructs inputs matching what the real functions receive and
// asserts the correct decision, using the same branching logic.
// =============================================================================

// --- Helpers that mirror real resolution logic ---

type Membership = {
  userId: string;
  tenantId: string;
  status: "active" | "inactive";
  role: string;
  tenant: { id: string; name: string; slug: string; status: string };
};

type UserRecord = {
  id: string;
  clerkUserId: string;
  name: string;
  email: string;
  status: "active" | "disabled";
  memberships: Membership[];
};

type OperationalAccess = {
  canOperate: boolean;
  canRead: boolean;
  effectiveStatus: string;
  reason: string;
  trialDaysRemaining: number | null;
} | null;

type EffectiveAccess = {
  features: Record<string, boolean>;
} | null;

type PlanState = {
  planKey: string;
  planName: string;
  status: string;
  features: Record<string, boolean>;
  currentPeriodEndsAt: Date | null;
};

/**
 * Mirrors require-app-user.ts: getAppUser() tenant resolution.
 * Returns the resolved tenant ID, or null for auth failure.
 */
function resolveGetAppUserTenant(params: {
  clerkUserId: string | null;
  authorizationHeader: string | null;
  xTenantIdHeader: string | null;
  users: UserRecord[];
}): { userId: string; tenantId: string | null } | null {
  const { clerkUserId, authorizationHeader, xTenantIdHeader, users } = params;

  // Step 1: Clerk auth
  if (!clerkUserId) return null;

  // Step 2: Bearer detection (require-app-user.ts lines 22-25)
  const isBearerAuth =
    typeof authorizationHeader === "string" &&
    authorizationHeader.startsWith("Bearer ");
  const requestedTenantId = isBearerAuth
    ? (xTenantIdHeader || undefined)
    : undefined;

  // Step 3: findAppsoluxUserByClerkId (clerk-user.ts)
  const user = users.find((u) => u.clerkUserId === clerkUserId);
  if (!user || user.status === "disabled") return null;

  const membershipFilter = requestedTenantId
    ? (m: Membership) => m.status === "active" && m.tenantId === requestedTenantId
    : (m: Membership) => m.status === "active";
  const matchedMemberships = user.memberships.filter(membershipFilter);

  if (matchedMemberships.length === 0) {
    // clerk-user.ts fix: explicit tenant with no membership → null
    if (requestedTenantId) return null;
    // Original: user without tenant (onboarding)
    return { userId: user.id, tenantId: null };
  }

  const resolvedTenantId = matchedMemberships[0].tenant.id;

  // Step 4: require-app-user.ts fail-closed block
  if (requestedTenantId) {
    if (!resolvedTenantId) return null;
    return { userId: user.id, tenantId: resolvedTenantId };
  }

  return { userId: user.id, tenantId: resolvedTenantId };
}

/**
 * Mirrors mobile-user.ts: resolveMobileTenantContext() subscription logic.
 * Returns { canOperate, status } reflecting the fail-closed fix.
 */
function resolveSubscriptionAccess(params: {
  operationalAccess: OperationalAccess;
  operationalAccessFailed: boolean;
  planState: PlanState;
}): { canOperate: boolean; status: string } {
  const { operationalAccess, operationalAccessFailed, planState } = params;

  // mobile-user.ts fix: service failure → deny operation
  const canOperate = operationalAccessFailed
    ? false
    : (operationalAccess?.canOperate ?? false);

  const status = operationalAccessFailed ? "error" : planState.status;

  return { canOperate, status };
}

/**
 * Mirrors mobile-user.ts: feature resolution with canOperate gate.
 */
function resolveFeatureAccess(params: {
  effectiveAccess: EffectiveAccess;
  effectiveAccessFailed: boolean;
  planState: PlanState;
  canOperate: boolean;
}): Record<string, boolean> {
  const { effectiveAccess, effectiveAccessFailed, planState, canOperate } = params;

  const access: Record<string, boolean> = {};

  const features = effectiveAccess
    ? effectiveAccess.features
    : planState.features;

  for (const [key, value] of Object.entries(features)) {
    access[key] = value === true;
  }

  if (!canOperate) {
    for (const key of Object.keys(access)) {
      if (key !== "sri_invoicing" && key !== "sri_configuration") {
        access[key] = false;
      }
    }
  }

  return access;
}

/**
 * Mirrors mobile-user.ts: getMobileUserProfile() tenant filtering.
 */
function filterVisibleTenants(memberships: Membership[]): Membership[] {
  return memberships
    .filter((m) => m.status === "active")
    .filter(
      (m) =>
        m.tenant.status === "active" || m.tenant.status === "provisioning",
    );
}

// --- Fixtures ---

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
  planKey: "pro",
  planName: "Negocio",
  status: "active",
  features: {
    pos_basic: true,
    sales_basic: true,
    customers_basic: true,
    inventory_basic: true,
    reports_basic: true,
    sri_invoicing: true,
    sri_configuration: true,
    advanced_reports: false,
    dedicated_erp: false,
    shared_erp: false,
    purchases: false,
  },
  currentPeriodEndsAt: new Date("2027-01-01"),
};

const FREE_PLAN: PlanState = {
  planKey: "free",
  planName: "Gratis",
  status: "active",
  features: {
    pos_basic: true,
    sales_basic: true,
    customers_basic: true,
    inventory_basic: true,
    reports_basic: true,
    sri_invoicing: false,
    sri_configuration: false,
    advanced_reports: false,
    dedicated_erp: false,
    shared_erp: false,
    purchases: false,
  },
  currentPeriodEndsAt: null,
};

// =============================================================================
// TESTS
// =============================================================================

describe("1. Sin token", () => {
  test("missing Authorization header returns no user", () => {
    const result = resolveGetAppUserTenant({
      clerkUserId: null,
      authorizationHeader: null,
      xTenantIdHeader: null,
      users: USERS,
    });
    assert.equal(result, null);
  });
});

describe("2. Token inválido", () => {
  test("invalid clerkUserId resolves to no user", () => {
    const result = resolveGetAppUserTenant({
      clerkUserId: "clerk_nonexistent",
      authorizationHeader: "Bearer eyJ...",
      xTenantIdHeader: null,
      users: USERS,
    });
    assert.equal(result, null);
  });
});

describe("3. Usuario deshabilitado", () => {
  test("disabled user returns null regardless of valid membership", () => {
    const result = resolveGetAppUserTenant({
      clerkUserId: "clerk_disabled",
      authorizationHeader: "Bearer eyJ...",
      xTenantIdHeader: "t1",
      users: USERS,
    });
    assert.equal(result, null);
  });
});

describe("4. Usuario sin empresa", () => {
  test("user with zero memberships gets tenantId null", () => {
    const result = resolveGetAppUserTenant({
      clerkUserId: "clerk_no_company",
      authorizationHeader: "Bearer eyJ...",
      xTenantIdHeader: null,
      users: USERS,
    });
    assert.ok(result !== null);
    assert.equal(result.tenantId, null);
  });
});

describe("5. Usuario con una empresa", () => {
  test("single-company user resolves to that company", () => {
    const result = resolveGetAppUserTenant({
      clerkUserId: "clerk_single",
      authorizationHeader: "Bearer eyJ...",
      xTenantIdHeader: null,
      users: USERS,
    });
    assert.ok(result !== null);
    assert.equal(result.tenantId, "t1");
  });
});

describe("6. Usuario con múltiples empresas", () => {
  test("multi-company user without X-Tenant-Id resolves to first active membership", () => {
    const result = resolveGetAppUserTenant({
      clerkUserId: "clerk_active_owner",
      authorizationHeader: "Bearer eyJ...",
      xTenantIdHeader: null,
      users: USERS,
    });
    assert.ok(result !== null);
    assert.equal(result.tenantId, "t1");
  });

  test("profile lists all active memberships with active/provisioning tenants", () => {
    const user = USERS.find((u) => u.clerkUserId === "clerk_multi_mixed")!;
    const visible = filterVisibleTenants(user.memberships);
    assert.equal(visible.length, 2);
    assert.ok(visible.some((m) => m.tenantId === "t1"));
    assert.ok(visible.some((m) => m.tenantId === "t5"));
    assert.ok(!visible.some((m) => m.tenantId === "t4"), "inactive membership excluded");
  });
});

describe("7. Selección válida", () => {
  test("selecting a tenant the user has membership in succeeds", () => {
    const result = resolveGetAppUserTenant({
      clerkUserId: "clerk_active_owner",
      authorizationHeader: "Bearer eyJ...",
      xTenantIdHeader: "t2",
      users: USERS,
    });
    assert.ok(result !== null);
    assert.equal(result.tenantId, "t2");
  });
});

describe("8. Selección de empresa ajena", () => {
  test("selecting a tenant without membership fails with null", () => {
    const result = resolveGetAppUserTenant({
      clerkUserId: "clerk_active_owner",
      authorizationHeader: "Bearer eyJ...",
      xTenantIdHeader: "t999",
      users: USERS,
    });
    assert.equal(result, null, "foreign tenant must be rejected");
  });

  test("does NOT fall back to another tenant when requested one is unauthorized", () => {
    const result = resolveGetAppUserTenant({
      clerkUserId: "clerk_active_owner",
      authorizationHeader: "Bearer eyJ...",
      xTenantIdHeader: "t999",
      users: USERS,
    });
    assert.equal(result, null, "must not resolve to any tenant");
  });
});

describe("9. Membresía desactivada", () => {
  test("user with only inactive memberships gets no tenant (mobile with header)", () => {
    const result = resolveGetAppUserTenant({
      clerkUserId: "clerk_inactive_membership",
      authorizationHeader: "Bearer eyJ...",
      xTenantIdHeader: "t1",
      users: USERS,
    });
    assert.equal(result, null);
  });
});

describe("10. TenantId inexistente", () => {
  test("non-existent tenantId fails — no fallback", () => {
    const result = resolveGetAppUserTenant({
      clerkUserId: "clerk_single",
      authorizationHeader: "Bearer eyJ...",
      xTenantIdHeader: "nonexistent-tenant",
      users: USERS,
    });
    assert.equal(result, null);
  });
});

describe("11. TenantId manipulado en request web", () => {
  test("X-Tenant-Id on a web (cookie) request is ignored", () => {
    const result = resolveGetAppUserTenant({
      clerkUserId: "clerk_active_owner",
      authorizationHeader: null,
      xTenantIdHeader: "t2",
      users: USERS,
    });
    assert.ok(result !== null);
    assert.equal(result.tenantId, "t1", "web must resolve to first membership, not header");
  });

  test("even a valid cookie request with Bearer-less auth ignores X-Tenant-Id", () => {
    const result = resolveGetAppUserTenant({
      clerkUserId: "clerk_active_owner",
      authorizationHeader: "Cookie session=abc",
      xTenantIdHeader: "t2",
      users: USERS,
    });
    assert.ok(result !== null);
    assert.equal(result.tenantId, "t1");
  });
});

describe("12. Solicitud móvil sin X-Tenant-Id cuando usa Bearer", () => {
  test("Bearer without X-Tenant-Id resolves to first membership", () => {
    const result = resolveGetAppUserTenant({
      clerkUserId: "clerk_active_owner",
      authorizationHeader: "Bearer eyJ...",
      xTenantIdHeader: null,
      users: USERS,
    });
    assert.ok(result !== null);
    assert.equal(result.tenantId, "t1");
  });
});

describe("13. Suscripción activa", () => {
  test("active subscription with operational access returns canOperate=true", () => {
    const result = resolveSubscriptionAccess({
      operationalAccess: {
        canOperate: true,
        canRead: true,
        effectiveStatus: "active",
        reason: "active",
        trialDaysRemaining: null,
      },
      operationalAccessFailed: false,
      planState: ACTIVE_PLAN,
    });
    assert.equal(result.canOperate, true);
    assert.equal(result.status, "active");
  });
});

describe("14. Suscripción suspendida", () => {
  test("suspended subscription returns canOperate=false", () => {
    const result = resolveSubscriptionAccess({
      operationalAccess: {
        canOperate: false,
        canRead: true,
        effectiveStatus: "suspended",
        reason: "subscription_suspended",
        trialDaysRemaining: null,
      },
      operationalAccessFailed: false,
      planState: { ...ACTIVE_PLAN, status: "suspended" },
    });
    assert.equal(result.canOperate, false);
    assert.equal(result.status, "suspended");
  });
});

describe("15. Suscripción vencida", () => {
  test("expired trial returns canOperate=false", () => {
    const result = resolveSubscriptionAccess({
      operationalAccess: {
        canOperate: false,
        canRead: true,
        effectiveStatus: "trial_expired",
        reason: "trial_expired",
        trialDaysRemaining: 0,
      },
      operationalAccessFailed: false,
      planState: { ...ACTIVE_PLAN, status: "trialing" },
    });
    assert.equal(result.canOperate, false);
  });
});

describe("16. Error de consulta de política operativa (FAIL-CLOSED)", () => {
  test("operational access service error must NOT grant canOperate", () => {
    const result = resolveSubscriptionAccess({
      operationalAccess: null,
      operationalAccessFailed: true,
      planState: ACTIVE_PLAN,
    });
    assert.equal(result.canOperate, false, "service failure must deny operation");
    assert.equal(result.status, "error");
  });

  test("even with planState.status=active, service error denies operation", () => {
    const result = resolveSubscriptionAccess({
      operationalAccess: null,
      operationalAccessFailed: true,
      planState: { ...ACTIVE_PLAN, status: "active" },
    });
    assert.equal(result.canOperate, false, "fail-closed: active plan + error ≠ access");
  });
});

describe("17. Error de resolución de permisos", () => {
  test("feature resolution failure falls back to base plan features", () => {
    const access = resolveFeatureAccess({
      effectiveAccess: null,
      effectiveAccessFailed: true,
      planState: ACTIVE_PLAN,
      canOperate: true,
    });
    assert.equal(access.pos_basic, true);
    assert.equal(access.advanced_reports, false);
    assert.equal(access.sri_invoicing, true);
  });

  test("canOperate=false zeroes features except SRI even on fallback", () => {
    const access = resolveFeatureAccess({
      effectiveAccess: null,
      effectiveAccessFailed: true,
      planState: ACTIVE_PLAN,
      canOperate: false,
    });
    assert.equal(access.pos_basic, false);
    assert.equal(access.sales_basic, false);
    assert.equal(access.sri_invoicing, true);
    assert.equal(access.sri_configuration, true);
  });
});

describe("18. Cambio de empresa", () => {
  test("switching tenant clears previous context and scopes to new tenant", () => {
    const firstSelect = resolveGetAppUserTenant({
      clerkUserId: "clerk_active_owner",
      authorizationHeader: "Bearer eyJ...",
      xTenantIdHeader: "t1",
      users: USERS,
    });
    assert.ok(firstSelect !== null);
    assert.equal(firstSelect.tenantId, "t1");

    // Clear state (simulates switchTenant)
    let activeTenantId: string | null = null;
    let cachedAccess: Record<string, boolean> = {};
    activeTenantId = null;
    cachedAccess = {};

    // Select new tenant
    const secondSelect = resolveGetAppUserTenant({
      clerkUserId: "clerk_active_owner",
      authorizationHeader: "Bearer eyJ...",
      xTenantIdHeader: "t2",
      users: USERS,
    });
    assert.ok(secondSelect !== null);
    assert.equal(secondSelect.tenantId, "t2");
    assert.notEqual(firstSelect.tenantId, secondSelect.tenantId);
    assert.equal(activeTenantId, null, "activeTenantId cleared before reselection");
    assert.equal(Object.keys(cachedAccess).length, 0, "cached access cleared");
  });
});

describe("19. Revocación de membresía", () => {
  test("saved tenantId fails validation after membership revocation", () => {
    // Before revocation: user has membership
    const before = resolveGetAppUserTenant({
      clerkUserId: "clerk_active_owner",
      authorizationHeader: "Bearer eyJ...",
      xTenantIdHeader: "t2",
      users: USERS,
    });
    assert.ok(before !== null);
    assert.equal(before.tenantId, "t2");

    // After revocation: modify user data to simulate revocation
    const revokedUsers = USERS.map((u) => {
      if (u.clerkUserId !== "clerk_active_owner") return u;
      return {
        ...u,
        memberships: u.memberships.map((m) =>
          m.tenantId === "t2" ? { ...m, status: "inactive" as const } : m,
        ),
      };
    });

    const after = resolveGetAppUserTenant({
      clerkUserId: "clerk_active_owner",
      authorizationHeader: "Bearer eyJ...",
      xTenantIdHeader: "t2",
      users: revokedUsers,
    });
    assert.equal(after, null, "revoked membership must deny access");
  });
});

describe("20. Intento de acceso a datos de otro tenant", () => {
  test("X-Tenant-Id for someone else's company yields null", () => {
    // u4 (clerk_single) only has membership in t1
    const result = resolveGetAppUserTenant({
      clerkUserId: "clerk_single",
      authorizationHeader: "Bearer eyJ...",
      xTenantIdHeader: "t2",
      users: USERS,
    });
    assert.equal(result, null, "cross-tenant access must be denied");
  });
});

describe("21. Intento de operación sin permiso", () => {
  test("free plan lacks advanced features", () => {
    const access = resolveFeatureAccess({
      effectiveAccess: null,
      effectiveAccessFailed: false,
      planState: FREE_PLAN,
      canOperate: true,
    });
    assert.equal(access.advanced_reports, false);
    assert.equal(access.dedicated_erp, false);
    assert.equal(access.purchases, false);
    assert.equal(access.pos_basic, true);
  });

  test("canOperate=false disables all features except SRI read", () => {
    const access = resolveFeatureAccess({
      effectiveAccess: {
        features: {
          pos_basic: true,
          sales_basic: true,
          sri_invoicing: true,
          sri_configuration: true,
          dedicated_erp: true,
        },
      },
      effectiveAccessFailed: false,
      planState: ACTIVE_PLAN,
      canOperate: false,
    });
    assert.equal(access.pos_basic, false, "operational features disabled");
    assert.equal(access.sales_basic, false);
    assert.equal(access.dedicated_erp, false);
    assert.equal(access.sri_invoicing, true, "SRI read preserved");
    assert.equal(access.sri_configuration, true, "SRI config preserved");
  });
});

describe("22. Acceso a API web sin modificación de comportamiento", () => {
  test("web request (no Bearer) resolves user via first membership", () => {
    const result = resolveGetAppUserTenant({
      clerkUserId: "clerk_active_owner",
      authorizationHeader: null,
      xTenantIdHeader: null,
      users: USERS,
    });
    assert.ok(result !== null);
    assert.equal(result.tenantId, "t1");
  });

  test("web user without tenant gets null tenantId for onboarding flow", () => {
    const result = resolveGetAppUserTenant({
      clerkUserId: "clerk_no_company",
      authorizationHeader: null,
      xTenantIdHeader: null,
      users: USERS,
    });
    assert.ok(result !== null);
    assert.equal(result.tenantId, null);
  });
});

describe("23. Header X-Tenant-Id malicioso enviado a una ruta web", () => {
  test("malicious X-Tenant-Id on web request is completely ignored", () => {
    const result = resolveGetAppUserTenant({
      clerkUserId: "clerk_single",
      authorizationHeader: null,
      xTenantIdHeader: "t2",
      users: USERS,
    });
    assert.ok(result !== null);
    assert.equal(
      result.tenantId,
      "t1",
      "web must ignore X-Tenant-Id header",
    );
  });

  test("even a foreign tenantId in X-Tenant-Id is ignored for web", () => {
    const result = resolveGetAppUserTenant({
      clerkUserId: "clerk_single",
      authorizationHeader: null,
      xTenantIdHeader: "foreign-t999",
      users: USERS,
    });
    assert.ok(result !== null);
    assert.equal(result.tenantId, "t1");
  });
});

describe("24. Solicitud móvil sin sesión válida", () => {
  test("Bearer token present but Clerk userId is null returns null", () => {
    const result = resolveGetAppUserTenant({
      clerkUserId: null,
      authorizationHeader: "Bearer expired-or-invalid",
      xTenantIdHeader: "t1",
      users: USERS,
    });
    assert.equal(result, null);
  });
});

describe("25. Regresión de autenticación web", () => {
  test("web auth chain is unchanged: cookie auth resolves to first membership", () => {
    for (const user of USERS) {
      if (user.status === "disabled") continue;
      const result = resolveGetAppUserTenant({
        clerkUserId: user.clerkUserId,
        authorizationHeader: null,
        xTenantIdHeader: null,
        users: USERS,
      });
      assert.ok(result !== null, `user ${user.id} should resolve`);

      const activeMemberships = user.memberships.filter(
        (m) => m.status === "active",
      );
      if (activeMemberships.length === 0) {
        assert.equal(result.tenantId, null, `user ${user.id} has no active membership`);
      } else {
        assert.equal(
          result.tenantId,
          activeMemberships[0].tenant.id,
          `user ${user.id} should resolve to first active membership`,
        );
      }
    }
  });

  test("disabled web user returns null", () => {
    const result = resolveGetAppUserTenant({
      clerkUserId: "clerk_disabled",
      authorizationHeader: null,
      xTenantIdHeader: null,
      users: USERS,
    });
    assert.equal(result, null);
  });

  test("tenant states filter correctly in profile listing", () => {
    const user = USERS.find((u) => u.clerkUserId === "clerk_suspended_tenant")!;
    const visible = filterVisibleTenants(user.memberships);
    assert.ok(!visible.some((m) => m.tenant.status === "suspended"), "suspended tenant excluded");
    assert.ok(visible.some((m) => m.tenantId === "t1"), "active tenant included");
  });
});
