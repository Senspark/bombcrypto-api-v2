FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json tsconfig.json ./
RUN npm ci
COPY src ./src
RUN npm run build

FROM node:24-alpine
# git/bash/rsync are what the builder runs a site's install and build with; there
# is deliberately no docker cli and no ssh client in here.
RUN apk add --no-cache git bash rsync
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
COPY public ./public
COPY scripts ./scripts
# One image, two roles. Compose names the role explicitly for each service; the
# receiver is the default because it is the one with a public surface.
CMD ["node", "dist/Receiver.js"]
