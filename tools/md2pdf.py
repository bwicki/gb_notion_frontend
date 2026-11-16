# -*- coding: utf-8 -*-
"""Print one of the project's Markdown manuals as an A4 PDF.

    python3 md2pdf.py README.md Basket-Reporting-Manual.pdf "Basket Reporting — Manual" v261116-01

The layout follows the manual as it has been printed since the first version: the Wicki mark in
the top right of every page, the title and the lead paragraphs, a numbered contents list built
from the `## n. Title` headings, then the body, with a footer carrying the document's name, the
version and the page number.
"""
import io, os, re, sys
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import (BaseDocTemplate, Frame, PageTemplate, Paragraph,
                                Spacer, Table, TableStyle, KeepTogether, HRFlowable)

src, dst = sys.argv[1], sys.argv[2]
title = sys.argv[3] if len(sys.argv) > 3 else 'Manual'
version = sys.argv[4] if len(sys.argv) > 4 else ''
logo = sys.argv[5] if len(sys.argv) > 5 else 'icons/icon-192.png'

INK   = colors.HexColor('#22262A')
MUTED = colors.HexColor('#6D757B')
HEAD  = colors.HexColor('#1F4E79')
LINE  = colors.HexColor('#C9D0D5')
SOFT  = colors.HexColor('#F2F4F5')

def st(name, **kw):
    kw.setdefault('fontName', 'Helvetica')
    kw.setdefault('textColor', INK)
    kw.setdefault('alignment', TA_LEFT)
    return ParagraphStyle(name, **kw)

S = {
 'h1':   st('h1', fontName='Helvetica-Bold', fontSize=17, leading=21, spaceAfter=10, textColor=INK),
 'h2':   st('h2', fontName='Helvetica-Bold', fontSize=12.5, leading=16, spaceBefore=16, spaceAfter=6, textColor=HEAD),
 'h3':   st('h3', fontName='Helvetica-Bold', fontSize=10, leading=14, spaceBefore=10, spaceAfter=4),
 'p':    st('p',  fontSize=9, leading=13.2, spaceAfter=7),
 'li':   st('li', fontSize=9, leading=13.2, spaceAfter=2, leftIndent=14, firstLineIndent=-10),
 'toc':  st('toc', fontSize=9, leading=14, leftIndent=16, firstLineIndent=-16),
 'tocH': st('tocH', fontName='Helvetica-Bold', fontSize=12.5, leading=16, spaceBefore=14, spaceAfter=8, textColor=HEAD),
 'cell': st('cell', fontSize=8.2, leading=11),
 'cellH':st('cellH', fontName='Helvetica-Bold', fontSize=8.2, leading=11),
 'code': st('code', fontName='Courier', fontSize=8.2, leading=11.4, spaceAfter=7,
            leftIndent=8, backColor=SOFT, borderPadding=4),
 'foot': st('foot', fontSize=7.5, leading=10, textColor=MUTED),
}

# ── inline markdown ──────────────────────────────────────────────────────────
def inline(s):
    out = escape(s)
    out = re.sub(r'`([^`]+)`', lambda m: '<font face="Courier" size="8.2">%s</font>' % m.group(1), out)
    out = re.sub(r'\*\*([^*]+)\*\*', r'<b>\1</b>', out)
    out = re.sub(r'(?<![\w*])\*([^*\n]+)\*(?![\w*])', r'<i>\1</i>', out)
    # a link into the document itself has no target in a PDF built this way: keep the words
    out = re.sub(r'\[([^\]]+)\]\(#[^)]*\)', r'\1', out)
    out = re.sub(r'\[([^\]]+)\]\(([^)]+)\)', r'<link href="\2" color="#1F4E79">\1</link>', out)
    return out

def cells(row):
    row = row.strip()
    if row.startswith('|'): row = row[1:]
    if row.endswith('|'):   row = row[:-1]
    return [c.strip() for c in row.split('|')]

# ── the document ─────────────────────────────────────────────────────────────
text = io.open(src, encoding='utf-8').read()
lines = text.split('\n')

toc = [(m.group(1), m.group(2)) for m in
       (re.match(r'^## (\d+[a-z]?)\.\s+(.*)$', l) for l in lines) if m]

