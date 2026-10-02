import { NextResponse } from "next/server";
import { deleteUser } from "@/lib/storage-neon";
import { getBearerUserId } from "@/lib/mobile-auth";

// App Store rule 5.1.1(v): an app that creates accounts must let people delete
// them from inside the app. Removes the user and every row they own.
export async function DELETE(request: Request) {
  const userId = await getBearerUserId(request);
  if (!userId) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  await deleteUser(userId);
  return new Response(null, { status: 204 });
}
