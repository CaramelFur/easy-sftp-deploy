import { sftpConfig, SftpConfig } from './config';
import { ExecuteDeployment } from './deployment';

export async function DeployToSftp(
  config: SftpConfig,
  logger: (msg: string, color?: string) => void = console.info,
) {
  const parsed: SftpConfig = sftpConfig.parse(config);

  for (let i = 0; i < parsed.deployments.length; i++) {
    await ExecuteDeployment(parsed, i, logger);
  }
}
