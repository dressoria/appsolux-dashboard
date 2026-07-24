import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isPublicRoute = createRouteMatcher([
  "/",
  "/funciones(.*)",
  "/precios(.*)",
  "/firma(.*)",
  "/blog(.*)",
  "/contacto(.*)",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/login(.*)",
  "/register(.*)",
  "/api/webhooks(.*)",
  "/api/health(.*)",
]);

function getAuthorizedParties(): string[] {
  const raw = process.env.CLERK_AUTHORIZED_PARTIES;

  if (raw) {
    return raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }

  return ["https://app.bionvers.com"];
}

export default clerkMiddleware(
  async (auth, request) => {
    const provider = process.env.APPSOLUX_AUTH_PROVIDER?.trim().toLowerCase();

    if (provider !== "clerk") {
      return NextResponse.next();
    }

    if (!isPublicRoute(request)) {
      await auth.protect();
    }
  },
  {
    authorizedParties: getAuthorizedParties(),
  }
);

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
