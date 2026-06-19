import "@/lib/security/server-only";
import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import {
  findAppsoluxUserByClerkId,
  findOrCreateAppsoluxUserForClerk,
} from "@/lib/auth/clerk-user";
import type { AppsoluxUser } from "@/types/user";

export type AppUserResult = AppsoluxUser;

export async function getAppUser(): Promise<AppsoluxUser | null> {
  const { userId } = await auth();

  if (!userId) {
    return null;
  }

  const byId = await findAppsoluxUserByClerkId(userId);

  if (byId) {
    return byId;
  }

  const clerkUser = await currentUser();

  if (!clerkUser) {
    return null;
  }

  const primaryEmail = clerkUser.emailAddresses.find(
    (e) => e.id === clerkUser.primaryEmailAddressId
  );

  if (!primaryEmail?.emailAddress) {
    return null;
  }

  return findOrCreateAppsoluxUserForClerk({
    clerkUserId: userId,
    email: primaryEmail.emailAddress,
    name:
      [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") ||
      primaryEmail.emailAddress.split("@")[0],
    emailVerified:
      primaryEmail.verification?.status === "verified",
  });
}

export async function requireAppUser(): Promise<AppsoluxUser> {
  const user = await getAppUser();

  if (!user) {
    redirect("/sign-in");
  }

  return user;
}
