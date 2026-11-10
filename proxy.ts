import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse, type NextRequest, type NextFetchEvent } from "next/server";

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
  "/api/v1/(.*)", // Authenticated by API key, independently of browser sessions.
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

const clerkProxy = clerkMiddleware(
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

// Integration requests must never invoke Clerk (including handshake/redirect
// behavior before its callback). Their route handlers validate API keys.
export default function proxy(request: NextRequest, event: NextFetchEvent) {
  if (request.nextUrl.pathname.startsWith("/api/v1/") || process.env.APPSOLUX_AUTH_PROVIDER?.trim().toLowerCase() !== "clerk") {
    return NextResponse.next();
  }
  return clerkProxy(request, event);
}

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
