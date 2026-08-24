import app from "./src/app.ts";
import openApiSpecification from "./src/open_api_specification.ts";

const OPEN_API_SPEC_PATH = "./open-api.json";

if (import.meta.main) {
  console.log("Generating OpenAPI specification");

  const spec = app.getOpenAPI31Document(openApiSpecification);
  console.log("Generated successfully, saving OpenAPI specification to file");

  spec.openapi = "3.2.0";

  // Depends on settings in .env and would change for every local project.
  delete spec.servers;

  await Deno.writeTextFile(OPEN_API_SPEC_PATH, JSON.stringify(spec));
  console.log("Saved successfully");

  Deno.exit();
}
