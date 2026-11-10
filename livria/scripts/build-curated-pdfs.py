"""Reproduce the three researched public-domain texts. PDFs belong in Storage, not Git.

Requires reportlab, beautifulsoup4, pypdf. Retains the source's full Gutenberg
notice and license; does not use modern translations or third-party covers.
"""
import hashlib
import html
import json
from pathlib import Path
import re
import sys
import urllib.request
from bs4 import BeautifulSoup, NavigableString, Tag
from pypdf import PdfReader
from reportlab.lib import colors
from reportlab.lib.enums import TA_JUSTIFY
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak

BOOKS = [
    dict(key="dissolucao", gutenberg=24701, title="A dissolução do regimen capitalista", author="Teixeira Bastos", death_year=1902, year=1897,
         synopsis="Ensaio histórico sobre concentração do capital, condições de trabalho e transformações do capitalismo industrial. Texto original em português, com a ortografia histórica preservada."),
    dict(key="primeiro-maio", gutenberg=32379, title="O Primeiro de Maio", author="Sebastião de Magalhães Lima", death_year=1928, year=1894,
         synopsis="Reflexão sobre o movimento operário, a jornada de oito horas e o significado do Primeiro de Maio no debate socialista europeu. Texto histórico em português."),
    dict(key="credito-agricola", gutenberg=24412, title="O crédito agrícola em Portugal", author="Jaime de Magalhães Lima", death_year=1936, year=1899,
         synopsis="Conferência sobre crédito, capital e financiamento da agricultura em Portugal, incluindo instituições de poupança, organização econômica e acesso dos produtores a recursos. Ortografia histórica preservada."),
]

