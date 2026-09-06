from pathlib import Path

path = Path('services/api/src/routes/public_perfect_fit_admin.js')
text = path.read_text(encoding='utf-8')
old = "          perfect_fit: row.perfect_fit && typeof row.perfect_fit === 'object' ? row.perfect_fit : null,\n"
new = "          perfect_fit: row.perfect_fit && typeof row.perfect_fit === 'object'\n            ? {\n                variant_id: row.perfect_fit.variant_id || null,\n                variant_code: row.perfect_fit.variant_code || null,\n                style_id: row.perfect_fit.style_id || null,\n                style_code: row.perfect_fit.style_code || null\n              }\n            : null,\n"
count = text.count(old)
if count != 1:
    raise SystemExit(f'Expected one Perfect Fit identity response match, found {count}')
path.write_text(text.replace(old, new, 1), encoding='utf-8')
print('Sanitized PF admin curation identity response')
