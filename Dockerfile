# Self-hosted container for NAMCHE Brand Studio (metaball.namche.ai).
#
# Multi-stage build: the `build` stage has the full workspace (all
# devDependencies, TypeScript, Vite) and produces studio/dist (the built
# Vite app) and studio/dist-server (the compiled Node server + api/lib
# handlers). `npm prune --omit=dev` then drops devDependencies from that
# same install in place -- workspace-local packages (@namche/metaball,
# @namche/metaball-react) resolve via npm workspace symlinks, not the
# registry, so pruning an already-resolved install avoids re-resolving them
# from scratch in a slim stage. The `runtime` stage copies only the pruned
# node_modules and the two build outputs into a fresh, smaller image and
# runs as a non-root user.
FROM node:24-alpine AS build
WORKDIR /app

# Copy manifests first so `npm ci` is cached across source-only changes.
COPY package.json package-lock.json ./
COPY core/package.json core/package.json
COPY renderer/package.json renderer/package.json
COPY svg/package.json svg/package.json
COPY studio/package.json studio/package.json
RUN npm ci

COPY . .
RUN npm run build
RUN npm prune --omit=dev

FROM node:24-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080
ENV IMAGE_STUDIO_DATA_DIR=/data/image-studio

RUN addgroup -S studio && adduser -S studio -G studio
RUN mkdir -p /data/image-studio && chown -R studio:studio /data

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/studio/package.json ./studio/package.json
COPY --from=build /app/studio/dist ./studio/dist
COPY --from=build /app/studio/dist-server ./studio/dist-server

USER studio
EXPOSE 8080

CMD ["node", "studio/dist-server/server/index.js"]
