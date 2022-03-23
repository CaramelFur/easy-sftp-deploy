# easy-sftp-deploy

Thusfar every sftp deploy package I've tried has been terrible, so I thought I'd make my own better one.

This package allows you to easily upload folders in your package directory to one or more servers.

## Installation

You can add it to your project with either yarn or npm:

```sh
yarn add easy-sftp-deploy
npm install easy-sftp-deploy
```

Or you can run the cli directly:

```sh
npx easy-sftp-deploy --help
```

## Configuration

Both the cli and and javascript interface accept the same configuraton options.

The top level configuration accepts 4 options:

```txt
credentials: { [credtialID]: credentialConfig }
hosts: { [hostID]: hostConfig }
sourceFolders: { [sourceFolderID]: sourceFolderConfig }
deployments: [deploymentConfig]
```

### Credentials

The credential configuration options are all pretty self explanatory.

```txt
username: string
password: string (optional)
privateKey: string (optional)
```

### Hosts

For the host configuration you can specify the hostname and port as expected.
But for the credentials, you need to reference one of the configured credentials. This allows you to more easily reuse credentials between multiple hosts without a giant configuration file.

```txt
hostname: string
port: number (optional, default is 22)

credentialsID: string
```

### Source Folders

For a source folder configuration you firstly specify a folder on your local system. This can be either a relative or absolute path. The program will then recursively locate all files in this folder automatically. By default it includes hidden dot files, and excludes empty directories. If you wish to change this you can do so with the `includeDotFiles` and `includeAllFolders` flags.

Then you can also specify a list of filters for this directory. Here [micromatch](https://www.npmjs.com/package/micromatch) will be used internally, so you can use all the same wildcard configurations as that library allows.
The not empty match ("!") will always be added to this filterlist, and dotfiles will be matched, so keep this in mind when adding filters.

```txt
folder: string
filters: [string] (optional)

includeDotFiles: boolean (optional, default is true)
includeAllFolders: boolean (optional, default is false)
```

### Deployments

In the deployment config, you first have to specify a reference to both a host and a source folder.

Then you can specify a target folder on the remote host. Here the contents of the source folder will be uploaded to this target folder, so not the source folder itself. (If you wish to upload the source folder instead, you can change the source path and make use of the filters.)

It also has a couple flags you can set:

* overwrite - Overwrite existing files in the target directory.
* clear - Clear the target directory before uploading, ignores overwrite flag.
* dryRun - Only print what files will be uploaded.

```txt
hostID: string
sourceFolderID: string
targetFolder: string

overwrite: boolean (optional, default is false)
clear: boolean (optional, default is false)
dryRun: boolean (optional, default is false)
```

## Javascript API

This package only really exports two functions:

* `async DeployToSftp(config) -> boolean`
  Accept a configuration as javascript object, and process it. Returns true if successful.
* `async DeployToSftpFromFile(configFilePath) -> boolean`
  Accept a configuration file path, and process it. Returns true if successful.

You can import it with:

```js
import { DeployToSftp } from 'easy-sftp-deploy';
// or
const { DeployToSftp } = require('easy-sftp-deploy');
```

## CLI

This package can also be used from the command line. It can be started using `npx` and accepts two options:

* `--config <config.json>`
  The path to the configuration file.
* `--color <true | false>`
  Whether to use color in the output. (default is true)

If no config is specified it will look for the config at `./sftp.deploy.json`.

## Examples

### Code Example

Here a normal example, where a single directory is uploaded to two different servers using different credentials.

```js
import { DeployToSftp } from 'easy-sftp-deploy';

await DeployToSftp({
  credentials: {
    boblogin: {
      username: 'bob',
      password: 'securepassword',
    },
    stevelogin: {
      username: 'steve',
      privateKey:
        '-----BEGIN OPENSSH PRIVATE KEY-----\n...\n-----END OPENSSH PRIVATE KEY-----',
    },
  },
  hosts: {
    main: {
      host: '1.2.3.4',
      credentialsID: 'boblogin',
    },
    backup: {
      host: '4.3.2.1',
      credentialsID: 'stevelogin',
    },
  },
  sourceFolders: {
    htmldist: {
      folder: './dist',
      filters: ['**/*.html'],

      includeDotFiles: false,
      includeAllFolders: true,
    },
  },
  deployments: [
    {
      hostID: 'main',
      srcID: 'htmldist',
      dstFolder: '/var/www/',

      clear: true,
      overwrite: false,
      dryRun: false,
    },
    {
      hostID: 'backup',
      srcID: 'htmldist',
      dstFolder: '/var/www/',

      clear: true,
    },
  ],
});
```

### Cli Example

You can also use the built in cli command to deploy to sftp. Here is an example that does the same as the code example above.

First you create a config file `sftp.json`:

```json
{
  "credentials": { "main": { "username": "bob", "password": "pass" } },
  "hosts": { "main": { "host": "1.2.1.2", "credentialsID": "main" } },
  "sourceFolders": { "dist": { "folder": "./dist" } },
  "deployments": [
    {
      "hostID": "main",
      "srcID": "dist",
      "dstFolder": "/destination",
      "clear": true
    }
  ]
}
```

Then you can run the cli command:

```sh
npx easy-sftp-deploy --config ./sftp.json
```

## Bugs

If you find any bugs, please open an issue, without feedback I'll never know they're there.

## Releases

* [1.3.3 - 1.3.5]
  * Update dependencies
* [1.3.2]
  * Update dependencies
  * Fix license in package.json not matching the git license
* [1.3.1]
  * Fix metadata in package.json
* [1.3.0]
  * Added support for empty directories
  * Easily ignore dotfiles
  * Switched to custom recursive lister
  * Made json type checking more strict
  * Rename `directory` property in `sourceFolders` to `folder`
  * Rename `filter` property in `sourceFolders` to `filters`
* [1.2.0]
  * Added colored output
  * Added better readme
  * Renamed the `sourcefolders` property to `sourceFolders`
* [1.1.0]
  * Added CLI interface
* [1.0.0] Initial release
