"use client";

import { UserButton } from "@clerk/nextjs";

export function ClerkUserMenu() {
  return (
    <UserButton
      appearance={{
        elements: {
          avatarBox: "h-8 w-8",
        },
      }}
    />
  );
}
