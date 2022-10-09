import fs from 'fs';
import micromatch from 'micromatch';
import path from 'path';
import Client from 'ssh2-sftp-client';
import {
  SftpConfig,
  SftpCredentialConfig,
  SftpDeployConfig,
  SftpHostConfig
} from './config';
import { SftpLoggerType } from './logger';
import Parallelizor from './parallelizor';
import readdir from './recursive-readdir';

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
  if (src.includeAllFolders === undefined) src.includeAllFolders = false;
  if (src.includeDotFiles === undefined) src.includeDotFiles = true;

  const srcAbsDir = path.resolve(src.folder) + path.sep;
  const dstAbsDir = path.resolve(deployment.dstFolder) + path.sep;

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

  const { fileList, dirList } = await readdir(srcAbsDir, {
    includeDotFiles: src.includeDotFiles,
    includeFolders: src.includeAllFolders,
  });

  // Remove absolute path and ensure non empty
  const shortenedSrcFiles = fileList
    .map((file) => file.replace(srcAbsDir, ''))
    .filter((file) => file !== '');
  const shortenedSrcFolders = dirList
    .map((dir) => dir.replace(srcAbsDir, ''))
    .filter((dir) => dir !== '');

  // Extract all files and folders from the filelist
  const filteredSrcFiles = micromatch(
    shortenedSrcFiles,
    ['!', ...(src.filters || [])],
    {
      dot: true,
    },
  );
  const filteredSrcFolders = src.includeAllFolders
    ? micromatch(shortenedSrcFolders, ['!', ...(src.filters || [])], {
        dot: true,
      })
    : filteredSrcFiles
        .map((file) => path.dirname(file))
        .filter((folder) => folder != '.')
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
  (sftp as any).client.setMaxListeners(host.parallel + 10);
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

  const parallelizor = new Parallelizor<boolean>(host.parallel);

  // Clear files ===========================================================
  if (deployment.clear) {
    log(`Clearing target directory ${dstAbsDir}`, { color: 'cyan' });

    const found = await sftp.list(dstAbsDir);
    for (let i = 0; i < found.length; i++) {
      const p = path.resolve(dstAbsDir, found[i].name);
      log(`Deleting ${p}`, { color: 'yellow' });

      const result = await parallelizor.run(async () => {
        try {
          if (found[i].type === 'd') {
            await sftp.rmdir(p, true);
          } else {
            await sftp.delete(p);
          }
          return true;
        } catch (e) {
          log(`Could not delete ${p}`, { type: 'error' });
          return false;
        }
      }, i === found.length - 1);
      
      if (result.includes(false)) {
        return false;
      }
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
  if (host.parallel > 1)
    log(`  - Parallel uploads: ${host.parallel}`, { color: 'cyan' });
  if (host.useFastPut) log(`  - Using fastPut`, { color: 'cyan' });

  for (let i = 0; i < filteredSrcFiles.length; i++) {
    const srcFile = path.resolve(srcAbsDir, filteredSrcFiles[i]);
    const dstFile = path.resolve(dstAbsDir, filteredSrcFiles[i]);

    log(`(${i + 1}/${filteredSrcFiles.length}) ${srcFile} -> ${dstFile}`, {
      color: 'yellow',
    });

    const results = await parallelizor.run(async () => {
      try {
        if (await sftp.exists(dstFile)) {
          if (!deployment.overwrite) {
            log(`Skipping ${srcFile}, already exists`, { type: 'error' });
            return true;
          }
        }

        if (host.useFastPut) await sftp.fastPut(srcFile, dstFile);
        else await sftp.put(srcFile, dstFile);
        return true;
      } catch (e) {
        console.error(e);
        log(`Could not upload ${srcFile}`, { type: 'error' });
        return false;
      }
    }, i === filteredSrcFiles.length - 1);

    if (results.includes(false)) {
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
