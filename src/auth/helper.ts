import { getAuth, clerkClient } from "@clerk/express";
import { Request } from "express";

export async function verifyUser(req: Request) {
    const { userId } = getAuth(req as any);
    if (!userId) return null;
    const user = await clerkClient.users.getUser(userId);
    return user;
}
