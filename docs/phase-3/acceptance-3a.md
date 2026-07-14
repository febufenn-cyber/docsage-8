# Slice 3A Acceptance Criteria

The slice is mergeable only when:

- all learning-contract tests pass;
- persisted normalized events contain none of the seeded email, IP, token, secret assignment, or URL private values;
- exact replay creates one stored event;
- conflicting replay is rejected;
- project A cannot read project B events;
- the migration enables RLS and removes update/delete privileges;
- existing evaluation, widget, and Hono regression gates remain green.
