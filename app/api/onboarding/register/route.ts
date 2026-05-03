import { NextResponse } from "next/server";
import {
  getCoreDbUnavailableMessage,
  isCoreDbRequired,
} from "@/lib/core/core-db-config";
import { updateOnboardingRequestStatus } from "@/lib/core/onboarding-requests";
import { setAuthSession } from "@/lib/auth/session";
import { createOnboardingRequest } from "@/lib/onboarding/create-onboarding-request";
import { provisionOnboardingRequest } from "@/lib/onboarding/provisioning";
import {
  registerAccountFromOnboardingRequest,
  RegisterAccountError,
} from "@/lib/onboarding/register-account";

type NormalizedOnboardingRequest = ReturnType<typeof createOnboardingRequest>;
type RegisteredOnboardingAccount = Awaited<
  ReturnType<typeof registerAccountFromOnboardingRequest>
> | null;

function logCoreDbWarning(message: string, error?: unknown) {
  const detail = error instanceof Error ? ` ${error.message}` : "";
  console.warn(`[CoreDB] ${message}${detail}`);
}

async function tryRegisterAccount(
  onboardingRequest: NormalizedOnboardingRequest
): Promise<RegisteredOnboardingAccount> {
  try {
    const account = await registerAccountFromOnboardingRequest(onboardingRequest);

    console.info("[CoreDB] User, Tenant, Membership and OnboardingRequest saved");

    return account;
  } catch (error) {
    if (error instanceof RegisterAccountError) {
      throw error;
    }

    if (isCoreDbRequired()) {
      console.error("[CoreDB] Required database unavailable", error);
      throw new Error(getCoreDbUnavailableMessage());
    }

    logCoreDbWarning(
      "Skipped in development because database is unavailable",
      error
    );

    return null;
  }
}

async function tryUpdateOnboardingRequest(
  account: RegisteredOnboardingAccount,
  status: "ready" | "failed",
  lastError?: string
) {
  if (!account) {
    return;
  }

  try {
    await updateOnboardingRequestStatus(account.onboardingRequestId, status, {
      lastError,
    });
  } catch (error) {
    if (isCoreDbRequired()) {
      console.error("[CoreDB] Required database unavailable", error);
      throw new Error(getCoreDbUnavailableMessage());
    }

    logCoreDbWarning(
      "Skipped in development because database is unavailable",
      error
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const onboardingRequest = createOnboardingRequest(body);
    const account = await tryRegisterAccount(onboardingRequest);
    const provisioning = await provisionOnboardingRequest(onboardingRequest);

    if (provisioning.status === "failed") {
      await tryUpdateOnboardingRequest(
        account,
        "failed",
        provisioning.message
      );

      return NextResponse.json(
        {
          success: false,
          error: {
            code: "ONBOARDING_FAILED",
            message: provisioning.message,
          },
          data: {
            status: provisioning.status,
            message: provisioning.message,
          },
        },
        { status: 400 }
      );
    }

    await tryUpdateOnboardingRequest(account, "ready");

    if (account) {
      await setAuthSession({
        userId: account.userId,
        tenantId: account.tenantId,
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        status: provisioning.status,
        message:
          account && provisioning.status === "ready"
            ? "Registro recibido. Tu dashboard se esta preparando."
            : account
              ? provisioning.message
              : "Registro recibido. La cuenta persistente no se guardo porque la base central no esta disponible en desarrollo.",
        redirect_to: "/dashboard",
      },
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "No pudimos procesar el registro.";

    return NextResponse.json(
      {
        success: false,
        error: {
          code:
            error instanceof RegisterAccountError
              ? error.code
              : message === getCoreDbUnavailableMessage()
                ? "CORE_DATABASE_UNAVAILABLE"
                : "ONBOARDING_REGISTER_ERROR",
          message,
        },
        data: {
          status: "failed",
          message,
        },
      },
      {
        status:
          error instanceof RegisterAccountError
            ? error.status
            : message === getCoreDbUnavailableMessage()
              ? 503
              : 400,
      }
    );
  }
}
