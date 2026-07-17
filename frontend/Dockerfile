# Newfoot frontend (Angular) — dev image running `ng serve`.
# The dev-server reverse-proxies /api -> backend via proxy.conf.json so a single
# ngrok tunnel on :4200 serves the whole app. Source is bind-mounted in compose.
FROM node:24-alpine

WORKDIR /app

COPY package.json ./
RUN npm install

COPY . .

EXPOSE 4200

# --host 0.0.0.0 so the port is reachable from outside the container.
# Host-check is bypassed for ngrok via `ngrok http --host-header=rewrite`
# (see tools/expose.sh / CLAUDE.md).
CMD ["npx", "ng", "serve", \
     "--host", "0.0.0.0", \
     "--port", "4200", \
     "--proxy-config", "proxy.conf.json"]
