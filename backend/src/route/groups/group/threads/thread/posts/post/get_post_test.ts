import { assertEquals } from "@std/assert";
import { STATUS_CODE } from "@std/http/status";
import {
  addMember,
  clearRateLimits,
  createGroup,
  deleteUsers,
  postBody,
  registerUser,
  request,
} from "@/src/test/support.ts";

const administrator = "get-post-admin";
const writer = "get-post-writer";
const outsider = "get-post-outsider";

Deno.test.beforeEach(clearRateLimits);
Deno.test.afterEach(() => deleteUsers([administrator, writer, outsider]));

async function postsByWriter(visibility: "private" | "public" = "private") {
  const adminCookie = await registerUser(administrator);
  const group = await createGroup(adminCookie, "Beitrag", visibility);
  const writerCookie = await addMember(adminCookie, group.id, writer, "writer");
  const thread = await (await request(
    "POST",
    `/api/groups/${group.id}/threads`,
    adminCookie,
    {
      title: "Kapitel 1",
    },
  )).json();
  const posts = `/api/groups/${group.id}/threads/${thread.id}/posts`;
  const published = await (await request(
    "POST",
    posts,
    writerCookie,
    postBody("Veröffentlicht"),
  )).json();
  const draft = await (await request(
    "POST",
    posts,
    writerCookie,
    postBody("Entwurf", { isDraft: true }),
  )).json();

  return { adminCookie, writerCookie, posts, published, draft };
}

Deno.test("GET …/posts/{postId} returns a published post to another member", async () => {
  const { adminCookie, posts, published } = await postsByWriter();

  const response = await request(
    "GET",
    `${posts}/${published.id}`,
    adminCookie,
  );

  assertEquals(response.status, STATUS_CODE.OK);
  assertEquals((await response.json()).text, "Veröffentlicht");
});

Deno.test("GET …/posts/{postId} reports another member's draft as missing", async () => {
  const { adminCookie, writerCookie, posts, draft } = await postsByWriter();

  // Its author can still read it.
  assertEquals(
    (await request("GET", `${posts}/${draft.id}`, writerCookie)).status,
    STATUS_CODE.OK,
  );

  const response = await request("GET", `${posts}/${draft.id}`, adminCookie);
  assertEquals(response.status, STATUS_CODE.NotFound);
});

Deno.test("GET …/posts/{postId} lets anyone signed in read a public group's post", async () => {
  const { posts, published } = await postsByWriter("public");
  const outsiderCookie = await registerUser(outsider);

  const response = await request(
    "GET",
    `${posts}/${published.id}`,
    outsiderCookie,
  );

  assertEquals(response.status, STATUS_CODE.OK);
  assertEquals((await response.json()).text, "Veröffentlicht");
});

Deno.test("GET …/posts/{postId} keeps a public group's draft with its author", async () => {
  const { posts, draft } = await postsByWriter("public");
  const outsiderCookie = await registerUser(outsider);

  const response = await request("GET", `${posts}/${draft.id}`, outsiderCookie);
  assertEquals(response.status, STATUS_CODE.NotFound);
});

Deno.test("GET …/posts/{postId} hides a private group's post from a non-member", async () => {
  const { posts, published } = await postsByWriter();
  const outsiderCookie = await registerUser(outsider);

  const response = await request(
    "GET",
    `${posts}/${published.id}`,
    outsiderCookie,
  );
  assertEquals(response.status, STATUS_CODE.NotFound);
});
