# Running socialtrace via Quadlet

[Quadlet](https://docs.podman.io/en/latest/markdown/podman-systemd.unit.5.html)
lets Podman run containers as native `systemd` units — no compose file, no
terminal kept open, starts on boot, restarts itself on crash. This is for
people who want socialtrace running permanently on their own machine, as
opposed to starting it by hand with `make up` when they remember to.

**Requires Podman** (not Docker — Quadlet is a Podman/systemd integration).
Linux only for real boot-time autostart; Quadlet technically runs under
Podman Machine on macOS too, but there's no systemd on macOS to boot it
automatically, so `make up` is the better fit there.

## Known limitation

Quadlet doesn't have compose's `condition: service_healthy` — it can order
*starting* one unit after another (`After=`/`Requires=`), but it can't wait
for a container's healthcheck to pass before starting the next one. The
`backend` and `backup` units instead use `Restart=on-failure` with a short
`RestartSec`, so if they start before `db` is actually ready to accept
connections, they crash-loop for a few seconds and then succeed once it is.
This is normal on first boot — check `systemctl --user status
socialtrace-backend.service` if it doesn't come up within ~30s.

## Setup

1. **Clone the repo to `~/socialtrace`.** The unit files reference
   `%h/socialtrace/.env` (`%h` = your home directory). If you cloned it
   somewhere else, edit the `EnvironmentFile=` line in each `.container`
   file to match.

2. **Create `.env`** (if you haven't already) and fill in
   `SOCIALTRACE_POSTGRES_*` to match `POSTGRES_*` — see the comments in
   `.env.example`. This duplication exists because Quadlet can't do the
   `${POSTGRES_DB}`-style cross-referencing compose does at template time.

3. **Build the images once.** Quadlet doesn't build from a Containerfile
   inline like compose does — it needs image tags that already exist:

   ```sh
   cd ~/socialtrace
   podman compose build
   ```

4. **Install the units:**

   ```sh
   mkdir -p ~/.config/containers/systemd
   cp quadlet/*.container quadlet/*.volume quadlet/*.network \
     ~/.config/containers/systemd/
   systemctl --user daemon-reload
   ```

5. **Start it:**

   ```sh
   systemctl --user start socialtrace-caddy.service
   ```

   Starting `caddy` pulls in `backend` and `frontend` (and transitively
   `db`) via `Requires=`. `backup` isn't a dependency of anything — start it
   separately:

   ```sh
   systemctl --user start socialtrace-backup.service
   ```

6. **Enable autostart on boot:**

   ```sh
   systemctl --user enable socialtrace-caddy.service socialtrace-backup.service
   ```

   By default, user systemd services only run while you're logged in. To
   have them start at boot without logging in first:

   ```sh
   sudo loginctl enable-linger "$USER"
   ```

Once running, the app is at `http://localhost:8080`, same as `make up`.

## Useful commands

```sh
systemctl --user status socialtrace-backend.service    # is it healthy?
journalctl --user -u socialtrace-backend.service -f    # follow its logs
systemctl --user restart socialtrace-caddy.service     # restart the stack
systemctl --user stop socialtrace-caddy.service socialtrace-backup.service
```

## Updating

After pulling new code:

```sh
podman compose build
systemctl --user restart socialtrace-db.service socialtrace-backend.service \
  socialtrace-frontend.service socialtrace-caddy.service socialtrace-backup.service
```
