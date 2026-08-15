# Google Play Games setup

1. In Play Console, enable Play Games Services v2 for package `com.amongdemons.app`.
2. Add an Android credential for that package and each signing-certificate SHA-1 used for testing or release.
3. Add a **Game server** credential backed by an OAuth Web application. Use its client ID in both the Android wrapper and `PLAY_GAMES_SERVER_CLIENT_ID`; keep its secret server-side only.
4. Upload `among-demons-achievements.zip` from this folder under Play Games Services > Achievements > Import achievements, then save the achievements as drafts.
5. Copy every generated achievement ID into `achievement-id-map.template.json`, preserving the local keys, and replace `public/api/data/play-games-achievement-ids.json` with the completed file.
6. Publish the Play Games Services configuration and add tester Google accounts before installing the test APK.

Server environment:

```text
PLAY_GAMES_SERVER_CLIENT_ID=<game-server-web-client-id>
PLAY_GAMES_SERVER_CLIENT_SECRET=<game-server-web-client-secret>
PLAY_GAMES_TOKEN_ENCRYPTION_KEY=<32 random bytes encoded as base64 or 64 hex characters>
```

The encryption key protects refresh tokens at rest. If it is omitted, Android login and launch-time reconciliation still work, but achievements earned later from a normal browser cannot be pushed immediately to Play Games; they catch up at the next Android launch.
