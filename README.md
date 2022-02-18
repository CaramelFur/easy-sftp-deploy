# easy-sftp-deploy

Thusfar every sftp deploy package I've tried has been terrible, so I thought I'd make my own better one.

This package allows you to easily upload folders in your package directory to one or more servers.

## Code Example

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
  sourcefolders: {
    htmldist: {
      directory: './dist',
      filter: ['**/*.html'],
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

## Cli Example

You can also use the built in cli command to deploy to sftp. Here is an example that does the same as the code example above.

First you create a config file `sftp.json`:

```json
{
  "credentials": { "main": { "username": "bob", "password": "pass" } },
  "hosts": { "main": { "host": "1.2.1.2", "credentialsID": "main" } },
  "sourcefolders": { "dist": { "directory": "./dist" } },
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
$ npx easy-sftp-deploy --config ./sftp.json
```

## Bugs

If you find any bugs, please open an issue, without feedback I'll never know they're there.
