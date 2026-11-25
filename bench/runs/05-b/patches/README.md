# Patches

## dsh-undo-0.2.2.patch

`dsh-undo@0.2.0` reads `session.events`, which DSH 0.2.x made private, and its
peer ranges stop at 0.1.x. DSH then refuses to compose the plugin (the
"upgrade" message) even though the surface operations it needs still exist.

The patch replaces the two `session.events` reads with
`session.snapshotEvents()` and widens the `@deepseek-ai/dsh-*` peers to
`>=0.1.0-rc.6 <0.3.0`. The undo marker is a `developer/message` carrying an
explicit producer-owned source (`kind: "dsh-undo"`); DSH's v4 session format
rejects a developer message without one, which otherwise poisons every later
turn in that session. Apply it to the npm tarball:

```sh
npm pack dsh-undo@0.2.0
tar xzf dsh-undo-0.2.0.tgz
cd package
patch -p1 < ../../patches/dsh-undo-0.2.2.patch
npm pack
dsh plugin --profile <profile> add ./dsh-undo-0.2.0-totem.6.tgz
```

The patched tarball installed here lives at
`~/.dsh/vendor/dsh-undo-0.2.0-totem.6.tgz`.
