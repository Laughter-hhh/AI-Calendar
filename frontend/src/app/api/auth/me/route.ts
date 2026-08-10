import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSessionUser, SESSION_COOKIE } from "@/lib/auth";

export async function GET() {
  const store = await cookies();
  const user = getSessionUser(store.get(SESSION_COOKIE)?.value);
  return NextResponse.json({ user });
}
