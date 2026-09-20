# disable-front-camera

A Minecraft mod that skips the front camera when cycling through the camera modes.
Available for **NeoForge** and, on Minecraft 26.1+, for **Fabric** (the Fabric jar
additionally requires [Fabric API](https://modrinth.com/mod/fabric-api)).

## Supported versions

**One jar per loader covers every version it is listed for below.** The mod only
touches a handful of Minecraft APIs that have not changed across this range, so the
compiled bytecode is identical for all of them — there is nothing version-specific
to ship.

Each release is built against the oldest target its loader supports, so a jar can
only reference APIs present across its whole range. For NeoForge that also pins
the output to Java 21 bytecode — the Java 25 runtime used by Minecraft 26.x loads
that fine, the reverse would not work — and the release workflow verifies the
class-file version before publishing. The Fabric jar only spans 26.x, which is
Java 25 throughout.

Fabric support starts at Minecraft 26.1: the 1.21.x line would need
intermediary-remapped builds per version, and NeoForge already covers those
players.

Every version in this table is compiled in CI on each push, and again as a gate
before any release, so the compatibility claim is tested rather than assumed.

<!-- versions:start -->

| Minecraft | NeoForge | Fabric |
| --- | --- | --- |
| 26.3 | 26.3.0.7-beta (beta) | yes |
| 26.2 | 26.2.0.88 | yes |
| 26.1.2 | 26.1.2.109 | yes |
| 26.1.1 | 26.1.1.15-beta (beta) | yes |
| 26.1 | 26.1.0.19-beta (beta) | yes |
| 1.21.11 | 21.11.45 | — |
| 1.21.10 | 21.10.64 | — |
| 1.21.9 | 21.9.16-beta (beta) | — |
| 1.21.8 | 21.8.54 | — |
| 1.21.7 | 21.7.25-beta (beta) | — |
| 1.21.6 | 21.6.20-beta (beta) | — |
| 1.21.5 | 21.5.98 | — |
| 1.21.4 | 21.4.157 | — |
| 1.21.3 | 21.3.97 | — |
| 1.21.2 | 21.2.1-beta (beta) | — |
| 1.21.1 | 21.1.251 | — |

<!-- versions:end -->
