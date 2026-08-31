import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { notBlank } from "@/src/http/request_schema.ts";
import { STATUS_CODE } from "@std/http/status";
import { USERS_TAG } from "@/src/open_api_specification.ts";
import { USER_SCHEMA } from "@/src/database/schema.ts";
import { TEXT_LIMIT } from "@/src/text_limit.ts";
import authenticated from "@/src/middleware/authenticated.ts";
import { authorizedAsModerator } from "@/src/middleware/authorized_as_platform_role.ts";
import { BanService } from "@/src/service/ban_service.ts";
import {
  BAD_REQUEST_RESPONSE,
  COMMON_RESPONSES,
  ERROR_RESPONSE,
  jsonContent,
  OK_RESPONSE,
} from "@/src/http/response.ts";

const BAN_USER_BODY = z.object({
  // Recorded for the operators, never shown to the member: what they are told is one fixed
  // sentence, so a note written in haste cannot become the explanation somebody reads.
  reason: notBlank(z.string().min(1).max(TEXT_LIMIT.banReason)),
});

const PARAMS = z.object({ userId: USER_SCHEMA.shape.id });

export default new OpenAPIHono()
  .openapi(
    createRoute({
      method: "post",
      path: "/ban",
      tags: [USERS_TAG],
      summary: "Ban an account for breaking the platform rules",
      description:
        "Ends every session the account has and refuses it from then on, at sign-in and on any session that outlives the ban. Deliberately not a deletion: the name and the address stay held, so the address cannot register again. Nothing the account wrote is removed — that is a separate act. An account holding a platform role cannot be banned; revoke the role first.",
      operationId: "banUser",
      middleware: [authenticated, authorizedAsModerator] as const,
      request: {
        params: PARAMS,
        body: { required: true, content: jsonContent(BAN_USER_BODY) },
      },
      responses: {
        [STATUS_CODE.OK]: {
          description: "The account is banned and its sessions are ended",
          content: jsonContent(OK_RESPONSE),
        },
        [STATUS_CODE.Unauthorized]: {
          description: "No valid session",
          content: jsonContent(ERROR_RESPONSE),
        },
        [STATUS_CODE.Forbidden]: {
          description:
            "Not an operator, or the target holds a platform role and cannot be banned",
          content: jsonContent(ERROR_RESPONSE),
        },
        [STATUS_CODE.NotFound]: {
          description: "No such account",
          content: jsonContent(ERROR_RESPONSE),
        },
        [STATUS_CODE.Conflict]: {
          description: "The account is already banned",
          content: jsonContent(ERROR_RESPONSE),
        },
        ...BAD_REQUEST_RESPONSE,
        ...COMMON_RESPONSES,
      },
    }),
    async (c) => {
      const { userId } = c.req.valid("param");
      const { reason } = c.req.valid("json");

      const refusal = await BanService.banUser(
        userId,
        reason,
        c.get("user").id,
      );

      switch (refusal) {
        case "not_found":
          return c.json({ error: "Not found" }, STATUS_CODE.NotFound);
        case "is_an_operator":
          return c.json(
            { error: "An operator cannot be banned" },
            STATUS_CODE.Forbidden,
          );
        case "already_banned":
          return c.json(
            { error: "Already banned" },
            STATUS_CODE.Conflict,
          );
        case undefined:
          return c.json({ ok: true } as const, STATUS_CODE.OK);
      }
    },
  )
  .openapi(
    createRoute({
      method: "delete",
      path: "/ban",
      tags: [USERS_TAG],
      summary: "Lift a ban",
      description:
        "Restores access. Nothing is reclaimed, because nothing was released: the name and address were held throughout. The sessions ended at the ban and do not come back.",
      operationId: "liftUserBan",
      middleware: [authenticated, authorizedAsModerator] as const,
      request: { params: PARAMS },
      responses: {
        [STATUS_CODE.OK]: {
          description: "The ban is lifted",
          content: jsonContent(OK_RESPONSE),
        },
        [STATUS_CODE.Unauthorized]: {
          description: "No valid session",
          content: jsonContent(ERROR_RESPONSE),
        },
        [STATUS_CODE.Forbidden]: {
          description: "Not an operator",
          content: jsonContent(ERROR_RESPONSE),
        },
        [STATUS_CODE.NotFound]: {
          description: "No such account, or it is not banned",
          content: jsonContent(ERROR_RESPONSE),
        },
        ...BAD_REQUEST_RESPONSE,
        ...COMMON_RESPONSES,
      },
    }),
    async (c) => {
      const { userId } = c.req.valid("param");

      if (await BanService.liftBan(userId) === "not_found") {
        return c.json({ error: "Not found" }, STATUS_CODE.NotFound);
      }

      return c.json({ ok: true } as const, STATUS_CODE.OK);
    },
  );
