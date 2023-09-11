import dotenv from "dotenv";
dotenv.config();

import path from "path";
import { fileURLToPath } from "url";
export const workspaceDir = path.dirname(fileURLToPath(new URL(".", import.meta.url)));
export const port = parseInt(process.env.PORT ?? "8080");
export const host = process.env.HOST ?? "localhost";

export function startsWithSubstring(
  str: string,
  prefix: string
): string | undefined {
  return str.startsWith(prefix) ? str.substring(prefix.length) : undefined;
}
