import { NextResponse } from "next/server";
import { logoutEverywhere } from "@/lib/auth/logout";

export async function POST() {
  await logoutEverywhere();

  return NextResponse.json({
    success: true,
    data: {
      redirect_to: "/login",
    },
  });
}
