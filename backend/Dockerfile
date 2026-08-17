FROM denoland/deno:alpine-2.9.2

WORKDIR /app

# Dependencies are cached separately from the source, so a code change does not refetch
# them. The lock file is what makes the cached layer reproducible.
COPY deno.jsonc deno.lock ./
RUN deno install

COPY . .

# Fails the build rather than the container when the sources do not type-check.
RUN deno check .

EXPOSE 8000

# No --env-file: the configuration comes from the container's environment. Binding to
# 0.0.0.0 is what lets the reverse proxy reach it over the compose network.
CMD ["serve", "--permission-set=default", "--host", "0.0.0.0", "--port", "8000", "main.ts"]
