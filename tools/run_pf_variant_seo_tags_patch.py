from pathlib import Path

script_path = Path(__file__).with_name('patch_pf_variant_seo_tags.py')
source = script_path.read_text(encoding='utf-8')

# Correct the guarded presentation replacement literal without weakening the
# source assertions in the original patch script.
source = source.replace("|| '', '''", "|| '',\\n'''")

# App currently has two legacy Orbit mounts using the same first-four source.
# Both should consume the same governed surface selector, so this one guarded
# replacement is allowed to update all matching mounts.
source = source.replace(
    '''    count = text.count(old)\n    if count != 1:\n        raise RuntimeError(f"{label}: expected exactly one match in {path}, found {count}")\n    p.write_text(text.replace(old, new, 1), encoding="utf-8")\n''',
    '''    count = text.count(old)\n    multi_match = label == "legacy orbit governed selection"\n    if (multi_match and count < 1) or (not multi_match and count != 1):\n        expected = "one or more" if multi_match else "exactly one"\n        raise RuntimeError(f"{label}: expected {expected} match in {path}, found {count}")\n    p.write_text(text.replace(old, new, count if multi_match else 1), encoding="utf-8")\n'''
)

exec(compile(source, str(script_path), 'exec'), {'__file__': str(script_path), '__name__': '__main__'})
