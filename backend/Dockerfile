# Built from the repository root, where the pnpm workspace keeps its one lockfile. Debian like the
# runtime below, so the native binaries pnpm picks for sharp are the glibc ones it needs.
FROM node:26-trixie-slim AS build

WORKDIR /workspace

COPY --link package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY --link backend/package.json backend/

# pnpm at the version the root package.json pins, since Node no longer ships Corepack.
RUN npm install --global "$(node --print 'require("./package.json").packageManager')"

# Before the source, so a code change does not refetch them.
RUN pnpm install --frozen-lockfile --filter backend

COPY --link backend backend

# Its own step, so a type error fails the build rather than the container.
RUN pnpm --filter backend run type-check

# The backend and its production dependencies alone, in a directory of their own.
RUN pnpm --filter backend deploy --prod /app

# Where uploads go. Passed by compose from FILE_STORAGE_PATH, so the mount point and the variable
# the backend reads cannot drift apart.
ARG FILE_STORAGE_PATH=/data/files

# Owned by the runtime user here: Docker copies an image directory's ownership into a volume it
# first creates, and one it invents is root's, which `nonroot` cannot write to.
RUN mkdir -p "$FILE_STORAGE_PATH" && chown -R 65532:65532 "$(dirname "$FILE_STORAGE_PATH")"

# Node and CA certificates, without a shell or a package manager.
FROM gcr.io/distroless/nodejs26-debian13:nonroot

ARG FILE_STORAGE_PATH=/data/files

COPY --link --from=build /app /app
COPY --link --from=build --chown=65532:65532 "$FILE_STORAGE_PATH" "$FILE_STORAGE_PATH"

WORKDIR /app

EXPOSE 8000

# Node's permission model: reading the app and the uploads, writing only the uploads, sharp's native
# addon, and the network, which Node grants all or nothing. The upload directory is written out
# because an exec-form entrypoint cannot read a variable, so FILE_STORAGE_PATH stays /data/files.
# Arguments appended by `compose run` — `--seed`, `--grant-role` — still land on `main.ts`,
# because the entry point ends with it.
ENTRYPOINT ["/nodejs/bin/node", "--permission", "--allow-fs-read=/app", "--allow-fs-read=/data/files", "--allow-fs-write=/data/files", "--allow-addons", "--allow-net", "main.ts"]
