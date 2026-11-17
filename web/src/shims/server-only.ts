// Stands in for the `server-only` package in the static app. A module that
// imports it holds server code (database access, secrets), so reaching this
// bundle is a mistake: fail loudly instead of shipping it to phones.
throw new Error(
  "A server-only module was imported into the static app. Move what it does into web/src/data or a database function.",
);