flow, i, n = [], 0, len(lines)
first_h2_seen = False
while i < n:
    l = lines[i]
    if not l.strip():
        i += 1; continue

    if l.startswith('```'):
        buf = []; i += 1
        while i < n and not lines[i].startswith('```'):
            buf.append(lines[i]); i += 1
        i += 1
        flow.append(Paragraph('<br/>'.join(escape(b).replace(' ', '&nbsp;') for b in buf), S['code']))
        continue

    if l.startswith('|') and i + 1 < n and re.match(r'^\|[\s:|-]+\|?\s*$', lines[i + 1]):
        head = cells(l); i += 2
        rows = []
        while i < n and lines[i].startswith('|'):
            rows.append(cells(lines[i])); i += 1
        w = (A4[0] - 40 * mm) / max(1, len(head))
        data = [[Paragraph(inline(c), S['cellH']) for c in head]] + \
               [[Paragraph(inline(c), S['cell']) for c in r] for r in rows]
        t = Table(data, colWidths=[w] * len(head), repeatRows=1)
        t.setStyle(TableStyle([
            ('GRID', (0, 0), (-1, -1), 0.4, LINE),
            ('BACKGROUND', (0, 0), (-1, 0), SOFT),
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('LEFTPADDING', (0, 0), (-1, -1), 5),
            ('RIGHTPADDING', (0, 0), (-1, -1), 5),
            ('TOPPADDING', (0, 0), (-1, -1), 3),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 3)]))
        flow += [t, Spacer(1, 8)]
        continue

    m = re.match(r'^(#{1,4})\s+(.*)$', l)
    if m:
        lvl, txt = len(m.group(1)), m.group(2)
        if lvl == 1:
            flow.append(Paragraph(inline(txt), S['h1']))
        elif lvl == 2:
            if not first_h2_seen:
                first_h2_seen = True
                flow += [Spacer(1, 6), HRFlowable(width='100%', thickness=0.6, color=LINE),
                         Spacer(1, 10), Paragraph('Contents', S['tocH'])]
                for num, tt in toc:
                    flow.append(Paragraph('%s.&nbsp;&nbsp;%s' % (num, escape(tt)), S['toc']))
                flow.append(Spacer(1, 12))
            flow.append(Paragraph(inline(txt), S['h2']))
        else:
            flow.append(Paragraph(inline(txt), S['h3']))
        i += 1; continue

    if l.strip() == '---':
        flow += [Spacer(1, 4), HRFlowable(width='100%', thickness=0.6, color=LINE), Spacer(1, 6)]
        i += 1; continue

    m = re.match(r'^(\s*)([-*]|\d+\.)\s+(.*)$', l)
    if m:
        body = [m.group(3)]
        i += 1
        while i < n and lines[i].strip() and not re.match(r'^(\s*)([-*]|\d+\.)\s+', lines[i]) \
                and not lines[i].startswith(('#', '|', '```')):
            body.append(lines[i].strip()); i += 1
        bullet = '–' if m.group(2) in '-*' else m.group(2)
        flow.append(Paragraph('%s&nbsp;&nbsp;%s' % (bullet, inline(' '.join(body))), S['li']))
        continue

    para = [l.strip()]
    i += 1
    while i < n and lines[i].strip() and not lines[i].startswith(('#', '|', '```', '---')) \
            and not re.match(r'^(\s*)([-*]|\d+\.)\s+', lines[i]):
        para.append(lines[i].strip()); i += 1
    flow.append(Paragraph(inline(' '.join(para)), S['p']))

# ── page furniture ───────────────────────────────────────────────────────────
def furniture(canv, doc):
    canv.saveState()
    if os.path.exists(logo):
        try:
            canv.drawImage(logo, A4[0] - 20 * mm - 18 * mm, A4[1] - 16 * mm - 16 * mm,
                           width=18 * mm, height=16 * mm, mask='auto',
                           preserveAspectRatio=True, anchor='ne')
        except Exception:
            pass
    canv.setStrokeColor(LINE); canv.setLineWidth(0.5)
    canv.line(20 * mm, 17 * mm, A4[0] - 20 * mm, 17 * mm)
    canv.setFont('Helvetica', 7.5); canv.setFillColor(MUTED)
    left = title + ('  ·  ' + version if version else '')
    canv.drawString(20 * mm, 12.5 * mm, left)
    canv.drawRightString(A4[0] - 20 * mm, 12.5 * mm, 'Page %d' % doc.page)
    canv.restoreState()

doc = BaseDocTemplate(dst, pagesize=A4,
                      leftMargin=20 * mm, rightMargin=20 * mm,
                      topMargin=38 * mm, bottomMargin=22 * mm,
                      title=title, author='Wicki Aero GmbH')
frame = Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height, id='body')
doc.addPageTemplates([PageTemplate(id='all', frames=[frame], onPage=furniture)])
doc.build(flow)
print('wrote %s' % dst)
