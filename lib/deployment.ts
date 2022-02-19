import {
  SftpConfig,
  SftpCredentialConfig,
  SftpDeployConfig,
  SftpHostConfig,
} from './config';
import micromatch from 'micromatch';
import recursive from 'recursive-readdir';
import fs from 'fs';
import path from 'path';
import Client from 'ssh2-sftp-client';
import { SftpLoggerType } from './logger';

export async function ExecuteDeployment(
  config: SftpConfig,
  deploymentID: number,
  log: SftpLoggerType,
): Promise<boolean> {
  log(`Starting deployment ${deploymentID + 1}`, {
    style: 'bold',
    color: 'green',
  });

  // Validate all data ======================================================
  const deployment: SftpDeployConfig = config.deployments[deploymentID];
  if (deployment.clear === undefined) deployment.clear = false;
  if (deployment.dryRun === undefined) deployment.dryRun = false;
  if (deployment.overwrite === undefined) deployment.overwrite = false;

  const host: SftpHostConfig = config.hosts[deployment.hostID];
  if (!host) {
    log(`Hostconfig ${deployment.hostID} does not exist`, { type: 'error' });
    return false;
  }

  const credentials: SftpCredentialConfig =
    config.credentials[host.credentialsID];
  if (!credentials) {
    log(`Credentialconfig ${host.credentialsID} does not exist`, {
      type: 'error',
    });
    return false;
  }

  const src = config.sourceFolders[deployment.srcID];
  if (!src) {
    log(`Sourceconfig ${deployment.srcID} does not exist`, { type: 'error' });
    return false;
  }

  const srcAbsDir = path.resolve(src.directory, './') + '/';
  const dstAbsDir = path.resolve(deployment.dstFolder, './') + '/';

  // check src.directory exists and is a directory
  if (
    fs.existsSync(srcAbsDir) === false ||
    fs.lstatSync(srcAbsDir).isDirectory() === false
  ) {
    log(`Source directory ${srcAbsDir} does not exist or is not a directory`, {
      type: 'error',
    });
    return false;
  }

  // Collect files ===========================================================

  log(`Collecting files from ${srcAbsDir}`, { color: 'cyan' });

  const srcFiles = (await recursive(srcAbsDir, [])).map((file) =>
    file.replace(srcAbsDir, ''),
  );
  const filteredSrcFiles = micromatch(srcFiles, ['!', ...(src.filter || [])], {
    dot: true,
  });
  const filteredSrcFolders = filteredSrcFiles
    .map((file) => path.dirname(file))
    .filter((folder, index, self) => self.indexOf(folder) === index);

  if (deployment.dryRun) {
    log(`[Dry run]`, { color: 'cyan', style: 'bold' });
    log(`Create files:`, { color: 'cyan' });
    for (let i = 0; i < filteredSrcFiles.length; i++) {
      log(
        `  ${srcAbsDir}${filteredSrcFiles[i]} -> ${dstAbsDir}${filteredSrcFiles[i]}`,
      );
    }
    log(`Create folders:`, { color: 'cyan' });
    for (let i = 0; i < filteredSrcFolders.length; i++) {
      log(
        `  ${srcAbsDir}${filteredSrcFolders[i]} -> ${dstAbsDir}${filteredSrcFolders[i]}`,
      );
    }

    log(`Deployment ${deploymentID + 1} finished`, {
      style: 'bold',
      color: 'green',
    });

    return true;
  }

  // Upload files ===========================================================

  log(`Connecting to ${host.host}`, { color: 'blue' });

  const sftp = new Client();
  await sftp.connect({
    host: host.host,
    username: credentials.username,
    password: credentials.password,
    privateKey: credentials.privateKey,
    port: host.port,
  });

  try {
    if (!(await sftp.exists(dstAbsDir))) {
      await sftp.mkdir(dstAbsDir, true);
    }
  } catch (e) {
    log(`Could not create directory ${dstAbsDir}`, { type: 'error' });
    return false;
  }

  if (deployment.clear) {
    log(`Clearing target directory ${dstAbsDir}`, { color: 'cyan' });

    try {
      const found = await sftp.list(dstAbsDir);
      for (let file of found) {
        const p = path.resolve(dstAbsDir, file.name);
        log(`Deleting ${p}`, { color: 'yellow' });

        if (file.type === 'd') {
          await sftp.rmdir(p, true);
        } else {
          await sftp.delete(p);
        }
      }
    } catch (e) {
      log(`Could not clear directory ${dstAbsDir}`, { type: 'error' });
      return false;
    }
  }

  log(`Creating folders on ${dstAbsDir}`, { color: 'cyan' });
  for (let i = 0; i < filteredSrcFolders.length; i++) {
    const srcFolder = path.resolve(srcAbsDir, filteredSrcFolders[i]);
    const dstFolder = path.resolve(dstAbsDir, filteredSrcFolders[i]);

    log(`(${i + 1}/${filteredSrcFolders.length}) ${dstFolder}`, {
      color: 'yellow',
    });

    try {
      await sftp.mkdir(dstFolder, true);
    } catch (e) {
      log(`Could not create directory ${dstFolder}`, { type: 'error' });
      return false;
    }
  }

  log(`Uploading files to ${dstAbsDir}`, { color: 'cyan' });
  for (let i = 0; i < filteredSrcFiles.length; i++) {
    const srcFile = path.resolve(srcAbsDir, filteredSrcFiles[i]);
    const dstFile = path.resolve(dstAbsDir, filteredSrcFiles[i]);

    log(`(${i + 1}/${filteredSrcFiles.length}) ${srcFile} -> ${dstFile}`, {
      color: 'yellow',
    });

    try {
      if (await sftp.exists(dstFile)) {
        if (!deployment.overwrite) {
          log(`  Skipping, already exists`, { type: 'error' });
          continue;
        }
      }

      await sftp.fastPut(srcFile, dstFile);
    } catch (e) {
      log(`Could not upload ${srcFile}`, { type: 'error' });
      return false;
    }
  }

  log(`Closing connection`, { color: 'blue' });

  await sftp.end();

  log(`Deployment ${deploymentID + 1} finished`, {
    style: 'bold',
    color: 'green',
  });

  return true;
}
