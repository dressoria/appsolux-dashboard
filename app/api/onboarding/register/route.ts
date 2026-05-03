import { NextResponse } from "next/server";
import {
  getCoreDbUnavailableMessage,
  isCoreDbRequired,
} from "@/lib/core/core-db-config";
import {
  createOnboardingRequest as createCoreOnboardingRequest,
  updateOnboardingRequestStatus,
} from "@/lib/core/onboarding-requests";
import { createOnboardingRequest } from "@/lib/onboarding/create-onboarding-request";
import { provisionOnboardingRequest } from "@/lib/onboarding/provisioning";

type NormalizedOnboardingRequest = ReturnType<typeof createOnboardingRequest>;
type PersistedOnboardingRequest = {
  id: string;
} | null;

function logCoreDbWarning(message: string, error?: unknown) {
  const detail = error instanceof Error ? ` ${error.message}` : "";
  console.warn(`[CoreDB] ${message}${detail}`);
}

async function tryCreateOnboardingRequest(
  onboardingRequest: NormalizedOnboardingRequest
): Promise<PersistedOnboardingRequest> {
  try {
    const persistedRequest = await createCoreOnboardingRequest({
      email: onboardingRequest.email,
      companyName: onboardingRequest.company_name,
      contactName: onboardingRequest.user_name,
      phone: onboardingRequest.phone,
      country: onboardingRequest.country,
      currency: onboardingRequest.base_currency,
      planKey: onboardingRequest.initial_plan,
      status: "provisioning",
      payload: {
        ...onboardingRequest,
      },
    });

    console.info("[CoreDB] OnboardingRequest saved");

    return persistedRequest;
  } catch (error) {
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
  persistedRequest: PersistedOnboardingRequest,
  status: "ready" | "failed",
  lastError?: string
) {
  if (!persistedRequest) {
    return;
  }

  try {
    await updateOnboardingRequestStatus(persistedRequest.id, status, {
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
    const persistedRequest = await tryCreateOnboardingRequest(onboardingRequest);
    const provisioning = await provisionOnboardingRequest(onboardingRequest);

    if (provisioning.status === "failed") {
      await tryUpdateOnboardingRequest(
        persistedRequest,
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

    await tryUpdateOnboardingRequest(persistedRequest, "ready");

    return NextResponse.json({
      success: true,
      data: {
        status: provisioning.status,
        message:
          provisioning.status === "ready"
            ? "Registro recibido. Tu dashboard se esta preparando."
            : provisioning.message,
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
            message === getCoreDbUnavailableMessage()
              ? "CORE_DATABASE_UNAVAILABLE"
              : "ONBOARDING_REGISTER_ERROR",
          message,
        },
        data: {
          status: "failed",
          message,
        },
      },
      { status: 400 }
    );
  }
}
