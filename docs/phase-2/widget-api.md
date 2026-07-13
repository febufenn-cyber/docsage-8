# Widget API Contract

Base path: `/v1/widget`

All responses use JSON and include `x-docsage-request-id`.

## Authentication

Requests use:

```http
Authorization: Bearer <public-widget-token>
Origin: https://docs.example.com
```

The widget token is public, signed, project-scoped, origin-scoped, and time-bounded. It is not an API secret.

## `GET /config`

Returns public display configuration after token and origin validation.

```json
{
  "project": {
    "id": "project_public_id",
    "name": "Example Docs"
  },
  "widget": {
    "title": "Ask Example Docs",
    "placeholder": "Ask a documentation question…",
    "theme": "auto"
  },
  "limits": {
    "questionCharacters": 1000
  }
}
```

## `POST /answer`

Request:

```json
{
  "question": "How do I configure authentication?",
  "pageUrl": "https://docs.example.com/auth"
}
```

`pageUrl` is optional and is used only as public page context. The API must not fetch it during the answer request.

Response:

```json
{
  "requestId": "req_...",
  "traceId": "run_...",
  "state": "supported",
  "answer": "...",
  "assumptions": {
    "version": "current",
    "runtime": "all"
  },
  "citations": [
    {
      "label": "Authentication > Usage",
      "url": "https://docs.example.com/auth#usage"
    }
  ]
}
```

The endpoint exposes only the public answer representation. Retrieval scores, prompts, provider payloads, internal failure traces, and source bytes are not returned.

## `POST /feedback`

Request:

```json
{
  "eventId": "client-generated-uuid",
  "traceId": "run_...",
  "rating": "useful",
  "reason": "clear_answer"
}
```

Allowed ratings:

- `useful`
- `not_useful`

Allowed reasons are a controlled vocabulary. Optional free text is limited to 500 characters and disabled by default.

Response:

```json
{
  "accepted": true,
  "duplicate": false
}
```

Repeated `eventId` values are idempotent.

## Errors

```json
{
  "error": {
    "code": "ORIGIN_NOT_ALLOWED",
    "message": "This widget is not enabled for the requesting origin.",
    "requestId": "req_...",
    "retryable": false
  }
}
```

Public error codes:

- `BAD_REQUEST`
- `TOKEN_REQUIRED`
- `TOKEN_INVALID`
- `TOKEN_EXPIRED`
- `ORIGIN_REQUIRED`
- `ORIGIN_NOT_ALLOWED`
- `RATE_LIMITED`
- `NOT_FOUND`
- `ANSWER_UNAVAILABLE`
- `FEEDBACK_INVALID`
- `INTERNAL_ERROR`

Errors never include stack traces, provider bodies, secret values, SQL details, or token claims.

## CORS

For an allowed origin, responses include:

```http
Access-Control-Allow-Origin: <exact request origin>
Vary: Origin
Access-Control-Allow-Headers: authorization, content-type
Access-Control-Allow-Methods: GET, POST, OPTIONS
```

Wildcard `Access-Control-Allow-Origin: *` is forbidden for widget API responses.

## Limits

- Maximum request body: 8 KiB
- Maximum question: 1,000 Unicode characters
- Maximum page URL: 2,048 characters
- Maximum feedback text: 500 characters
- Default rate: 20 answer requests per five minutes per project, origin, and client-key tuple
- Maximum citations returned: 8
