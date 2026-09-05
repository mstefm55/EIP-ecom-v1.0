from pathlib import Path

script_path = Path(__file__).with_name('patch_pf_variant_seo_tags.py')
source = script_path.read_text(encoding='utf-8')

# Correct the guarded presentation replacement literal without weakening the
# source assertions in the original patch script.
source = source.replace("|| '', '''", "|| '',\\n'''")

exec(compile(source, str(script_path), 'exec'), {'__file__': str(script_path), '__name__': '__main__'})
