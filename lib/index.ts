import { sftpConfig, SftpConfig } from './config';
import { ExecuteDeployment } from './deployment';
import { SftpLogger, SftpLoggerType } from './logger';
import fs from 'fs';

export async function DeployToSftp(
  config: SftpConfig,
  logger: SftpLoggerType = SftpLogger,
): Promise<boolean> {
  let parsed: SftpConfig | undefined = undefined;
  try {
    parsed = sftpConfig.parse(config);
  } catch (e) {}
  if (!parsed) {
    if ((config as any)?.sourcefolders && !(config as any)?.sourceFolders){
      logger('"sourcefolders" is deprecated, use "sourceFolders" instead', { type: 'error' });
    }
    logger('Invalid config', { type: 'error' });
    return false;
  }

  let totalResult = true;
  for (let i = 0; i < parsed.deployments.length; i++) {
    const result = await ExecuteDeployment(parsed, i, logger);
    if (result === false) totalResult = false;
  }

  return totalResult;
}

export async function DeployToSftpFromFile(
  configFile: string,
  logger: SftpLoggerType = SftpLogger,
): Promise<boolean> {
  if (
    fs.existsSync(configFile) === false ||
    fs.lstatSync(configFile).isFile() === false
  ) {
    logger(`Config file ${configFile} does not exist or is not a file`, {
      type: 'error',
    });
    return false;
  }

  const configData = fs.readFileSync(configFile, 'utf8');
  let json: any = null;
  try {
    json = JSON.parse(configData);
  } catch (e) {
    logger(`Config file ${configFile} is not valid JSON`, { type: 'error' });
    return false;
  }

  return DeployToSftp(json, logger);
}
