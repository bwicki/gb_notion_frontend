# -*- coding: utf-8 -*-
"""Rebuild one of the project's HTML manuals from its Markdown.

The page's shell — the style block, the navigation line — is taken from the HTML that is
already there, so a regenerated manual looks exactly like the one it replaces and nothing
about the design has to be kept in this script.

    python3 md2html.py README.md readme.html
"""
import io, re, sys
import markdown

src, dst = sys.argv[1], sys.argv[2]

old = io.open(dst, encoding='utf-8').read()
cut = old.index('<body><main>') + len('<body><main>')
head = old[:cut]
nav = re.search(r'<p class="nav2">.*?</p>', old, re.S)
nav = nav.group(0) if nav else ''

body = markdown.markdown(
    io.open(src, encoding='utf-8').read(),
    extensions=['tables', 'fenced_code', 'toc', 'sane_lists'],
    output_format='xhtml')

io.open(dst, 'w', encoding='utf-8').write(head + '\n' + nav + '\n' + body + '\n</main></body></html>\n')
print('wrote %s, %d bytes' % (dst, len(body)))
