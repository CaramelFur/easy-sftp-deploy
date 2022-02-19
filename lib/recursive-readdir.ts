import fs from 'fs/promises';
import p from 'path';

type ReadDirConfig = {
  includeFolders?: boolean;
  includeDotFiles?: boolean;
};

function ReadDirConfigDefaults(config?: ReadDirConfig): ReadDirConfig {
  let out: ReadDirConfig = config ?? {};
  if (out.includeFolders === undefined) out.includeFolders = false;
  if (out.includeDotFiles === undefined) out.includeDotFiles = true;
  return out;
}

export default async function readdir(path: string, config?: ReadDirConfig) {
  const safeConfig = ReadDirConfigDefaults(config);

  const fileList: string[] = [];
  const dirList: string[] = [];

  if (safeConfig.includeFolders) dirList.push(path);

  const files = await fs.readdir(path);
  for (const file of files) {
    if (!safeConfig.includeDotFiles && file.startsWith('.')) continue;

    const filePath = p.join(path, file);
    const stats = await fs.stat(filePath);

    if (stats.isDirectory()) {
      const res = await readdir(filePath, config);

      fileList.push(...res.fileList);
      dirList.push(...res.dirList);
    } else {
      fileList.push(filePath);
    }
  }

  return { fileList, dirList };
}
