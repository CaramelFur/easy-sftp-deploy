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

export async function ExecuteDeployment(
  config: SftpConfig,
  deploymentID: number,
  log: (msg: string, color?: string) => void,
) {
  log(`Starting deployment ${deploymentID + 1}`);

  // Validate all data ======================================================
  const deployment: SftpDeployConfig = config.deployments[deploymentID];
  if (deployment.clear === undefined) deployment.clear = false;
  if (deployment.dryRun === undefined) deployment.dryRun = false;
  if (deployment.overwrite === undefined) deployment.overwrite = false;

  const host: SftpHostConfig = config.hosts[deployment.hostID];
  if (!host) throw new Error(`Host ${deployment.hostID} not found`);

  const credentials: SftpCredentialConfig =
    config.credentials[host.credentialsID];
  if (!credentials)
    throw new Error(`Credentials ${host.credentialsID} not found`);

  const src = config.sourcefolders[deployment.srcID];
  if (!src) throw new Error(`Source ${deployment.srcID} not found`);

  const srcAbsDir = path.resolve(src.directory, './') + '/';
  const dstAbsDir = path.resolve(deployment.dstFolder, './') + '/';

  // check src.directory exists and is a directory
  if (
    fs.existsSync(srcAbsDir) === false ||
    fs.lstatSync(srcAbsDir).isDirectory() === false
  )
    throw new Error(
      `Source directory ${srcAbsDir} does not exist or is not a directory`,
    );

  // Collect files ===========================================================

  log(`Collecting files from ${srcAbsDir}`);

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
    log(`[Dry run]`);
    log(`Create files:`);
    for (let i = 0; i < filteredSrcFiles.length; i++) {
      log(
        `  ${srcAbsDir}${filteredSrcFiles[i]} -> ${dstAbsDir}${filteredSrcFiles[i]}`,
      );
    }
    log(`Create folders:`);
    for (let i = 0; i < filteredSrcFolders.length; i++) {
      log(
        `  ${srcAbsDir}${filteredSrcFolders[i]} -> ${dstAbsDir}${filteredSrcFolders[i]}`,
      );
    }
    return;
  }

  // Upload files ===========================================================

  log(`Connecting to ${host.host}`);

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
    throw new Error(`Could not create target directory ${dstAbsDir}`);
  }

  if (deployment.clear) {
    log(`Clearing target directory ${dstAbsDir}`);

    try {
      const found = await sftp.list(dstAbsDir);
      for (let file of found) {
        const p = path.resolve(dstAbsDir, file.name);
        log(`Deleting ${p}`);

        if (file.type === 'd') {
          await sftp.rmdir(p, true);
        } else {
          await sftp.delete(p);
        }
      }
    } catch (e) {
      throw new Error(`Could not clear target directory ${dstAbsDir}`);
    }
  }

  log(`Creating folders on ${dstAbsDir}`);
  for (let i = 0; i < filteredSrcFolders.length; i++) {
    const srcFolder = path.resolve(srcAbsDir, filteredSrcFolders[i]);
    const dstFolder = path.resolve(dstAbsDir, filteredSrcFolders[i]);

    log(`(${i + 1}/${filteredSrcFolders.length}) ${dstFolder}`);

    try {
      await sftp.mkdir(dstFolder, true);
    } catch (e) {
      throw new Error(`Could not create target directory ${dstFolder}`);
    }
  }

  log(`Uploading files to ${dstAbsDir}`);
  for (let i = 0; i < filteredSrcFiles.length; i++) {
    const srcFile = path.resolve(srcAbsDir, filteredSrcFiles[i]);
    const dstFile = path.resolve(dstAbsDir, filteredSrcFiles[i]);

    log(`(${i + 1}/${filteredSrcFiles.length}) ${srcFile} -> ${dstFile}`);

    try {
      if (await sftp.exists(dstFile)) {
        if (!deployment.overwrite) {
          log(`  Skipping, already exists`);
          continue;
        }
      }

      await sftp.fastPut(srcFile, dstFile);
    } catch (e) {
      throw new Error(`Could not upload ${srcFile} to ${dstFile}`);
    }
  }

  log(`Closing connection`);

  await sftp.end();

  log(`Deployment ${deploymentID + 1} finished`);

  return;
}
