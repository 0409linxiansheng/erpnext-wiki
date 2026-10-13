#!/usr/bin/env bash
#
# Run the Playwright e2e suite with the site language pinned to English.
#
# Why: the suite asserts English labels (getByLabel('Title'),
# getByRole('button', { name: 'Save' })). On a `zh` site those assertions fail
# systematically — the first math.spec.ts run lost 5 of 8 tests because the dialog
# said 标题 / 保存, with no product bug involved. See specs/i18n_chinese_first.md.
#
# The previous language is restored on exit, success or failure, so a crashed run
# cannot leave the site English.
#
# Usage:
#   FRAPPE_PASSWORD='…' scripts/e2e-local.sh                      # whole suite
#   FRAPPE_PASSWORD='…' scripts/e2e-local.sh e2e/tests/math.spec.ts
#
# Env:
#   FRAPPE_PASSWORD  (required) password of E2E_USER
#   SITE             site name                      (default: erp.local)
#   BASE_URL         base URL the suite hits        (default: http://erp.local)
#   E2E_USER         user the suite signs in as     (default: Administrator)
#   BENCH            bench binary                   (default: bench on PATH)
#   PW_LIBS          dir with libasound for the bundled Chromium, if the host
#                    does not ship it               (default: ~/.cache/pw-libs/...)

set -euo pipefail

# 不管从哪里调用，都在仓库根目录跑（playwright.config.ts 在那里）。
cd "$(dirname "$(readlink -f "$0")")/.."

SITE="${SITE:-erp.local}"
BASE_URL="${BASE_URL:-http://erp.local}"
E2E_USER="${E2E_USER:-Administrator}"
BENCH="${BENCH:-bench}"
PW_LIBS="${PW_LIBS:-$HOME/.cache/pw-libs/usr/lib/x86_64-linux-gnu}"

: "${FRAPPE_PASSWORD:?请先设置环境变量 FRAPPE_PASSWORD —— ${E2E_USER} 的密码}"

for bin in "$BENCH" npx; do
	command -v "$bin" >/dev/null 2>&1 || {
		echo "找不到 $bin —— 用 BENCH=/path/to/bench 指定，或先激活环境" >&2
		exit 1
	}
done

lang_of() {
	"$BENCH" --site "$SITE" execute frappe.db.get_value \
		--kwargs "{\"doctype\":\"User\",\"filters\":\"$E2E_USER\",\"fieldname\":\"language\"}" 2>/dev/null |
		tail -1
}

set_lang() {
	"$BENCH" --site "$SITE" execute frappe.db.set_value \
		--kwargs "{\"dt\":\"User\",\"dn\":\"$E2E_USER\",\"field\":\"language\",\"val\":\"$1\"}" >/dev/null
	"$BENCH" --site "$SITE" clear-cache >/dev/null
}

ORIGINAL_LANG="$(lang_of)"
echo "==> $E2E_USER 的语言: ${ORIGINAL_LANG:-<未设置>} -> en"

restore() {
	echo "==> 恢复语言: ${ORIGINAL_LANG:-<未设置>}"
	set_lang "${ORIGINAL_LANG:-zh}"
}
trap restore EXIT

set_lang en

# The bundled Chromium needs libasound.so.2, which this host does not install
# system-wide; the extracted copy lives in PW_LIBS.
if [ -d "$PW_LIBS" ]; then
	export LD_LIBRARY_PATH="$PW_LIBS${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
fi

export BASE_URL FRAPPE_USER="$E2E_USER" FRAPPE_PASSWORD

# 用仓库自带的 playwright。npx 会跑去用 ~/.npm/_npx 里缓存的另一份版本，
# 那份解析不到本仓库的 @playwright/test，加载 playwright.config.ts 就炸。
if [ -x node_modules/.bin/playwright ]; then
	PLAYWRIGHT=(node_modules/.bin/playwright)
else
	PLAYWRIGHT=(npx playwright)
fi

echo "==> BASE_URL=$BASE_URL  规格: ${*:-<全部>}"
"${PLAYWRIGHT[@]}" test "$@"
