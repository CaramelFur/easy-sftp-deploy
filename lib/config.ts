import { z } from 'zod';

// Credentials

const sftpCredentialConfig = z.object({
  username: z.string(),
  password: z.string().optional(),
  privateKey: z.string().optional(),
});

const sftpCredentialsConfig = z.record(sftpCredentialConfig);

// Credentials - typescript
export type SftpCredentialConfig = z.infer<typeof sftpCredentialConfig>;
export type SftpCredentialsConfig = z.infer<typeof sftpCredentialsConfig>;

// Hosts
const sftpHostConfig = z.object({
  host: z.string(),
  credentialsID: z.string(),

  port: z.number().optional(),
});

const sftpHostsConfig = z.record(sftpHostConfig);

// Hosts - typescript
export type SftpHostConfig = z.infer<typeof sftpHostConfig>;
export type SftpHostsConfig = z.infer<typeof sftpHostsConfig>;

// Sources
const sftpSrcConfig = z.object({
  directory: z.string(),

  filter: z.array(z.string()).optional(),
});

const sftpSrcsConfig = z.record(sftpSrcConfig);

// Sources - typescript
export type SftpSrcConfig = z.infer<typeof sftpSrcConfig>;
export type SftpSrcsConfig = z.infer<typeof sftpSrcsConfig>;

// Deployments
const sftpDeployConfig = z.object({
  hostID: z.string(),
  srcID: z.string(),

  dstFolder: z.string(),

  overwrite: z.boolean().optional(),
  clear: z.boolean().optional(),
  dryRun: z.boolean().optional(),
});

// Deployments - typescript
export type SftpDeployConfig = z.infer<typeof sftpDeployConfig>;

// Main config
export const sftpConfig = z.object({
  credentials: sftpCredentialsConfig,
  hosts: sftpHostsConfig,
  sourceFolders: sftpSrcsConfig,
  deployments: z.array(sftpDeployConfig),
});

// Main config - typescript
export type SftpConfig = z.infer<typeof sftpConfig>;
