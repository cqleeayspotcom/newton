# Newfoot backend (NestJS) — dev image. Source is bind-mounted in compose so
# edits hot-reload via `nest start --watch`.
FROM node:24-alpine

WORKDIR /app

# Install deps first for layer caching. No lockfile yet (scaffolded with
# --skip-install), so use `npm install`.
COPY package.json ./
RUN npm install

COPY . .

EXPOSE 3000

CMD ["npm", "run", "start:dev"]
