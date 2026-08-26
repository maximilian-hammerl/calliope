import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { STATUS_CODE } from "@std/http/status";
import { USERS_TAG } from "@/src/open_api_specification.ts";
import authenticated from "@/src/middleware/authenticated.ts";
import { FileStore } from "@/src/storage/file_store.ts";
import { UserAvatarService } from "@/src/service/user_avatar_service.ts";
import {
  BAD_REQUEST_RESPONSE,
  COMMON_RESPONSES,
  ERROR_RESPONSE,
  jsonContent,
} from "@/src/http/response.ts";

/**
 * An hour rather than a year: a new upload is a new address, so this only governs how long a
 * *withdrawn* picture keeps showing to somebody whose cache already holds it. See #94.
 */
const CACHE_CONTROL = "private, max-age=3600, immutable";

export default new OpenAPIHono().openapi(
  createRoute({
    method: "get",
    path: "/",
    tags: [USERS_TAG],
    summary: "Read a picture",
    description:
      "Served by the application rather than as a static file, so it is behind the same session check as everything else. The address changes whenever the picture does, so it is cached for a year.",
    operationId: "getAvatar",
    middleware: authenticated,
    request: { params: z.object({ fileId: z.uuidv7() }) },
    responses: {
      [STATUS_CODE.OK]: {
        description: "The picture",
        content: {
          "image/webp": { schema: z.string().openapi({ format: "binary" }) },
        },
      },
      [STATUS_CODE.Unauthorized]: {
        description: "No valid session",
        content: jsonContent(ERROR_RESPONSE),
      },
      [STATUS_CODE.NotFound]: {
        description: "No such picture",
        content: jsonContent(ERROR_RESPONSE),
      },
      ...BAD_REQUEST_RESPONSE,
      ...COMMON_RESPONSES,
    },
  }),
  async (c) => {
    const { fileId } = c.req.valid("param");

    // The row, not the file: the bytes outlive it so a restore cannot break, but a picture somebody
    // has removed — or that went with a deleted account — must stop being served at once.
    if (!await UserAvatarService.isInUse(fileId)) {
      return c.json({ error: "Not found" }, STATUS_CODE.NotFound);
    }

    const bytes = await FileStore.read(fileId);

    if (bytes === undefined) {
      return c.json({ error: "Not found" }, STATUS_CODE.NotFound);
    }

    // `c.body` rather than `c.json`, which is why this route's success has no JSON schema. The
    // buffer, not the view: Hono's typed overloads take an `ArrayBuffer`.
    const body = bytes.buffer.slice(
      bytes.byteOffset,
      bytes.byteOffset + bytes.byteLength,
    ) as ArrayBuffer;

    return c.body(body, STATUS_CODE.OK, {
      "content-type": "image/webp",
      "cache-control": CACHE_CONTROL,
    });
  },
);
