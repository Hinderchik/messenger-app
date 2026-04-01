```markdown
# Messenger

Full-featured messenger with voice calls and screen sharing.

## Features
- Real-time messaging
- Voice calls
- Screen sharing
- Online/offline status
- End-to-end encryption

## Build

### Android
```bash
cd android
./gradlew assembleRelease
```

Windows

```bash
cd windows
mkdir build && cd build
cmake ..
cmake --build . --config Release
```

Technologies

· Android: Kotlin + WebSocket + Supabase
· Windows: C++ + WebSocket++
· Database: Supabase (PostgreSQL + Realtime)

License

MIT

```

## 📦 GitHub Actions Сборка

После пуша на GitHub:

```bash
git add .
git commit -m "Full messenger with calls and screen share"
git push origin main
```