# Embedding the DocSage Widget

Phase 2 ships the browser client as a JavaScript module and a custom element.

```html
<script type="module" src="https://cdn.example.com/docsage-widget.mjs"></script>

<docsage-widget
  endpoint="https://api.example.com"
  token="PUBLIC_SIGNED_WIDGET_TOKEN"
  theme="auto"
  position="right"
></docsage-widget>
```

The token is intentionally public. It is signed and limited to one project, an origin allowlist, and an expiration time. It does not grant ingestion, mutation, private-source, or administrative access.

## Attributes

| Attribute | Required | Values | Purpose |
|---|---:|---|---|
| `endpoint` | yes | HTTP or HTTPS API base | Widget API host |
| `token` | yes | signed public token | Project and origin scope |
| `theme` | no | `auto`, `light`, `dark` | Visual theme |
| `position` | no | `right`, `left` | Launcher and panel edge |
| `title` | no | plain text | Overrides the configured heading |

## Theme variables

A host page can set CSS custom properties on the element:

```css
docsage-widget {
  --docsage-accent: #6d28d9;
  --docsage-accent-contrast: #ffffff;
  --docsage-radius: 18px;
}
```

The internal DOM remains isolated by Shadow DOM.

## Events

The widget emits privacy-bounded events:

- `docsage:open`
- `docsage:close`
- `docsage:answer` with `traceId`, answer `state`, and citation count
- `docsage:error` with a public error code and retryable flag

Answer text, questions, retrieved evidence, prompts, and token claims are not copied into event details.

## Browser request boundaries

The browser sends only:

- the current question;
- the current public page URL;
- the signed public widget token.

Requests use `credentials: "omit"`, `cache: "no-store"`, and `referrerPolicy: "no-referrer"`. The widget does not inspect page text, forms, cookies, local storage, or browser history.

## Accessibility

The default widget provides:

- a labelled launcher button;
- a non-modal dialog region;
- a keyboard-accessible close control;
- Enter to submit and Shift+Enter for a newline;
- Escape to close;
- focus restoration to the launcher;
- a polite live region for messages and request status;
- reduced-motion behavior when requested by the operating system.
