# Debian, not alpine: the runtime below is glibc and will not start a musl-linked binary.
FROM denoland/deno:2.9.5 AS build

WORKDIR /app

# Fixed rather than the image's default, so the whole module cache can be copied below.
ENV DENO_DIR=/deno-dir

COPY --link deno.jsonc deno.lock ./

# Before the source, so a code change does not refetch them.
RUN deno install

COPY --link . .

# Its own step, so a type error fails the build rather than the container.
RUN deno task type-check

# Every module resolved and cached now, so the runtime never reaches the network.
RUN deno cache main.ts

# cc, not static: Deno needs glibc and libgcc, and a native addon needs libstdc++.
# Carries CA certificates.
FROM gcr.io/distroless/cc-debian12:nonroot

# The image no longer carries one compiled executable. `deno compile` cannot load a native
# addon — `sharp` fails with `Could not load the "sharp" module` — and the measurement behind
# that choice is in #94. So the runtime carries Deno, the source and the module cache instead.
ENV DENO_DIR=/deno-dir

COPY --link --from=build /usr/bin/deno /usr/bin/deno
COPY --link --from=build /deno-dir /deno-dir
COPY --link --from=build /app /app

WORKDIR /app

EXPOSE 8000

# `--cached-only` so a missing module fails loudly here rather than by reaching the network
# from production. Arguments appended by `compose run` — `--seed`, `--grant-role` — still land
# on `main.ts`, because the entry point ends with it.
ENTRYPOINT ["/usr/bin/deno", "run", "--cached-only", "--permission-set=default", "main.ts"]
