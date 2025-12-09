# @leogps/file-Uploader

Zero-config command-line tool to run a file-uploader server. Files can be uploaded typically from a browser.

Both Server and Client are written in JS.

## Installation

#### Running on-demand:

Using `npx` you can run the script without installing it first:

    npx @leogps/file-uploader [path] [options

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

    file-uploader [path] [options]

    --version              Show version number                            [boolean]
    -l, --upload_location  upload location
                            [string] [default: "/Users/username/Downloads/uploads/"]
    -p, --port             server port                                    [number]
        --help             Show help                                      [boolean]

# Development

Checkout this repository locally, then:

```sh
$ npm i
$ npm start
```