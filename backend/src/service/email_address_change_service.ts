import { db } from "@/src/database/client.ts";
import { verifyPassword } from "@/src/util/password.ts";
import { getRequiredEnvVariable } from "@/src/util/env.ts";
import { Mailer } from "@/src/mail/mailer.ts";
import {
  emailAddressChangeCompletedMail,
  emailAddressChangeConfirmationMail,
  emailAddressChangeRequestedMail,
} from "@/src/mail/email_address_change_mail.ts";
import {
  TOKEN_LIFETIME,
  UserTokenService,
} from "@/src/service/user_token_service.ts";

const HOST_URL = getRequiredEnvVariable("HOST_URL");

function link(path: string, token: string): string {
  const url = new URL(path, HOST_URL);
  url.searchParams.set("token", token);
  return url.toString();
}

export type RequestEmailAddressChangeResult =
  | "requested"
  | "wrong_password"
  | "in_use"
  | "not_verified";

/**
 * Stages a change: nothing about the account moves until the link sent to the new address is
 * opened, so a mistyped or hostile request expires into nothing.
 *
 * The current password is what makes this safe. A stolen session is the likely way in, and
 * without the password it gets no further — which is why this is not the same endpoint as
 * correcting an address that was never verified.
 *
 * Not run in the background, unlike the reset request: the caller is authenticated and asked
 * about their own account, so there is nobody to hide the answer from and a wrong password
 * has to be reported.
 */
async function requestEmailAddressChange(
  userId: string,
  newEmailAddress: string,
  password: string,
): Promise<RequestEmailAddressChangeResult> {
  const normalisedAddress = newEmailAddress.toLowerCase();

  const user = await db
    .selectFrom("user")
    .select([
      "id",
      "username",
      "emailAddress",
      "emailAddressVerifiedAt",
      "hashedPassword",
    ])
    .where("id", "=", userId)
    .executeTakeFirstOrThrow();

  if (!await verifyPassword(password, user.hashedPassword)) {
    return "wrong_password";
  }

  // Correcting an address nobody has proven yet is the other endpoint's job, and it asks for
  // no password. Reaching this one without a verified address would be a way around that.
  if (user.emailAddressVerifiedAt === null) {
    return "not_verified";
  }

  const taken = await db
    .selectFrom("user")
    .select(["id"])
    .where("emailAddress", "=", normalisedAddress)
    .where("id", "!=", userId)
    .executeTakeFirst();

  if (taken !== undefined) {
    return "in_use";
  }

  const token = await UserTokenService.issueToken({
    userId,
    purpose: "email_address_change",
    newEmailAddress: normalisedAddress,
  });

  // The cooldown swallowed it, so a link is already on its way to somewhere.
  if (token === undefined) {
    return "requested";
  }

  Mailer.sendInBackground(emailAddressChangeConfirmationMail({
    username: user.username,
    newEmailAddress: normalisedAddress,
    link: link("/confirm-email-address-change", token),
    lifetime: TOKEN_LIFETIME,
  }));

  // The same token cancels, which is safe because cancelling only restores what is already
  // true. It saves a second kind of token and a second thing to expire.
  Mailer.sendInBackground(emailAddressChangeRequestedMail({
    username: user.username,
    currentEmailAddress: user.emailAddress,
    newEmailAddress: normalisedAddress,
    link: link("/cancel-email-address-change", token),
    lifetime: TOKEN_LIFETIME,
  }));

  return "requested";
}

export type ConfirmEmailAddressChangeResult =
  | "changed"
  | "invalid_token"
  | "in_use";

/**
 * Applies the change. Consuming the token, moving the address and ending every other session
 * are one transaction, so the account cannot end up half-moved.
 */
async function confirmEmailAddressChange(
  token: string,
): Promise<ConfirmEmailAddressChangeResult> {
  const outcome = await db.transaction().execute(async (transaction) => {
    const consumed = await UserTokenService.consumeToken(
      transaction,
      token,
      "email_address_change",
    );

    if (consumed === null || consumed === undefined) {
      return "invalid_token" as const;
    }

    // The CHECK guarantees this for an email_change row; the guard is for the type.
    const { userId, newEmailAddress } = consumed;

    if (newEmailAddress === null) {
      return "invalid_token" as const;
    }

    // Somebody may have registered the address during the hour the link was valid.
    const taken = await transaction
      .selectFrom("user")
      .select(["id"])
      .where("emailAddress", "=", newEmailAddress)
      .where("id", "!=", userId)
      .executeTakeFirst();

    if (taken !== undefined) {
      return "in_use" as const;
    }

    const user = await transaction
      .selectFrom("user")
      .select(["username", "emailAddress"])
      .where("id", "=", userId)
      .executeTakeFirstOrThrow();

    await transaction
      .updateTable("user")
      // Stays verified: opening the link is what proved the new address. Nulling it would
      // wall the member behind the verification screen for an address they just confirmed.
      .set({
        emailAddress: newEmailAddress,
        emailAddressVerifiedAt: Temporal.Now.instant().toString(),
      })
      .where("id", "=", userId)
      .execute();

    // Everyone else is evicted. If the request came from somebody who should not have been
    // signed in, this is where they lose it.
    await transaction
      .deleteFrom("userSession")
      .where("userId", "=", userId)
      .execute();

    return {
      username: user.username,
      previousEmailAddress: user.emailAddress,
      newEmailAddress,
    };
  });

  if (outcome === "invalid_token" || outcome === "in_use") {
    return outcome;
  }

  Mailer.sendInBackground(emailAddressChangeCompletedMail(outcome));
  return "changed";
}

/** The cancel link from the notice sent to the old address. */
async function cancelEmailAddressChange(token: string): Promise<boolean> {
  return await UserTokenService.revokeToken(token, "email_address_change");
}

export const EmailAddressChangeService = {
  requestEmailAddressChange,
  confirmEmailAddressChange,
  cancelEmailAddressChange,
};
