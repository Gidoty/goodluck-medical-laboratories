import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: "ADMIN" | "PATIENT";
    } & DefaultSession["user"];
  }

  interface User {
    role: "ADMIN" | "PATIENT";
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: "ADMIN" | "PATIENT";
  }
}
