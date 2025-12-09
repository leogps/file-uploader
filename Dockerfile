FROM node:24-alpine as build

WORKDIR /srv/file-uploader

COPY package.json package-lock.json ./
RUN npm ci --production

COPY . .
RUN npm run clean && npm run package

FROM node:24-alpine
WORKDIR /srv/file-uploader
VOLUME /public

COPY --from=build /srv/file-uploader/dist ./dist

EXPOSE 8080
ENTRYPOINT ["./dist/index.js", "-p", "8080", "-l", "/public"]