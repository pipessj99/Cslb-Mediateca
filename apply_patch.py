#!/usr/bin/env python3
from pathlib import Path
import json

root = Path(__file__).resolve().parent

mediateca = root / "app" / "mediateca.tsx"
text = mediateca.read_text(encoding="utf-8")
text = text.replace(
    "import {loadLibrary,saveLibrary,mediaUrl,signOut} from '../lib/supabase';",
    "import {loadLibrary,saveLibrary,mediaUrl,signOut} from '../lib/api';"
)
text = text.replace(
    "src:await mediaUrl(m.path)",
    "src:await mediaUrl(m.id)"
)
mediateca.write_text(text, encoding="utf-8")

package = root / "package.json"
pkg = json.loads(package.read_text(encoding="utf-8"))
pkg.get("dependencies", {}).pop("@supabase/supabase-js", None)
package.write_text(json.dumps(pkg, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")

env = root / ".env.example"
env.write_text(
    "NEXT_PUBLIC_API_URL=https://mycloudex2ultra.tail905e79.ts.net\n",
    encoding="utf-8"
)

old = root / "lib" / "supabase.ts"
if old.exists():
    old.unlink()

print("Parche aplicado.")
print("Ahora ejecuta: npm install && npm run typecheck && npm run build")
