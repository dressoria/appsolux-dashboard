import { NextResponse } from "next/server";
import { createOnboardingRequest } from "@/lib/onboarding/create-onboarding-request";
import { provisionOnboardingRequest } from "@/lib/onboarding/provisioning";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const onboardingRequest = createOnboardingRequest(body);
    const provisioning = await provisionOnboardingRequest(onboardingRequest);

    if (provisioning.status === "failed") {
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
          code: "ONBOARDING_REGISTER_ERROR",
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
