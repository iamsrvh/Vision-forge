import { getAuth, clerkClient } from "@clerk/express";
import User from "../models/User.js";

export const protectRoute = async (req, res, next) => {
  try {
    const auth = getAuth(req);
    if (!auth || !auth.userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    let user = await User.findOne({ clerkId: auth.userId });

    if (!user) {
      const clerkUser = await clerkClient.users.getUser(auth.userId);
      const primaryEmail =
        clerkUser.emailAddresses?.[0]?.emailAddress || `${auth.userId}@clerk.local`;

      user = await User.create({
        clerkId: auth.userId,
        email: primaryEmail,
        firstName: clerkUser.firstName || "",
        lastName: clerkUser.lastName || "",
        photo: clerkUser.imageUrl || "",
        creditBalance: 10,
      });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error("Auth Middleware Error:", error);
    return res.status(401).json({ success: false, message: "Authentication failed" });
  }
};
