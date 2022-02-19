import { DeployToSftp, DeployToSftpFromFile } from '.';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { SftpLogger, SftpLoggerNoColor } from './logger';

async function main(): Promise<boolean> {
  const argv = await yargs(hideBin(process.argv))
    .command('easy-sftp-deploy', 'Deploy to SFTP')
    .option('config', {
      alias: 'c',
      describe: 'Path to the config file',
      type: 'string',
      default: './sftp.deploy.json',
    })
    .option('color', {
      describe: 'Colorize output',
      type: 'boolean',
      default: true,
    })
    .parse();

  return await DeployToSftpFromFile(
    argv.config,
    argv.color ? SftpLogger : SftpLoggerNoColor,
  );
}

main().then(success => {
  process.exit(success ? 0 : 1);
}).catch((err) => {
  console.error(err);
  process.exit(1);
});
