# Basic API

Create a route with `app.get('/users/:id', handler)`.

## Path parameters

Read a named path parameter with `c.req.param('id')`. Calling `c.req.param()` without a name returns all path parameters.

## JSON responses

Return JSON with `c.json({ ok: true })`.

```ts
app.get('/health', (c) => c.json({ ok: true }))
```
