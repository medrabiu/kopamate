export type ConnectionOptions = {
  host?: string;
  port?: number;
  username?: string;
  password?: string;
  database?: string;
  ssl?: "require" | "allow" | "prefer" | "verify-full";
};

export function parseConnectionString(raw: string | undefined): ConnectionOptions;
