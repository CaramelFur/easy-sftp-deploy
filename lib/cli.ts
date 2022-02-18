import { DeployToSftp } from '.';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import fs from 'fs';

async function main() {
  const argv = await yargs(hideBin(process.argv))
    .command('easy-sftp-deploy', 'Deploy to SFTP')
    .option('config', {
      alias: 'c',
      describe: 'Path to the config file',
      type: 'string',
      default: './sftp.deploy.json',
    })
    // .option('color', {
    //   describe: 'Colorize output',
    //   type: 'boolean',
    //   default: true,
    // })
    .parse();

  if (
    fs.existsSync(argv.config) === false ||
    fs.lstatSync(argv.config).isFile() === false
  )
    throw new Error(`Config file ${argv.config} does not exist or is not a file`);

  const configData = fs.readFileSync(argv.config, 'utf8');
  let json: any = null;
  try {
    json = JSON.parse(configData);
  } catch (e) {
    throw new Error(`Config file ${argv.config} is not valid JSON`);
  }

  await DeployToSftp(json);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
