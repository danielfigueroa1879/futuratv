#!/bin/bash
# Compila dist/FuturaTV.apk (Android TV / Google TV / Fire TV) sin Android Studio.
# Requiere las herramientas en $TOOLS (ver LEEME.md):  JDK 17 + Android build-tools 34 + platform 34.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
TOOLS="${TOOLS:-$HOME/.local/mitv-android}"
export JAVA_HOME="${JAVA_HOME_MITV:-$TOOLS/jdk/Contents/Home}"
export PATH="$JAVA_HOME/bin:$PATH"
BT="$TOOLS/sdk/build-tools/34.0.0"
ANDROID_JAR="$TOOLS/sdk/platforms/android-34/android.jar"
VERSION_NAME=$(python3 -c "import json;print(json.load(open('$ROOT/app/appinfo.json'))['version'])")
VERSION_CODE=$(echo "$VERSION_NAME" | awk -F. '{print $1*10000+$2*100+$3}')
OUT="$ROOT/build/android"
KEYSTORE="$ROOT/android/mitv.keystore"   # guarda este archivo: se necesita para publicar actualizaciones
KS_PASS="mitv-local"

for f in "$JAVA_HOME/bin/javac" "$BT/aapt2" "$BT/d8" "$BT/zipalign" "$BT/apksigner" "$ANDROID_JAR"; do
  [ -e "$f" ] || { echo "Falta: $f  (instala las herramientas, ver LEEME.md)"; exit 1; }
done

rm -rf "$OUT" && mkdir -p "$OUT/assets" "$OUT/gen" "$OUT/classes" "$OUT/dex" "$ROOT/dist"

# 1) Interfaz web -> assets
python3 "$ROOT/make-version.py"
rsync -a --exclude appinfo.json --exclude icon.png --exclude largeIcon.png --exclude ".*" "$ROOT/app/" "$OUT/assets/"

# 2) Recursos + manifiesto
"$BT/aapt2" compile --dir "$ROOT/android/res" -o "$OUT/res.zip"
"$BT/aapt2" link -I "$ANDROID_JAR" --manifest "$ROOT/android/AndroidManifest.xml" \
  -A "$OUT/assets" --java "$OUT/gen" -o "$OUT/base.apk" \
  --min-sdk-version 21 --target-sdk-version 34 \
  --version-code "$VERSION_CODE" --version-name "$VERSION_NAME" --replace-version "$OUT/res.zip"

# 3) Java -> dex
javac --release 11 -nowarn -encoding UTF-8 -cp "$ANDROID_JAR" -d "$OUT/classes" \
  $(find "$ROOT/android/src" "$OUT/gen" -name '*.java')
"$BT/d8" --release --min-api 21 --lib "$ANDROID_JAR" --output "$OUT/dex" $(find "$OUT/classes" -name '*.class')

# 4) Empaquetar, alinear y firmar
cp "$OUT/base.apk" "$OUT/unsigned.apk"
(cd "$OUT/dex" && zip -q "$OUT/unsigned.apk" classes.dex)
"$BT/zipalign" -f -p 4 "$OUT/unsigned.apk" "$OUT/aligned.apk"
if [ ! -f "$KEYSTORE" ]; then
  keytool -genkeypair -keystore "$KEYSTORE" -storepass "$KS_PASS" -keypass "$KS_PASS" -alias mitv \
    -keyalg RSA -keysize 2048 -validity 10000 -dname "CN=Mi TV, O=Laboratorio, C=CL" >/dev/null 2>&1
fi
"$BT/apksigner" sign --ks "$KEYSTORE" --ks-pass "pass:$KS_PASS" --ks-key-alias mitv \
  --out "$ROOT/dist/FuturaTV.apk" "$OUT/aligned.apk"
"$BT/apksigner" verify "$ROOT/dist/FuturaTV.apk"
rm -f "$ROOT/dist/FuturaTV.apk.idsig"
echo "Creado: $ROOT/dist/FuturaTV.apk ($(du -k "$ROOT/dist/FuturaTV.apk" | cut -f1) KB)"
