# File-Uploader Server

Zero-config command-line tool to run a file-uploader server. Files can be uploaded typically from a browser.

Both Server and Client are written in JS.

## Table of Contents

* [Run](#run-in-production-mode)
  * [Clean](#clean)
  * [Build](#build-prod)
  * [Serve](#serve-prod)
  * [Configuration Options](#configuration-options)
* [Run in Development Mode](#run-in-development-mode)
* [Complete list of commands](#complete-list-of-commands-bunnpm)

## Run in Production Mode

### Clean

    npm run clean # or bun run clean (optional)

### Build (Prod)

    npm run build-prod # or bun run build-prod

### Serve (Prod)

    node dist/ # or bun run ./dist/

### Configuration Options

    --version              Show version number                            [boolean]
    -l, --upload_location  upload location
                            [string] [default: "/Users/leogps/Downloads/uploads/"]
    -p, --port             server port                                    [number]
        --help             Show help                                      [boolean]

## Run in Development Mode

    npm run start # or bun start

## Complete list of commands (bun|npm)

* `bun|npm run clean`

    ```bash
    rimraf dist
    ```

* `bun|npm run precompile`

    ```bash
    eslint -c .eslintrc.js --fix --ext .ts src src-client
    ```

* `bun|npm run compile-server`

    ```bash
    ./node_modules/webpack-cli/bin/cli.js --config webpack.config.js
    ```

* `bun|npm run compile-client-dev`

    ```bash
    ./node_modules/webpack-cli/bin/cli.js --config webpack-client.dev.js
    ```

* `bun|npm run compile-client-prod`

    ```bash
    ./node_modules/webpack-cli/bin/cli.js --config webpack-client.prod.js
    ```

* `bun|npm run compile-dev`

    ```bash
    npm run precompile && npm run compile-server && npm run compile-client-dev
    ```

* `bun|npm run build-dev`

    ```bash
    npm run compile-dev
    ```

* `bun|npm run compile-prod`

    ```bash
    npm run precompile && npm run compile-server && npm run compile-client-prod
    ```

* `bun|npm run build-prod`

    ```bash
    npm run compile-prod
    ```

* `bun|npm run dev:server`

    ```bash
    npm run build:server:once && npm-run-all --parallel nodemon:prod watch:client
    ```

* `bun|npm run start`

    ```bash
    npm run build-dev && node dist/index.js
    ```

* `bun|npm run package`

    ```bash
    cross-env NODE_ENV=production npm run build-prod && node ./package-gzip.js
    ```