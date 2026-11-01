# Security

Stitcher runs code that a language model wrote. Treat that as untrusted code, because it is.

## Reporting a vulnerability

Use GitHub's private vulnerability reporting: the **Security** tab of this repository, then **Report a vulnerability**. Please don't open a public issue. You'll get a reply within a week.

Especially interesting:

- escaping the render sandbox, or reaching the network from inside it
- reading another user's projects, chats or media
- getting the agent or render service to accept requests without the internal API key

## What the defaults assume

The compose setup is built for one person or a small trusted team on a machine they control.

- Generated Python runs inside bubblewrap in the render container. [services/render/docs/SANDBOX.md](services/render/docs/SANDBOX.md) lists exactly what is and isn't enforced. Read it before you expose Stitcher to people you don't trust.
- The render container needs `CAP_SYS_ADMIN` and unconfined AppArmor, seccomp and system paths so that bubblewrap can create its namespaces. That is a real loosening of Docker's defaults for that one container.
- MongoDB, Redis and the internal services are not published outside the compose network. Keep it that way.
- `scripts/setup.sh` generates random values for `JWT_SECRET`, the Redis password and the internal service keys. If you write `.env` by hand, use long random values too. The API refuses to start with a `JWT_SECRET` shorter than 32 characters.

## Before putting it on the internet

- Put it behind HTTPS.
- Set `EMAIL_PROVIDER=smtp` so sign-up codes go to real inboxes instead of the log.
- Run the render service on a host you don't mind losing, or a separate VM.
