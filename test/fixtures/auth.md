# Authentication

## Bearer authentication

Bearer authentication reads the `Authorization` header. The expected shape is `Bearer {token}`.

> [!WARNING] Do not hard-code production secrets in source files.

## Basic authentication

Basic authentication verifies a username and password. It is different from bearer-token authentication.
