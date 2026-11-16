# Tools

The two scripts that turn `README.md` and `SETUP.md` into the HTML and the PDF that sit beside
them. They are here because they were twice rebuilt from scratch after being left outside the
repository.

```
pip install markdown reportlab

python3 tools/md2html.py README.md readme.html
python3 tools/md2html.py SETUP.md  setup.html

python3 tools/md2pdf.py README.md Basket-Reporting-Manual.pdf \
        "Basket Reporting — Manual" v261116-01 icons/icon-192.png
python3 tools/md2pdf.py SETUP.md  Setup-data-repository.pdf \
        "Basket Reporting — Setup the data repository" v261116-01 icons/icon-192.png
```

`md2html.py` keeps the page's shell — the style block and the navigation line — from the HTML
file it is overwriting, so the look lives in that file and not in the script. `md2pdf.py` lays
out A4 with the Wicki mark in the top right, a contents list built from the `## n. Title`
headings, and a footer carrying the document's name, the version and the page number.
