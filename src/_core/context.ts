import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { IUser } from "../models";
import { authenticateRequest } from "./sdk";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: IUser | null;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: IUser | null = null;

  try {
    user = await authenticateRequest(opts.req);
  } catch {
    user = null;
  }

  return { req: opts.req, res: opts.res, user };
}
