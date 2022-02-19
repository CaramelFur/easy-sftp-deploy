import { sftpConfig, SftpConfig } from './config';
import { ExecuteDeployment } from './deployment';
import { SftpLogger, SftpLoggerType } from './logger';
import fs from 'fs';

export async function DeployToSftp(
  config: SftpConfig,
  logger: SftpLoggerType = SftpLogger,
): Promise<boolean> {
  const parsed = await sftpConfig.safeParseAsync(config);
  if (!parsed.success) {
    logger('Invalid config', { type: 'error' });
    logger(
      'Since this package has just been released, the json scheme can still change. ' +
        'Please check here for more info: https://github.com/rubikscraft/easy-sftp-deploy#releases',
    );
    return false;
  }

  const data = parsed.data;

  let totalResult = true;
  for (let i = 0; i < data.deployments.length; i++) {
    const result = await ExecuteDeployment(data, i, logger);
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
