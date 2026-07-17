# Pomerium integration (sponsor)

**Pomerium** is an open-source, identity-aware reverse proxy. **No API key, no SaaS
account** — it's a container you run with a `config.yaml`. It replaces Ghost in our
sponsor stack; agent memory moves to the existing **MySQL** DB (see ADR-0014).

## Role in Newfoot
Pomerium is the **secure front door + policy layer**:
- Sits in front of the app as an identity-aware reverse proxy (all traffic routes through it).
- Terminates **HTTPS** (satisfies the camera secure-context) and passes identity
  headers to the backend.
- Enforces **access policies** — e.g. protect a clinician/admin view so only allowed
  identities reach it, while the public posture-analysis funnel stays open.

This fits our "progressive identity" model: the landing page + camera analysis stay
open; Pomerium gates the sensitive/admin surface.

## Open-source Pomerium Core vs Pomerium Zero
- **Core (what we use):** self-hosted, config-file driven, **no API key**. `autocert`
  gets Let's Encrypt certs (needs a public domain), or use the built-in **hosted
  authenticate** service for demos (no custom IdP needed).
- **Zero (not used):** hosted control plane (managed config) — would need an account.

## Minimal docker-compose integration
```yaml
  pomerium:
    image: pomerium/pomerium:latest
    volumes:
      - ./pomerium/config.yaml:/pomerium/config.yaml:ro
      - pomerium-cache:/data
    ports: ["443:443", "80:80"]
    depends_on: [frontend, backend]
```
```yaml
# pomerium/config.yaml
autocert: true                     # Let's Encrypt (needs a public domain); demo: hosted authenticate
routes:
  - from: https://newfoot.<domain>
    to: http://frontend:4200
    pass_identity_headers: true
    policy:
      - allow:
          and:
            - domain: { is: "*" }   # public funnel
  - from: https://newfoot.<domain>/admin
    to: http://frontend:4200
    pass_identity_headers: true
    policy:
      - allow:
          or:
            - email: { is: judge@example.com }   # gated admin/clinician view
```

## Demo notes / gotchas
- `autocert` needs a public domain (A record → the host). For a laptop demo without
  a domain, use the **hosted authenticate** option and/or self-signed certs + a
  `/etc/hosts` alias; document whichever we pick.
- Session persistence across restarts: `shared_secret` + `databroker_storage_type`.
- On Akash: run Pomerium as the ingress service in the SDL in front of frontend/backend.
- Features: F193 (proxy in front), F204 (access policy protects a route), F205
  (HTTPS + identity headers). No key needed anywhere.
