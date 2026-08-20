# Debian, not alpine: the runtime below is glibc and will not start a musl-linked binary.
FROM denoland/deno:2.9.2 AS build

WORKDIR /build

COPY --link deno.jsonc deno.lock ./

# Before the source, so a code change does not refetch them.
RUN deno install

COPY --link . .

# Its own step because `compile` passes --no-check. Fails the build, not the container.
RUN deno task type-check

# One executable, so the runtime image needs no Deno and no source. Permissions are baked in.
RUN deno task compile

# cc, not static: the embedded Deno runtime needs glibc and libgcc. Carries CA certificates.
FROM gcr.io/distroless/cc-debian12:nonroot

COPY --link --from=build /build/calliope /calliope

EXPOSE 8000

ENTRYPOINT ["/calliope"]