def main():
    output = Path(sys.argv[1]).resolve()
    output.mkdir(parents=True, exist_ok=True)
    font_dir = Path("/usr/share/fonts/truetype/dejavu")
    pdfmetrics.registerFont(TTFont("LivriaSerif", str(font_dir / "DejaVuSerif.ttf")))
    pdfmetrics.registerFont(TTFont("LivriaBold", str(font_dir / "DejaVuSerif-Bold.ttf")))
    body = ParagraphStyle("body", fontName="LivriaSerif", fontSize=11, leading=17, spaceAfter=9, alignment=TA_JUSTIFY, splitLongWords=True)
    title = ParagraphStyle("title", parent=body, fontName="LivriaBold", fontSize=25, leading=32, textColor=colors.HexColor("#153f35"), spaceAfter=20, alignment=0)
    heading = ParagraphStyle("heading", parent=body, fontName="LivriaBold", fontSize=15, leading=21, spaceBefore=15, spaceAfter=12, alignment=0, keepWithNext=True)
    small = ParagraphStyle("small", parent=body, fontSize=9, leading=13, alignment=0)
    result = []
    for book in BOOKS:
        source = f"https://www.gutenberg.org/cache/epub/{book['gutenberg']}/pg{book['gutenberg']}-images.html"
        raw = urllib.request.urlopen(source, timeout=40).read()
        (output / f"{book['key']}-source.html").write_bytes(raw)
        soup = BeautifulSoup(raw, "html.parser")
        for tag in soup.select("script,style,nav"):
            tag.decompose()
        # Visit every leaf text block once, including Gutenberg license and notes.
        blocks = []
        block_tags = {"h1", "h2", "h3", "h4", "h5", "h6", "p", "pre", "li", "table"}
        def visit(node):
            if isinstance(node, NavigableString):
                text = str(node).strip()
                if text: blocks.append(("p", text))
            elif isinstance(node, Tag):
                if node.name in block_tags:
                    text = re.sub(r"\s+", " ", node.get_text(" ", strip=True))
                    if text: blocks.append((node.name, text))
                else:
                    for child in node.children: visit(child)
        visit(soup.body)
        notice = "This eBook is for the use of anyone anywhere in the United States and most other parts of the world at no cost and with almost no restrictions whatsoever. You may copy it, give it away or re-use it under the terms of the Project Gutenberg License included with this eBook or online at www.gutenberg.org. If you are not located in the United States, you will have to check the laws of the country where you are located before using this eBook."
        story = [Spacer(1, 45), Paragraph(html.escape(book["title"]), title), Paragraph(html.escape(book["author"]), heading),
                 Paragraph("LIVRIA - Acervo de economia e sociedade", small), Spacer(1, 24),
                 Paragraph(f"Obra de {book['year']}. Texto original em português; ortografia histórica. Autor falecido em {book['death_year']}. Domínio público no Brasil pelo prazo do art. 41 da Lei 9.610/1998. Não é tradução moderna nem fac-símile.", body),
                 Paragraph("Composição digital produzida para leitura na LIVRIA a partir da transcrição indicada. As páginas desta composição diferem da edição impressa.", body),
                 Paragraph(f'Fonte e formato original: <link href="{source}" color="#153f35">{source}</link>', small),
                 Paragraph(f'Catálogo: <link href="https://www.gutenberg.org/ebooks/{book["gutenberg"]}">https://www.gutenberg.org/ebooks/{book["gutenberg"]}</link>', small),
                 Paragraph(notice, small),
                 Paragraph('<link href="https://www.gutenberg.org/policy/license.html">Licença completa incluída ao final da transcrição.</link>', small), PageBreak()]
        for tag, text in blocks:
            # Preserve the complete source text; only reflow whitespace for the PDF.
            safe = html.escape(text)
            style = heading if tag.startswith("h") else body
            # Large preformatted legal blocks may exceed a page; Paragraph splits safely.
            story.append(Paragraph(safe, style))
        path = output / f"{book['key']}.pdf"
        def footer(canvas, document):
            canvas.saveState()
            canvas.setFont("LivriaSerif", 8)
            canvas.setFillColor(colors.HexColor("#65716a"))
            canvas.drawString(48, 27, "LIVRIA | Texto histórico em domínio público")
            canvas.drawRightString(547, 27, str(document.page))
            canvas.restoreState()
        SimpleDocTemplate(str(path), pagesize=(595.28, 841.89), leftMargin=48, rightMargin=48, topMargin=48, bottomMargin=48,
                          title=book["title"], author=book["author"], subject="Texto histórico em português; curadoria LIVRIA").build(story, onFirstPage=footer, onLaterPages=footer)
        reader = PdfReader(path)
        extracted = " ".join(re.sub(r"LIVRIA \| Texto histórico em domínio público\s*\n\d+\s*\n", "", page.extract_text() or "") for page in reader.pages)
        assert "FULL PROJECT GUTENBERG LICENSE" in extracted.upper(), "Full source license missing"
        assert len(extracted) > 10000
        # Verify all source blocks survived PDF extraction (ignoring whitespace).
        compact = re.sub(r"\s+", "", extracted)
        missing = [text[:70] for _, text in blocks if re.sub(r"\s+", "", text) not in compact]
        assert not missing, f"Missing source blocks: {missing[:5]}"
        book.update(source_url=source, catalog_url=f"https://www.gutenberg.org/ebooks/{book['gutenberg']}",
                    source_sha256=hashlib.sha256(raw).hexdigest(), pdf_sha256=hashlib.sha256(path.read_bytes()).hexdigest(),
                    pages=len(reader.pages), bytes=path.stat().st_size, filename=path.name,
                    source_blocks=len(blocks), source_blocks_verified=len(blocks),
                    brazil_public_domain_since=f"{book['death_year'] + 71}-01-01",
                    license_details=f"Domínio público no Brasil: autor falecido em {book['death_year']}, prazo do art. 41 da Lei 9.610/1998 encerrado. Obra original em português ({book['year']}), sem tradução moderna. Transcrição: https://www.gutenberg.org/ebooks/{book['gutenberg']}. Ortografia histórica e créditos preservados; composição PDF LIVRIA, não fac-símile. Licença de distribuição da transcrição incluída integralmente no PDF: https://www.gutenberg.org/policy/license.html.")
        result.append(book)
        print(f"{path.name}: {len(reader.pages)} pages; {len(blocks)} source blocks verified")
    (output / "manifest.json").write_text(json.dumps(result, ensure_ascii=False, indent=2))

if __name__ == "__main__": main()
