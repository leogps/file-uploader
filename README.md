# @leogps/file-uploader

Zero-config command-line tool to run a file-uploader server. Files can be uploaded typically from a browser.

Both Server and Client are written in JS.

## Features
 - Parallel file uploads
   - Number of files to upload simultaneously can be configured `-N | --parallel-file-uploads`
 - Chunked/Resumable uploads
   - Chunk size is configurable `-s | --chunk-size`
   - Number of Parallel uploads are configurable `-n | --parallel-chunk-uploads`
   - Uses SHA1 verification to ensure chunks are valid
 - Optionally disable resumable uploads

## Installation

#### Running on-demand:

Using `npx` you can run the script without installing it first:

    npx @leogps/file-uploader [path] [options]

#### Globally via `npm`

    npm install --global @leogps/file-uploader

#### As a dependency in your `npm` package:

    npm install @leogps/file-uploader

#### Using Docker

Note: a public image is not provided currently, but you can build one yourself
with the provided Dockerfile.

1. Create an image
   ```
   docker build -t my-image .
   ```
2. Run a container
   ```
   docker run -p 8080:8080 -v "${pwd}:/public" my-image
   ```
   In the example above we're serving the directory `./` (working directory).
   If you wanted to serve `./test` you'd replace `${pwd}` with `${pwd}/test`.

### Usage

    🚀file-uploader [path] [options]

    Options:
      -l, --upload-location         upload location                                          [string] [default: "/Users/<username>/uploads/"]
      -p, --port                    server port                                              [number] [default: 8082]
      -s, --chunk-size              chunk size in bytes                                      [number] [default: 512 KiB]
      -N, --parallel-file-uploads   number of simultaneous parallel file uploads             [number] [default: 3]
      -n, --parallel-chunk-uploads  number of simultaneous parallel chunk uploads (per file) [number] [default: 10]
      -c, --enable-compression      enable gzip compression (server to client responses)     [boolean] [default: true]
      -m, --max-file-size           maximum file size in bytes                               [number] [default: 100 GiB]
      --version                     Show version number                                      [boolean]
      --help                        Show help                                                [boolean]

# Development

Checkout this repository locally, then:

```sh
$ npm i
$ npm start
```