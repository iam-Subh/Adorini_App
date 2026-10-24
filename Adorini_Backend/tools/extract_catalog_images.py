"""Extract catalog images from the four source DOCX files.

The script reads image relationships in document order. It keeps the original
embedded bytes and writes a deterministic manifest for the media seed runner.
"""

from __future__ import annotations

import argparse
import json
from dataclasses import dataclass
from pathlib import Path, PurePosixPath
from zipfile import ZipFile

from lxml import etree


REL_NS = "http://schemas.openxmlformats.org/package/2006/relationships"
DOC_REL_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
DRAWING_NS = "http://schemas.openxmlformats.org/drawingml/2006/main"
VML_NS = "urn:schemas-microsoft-com:vml"


@dataclass(frozen=True)
class ImageTarget:
    category: str
    product_slug: str
    alt_text: str
    label: str = "primary"


BOTTOM_WEAR = [
    ImageTarget("pencil-pants", "payal-premium-pencil-pant", "Payal Premium Pencil Pant"),
    ImageTarget("palazzos", "cobalt-blue-patchwork-hem-palazzo", "Cobalt Blue Patchwork-Hem Palazzo"),
    ImageTarget("palazzos", "beige-ikat-border-palazzo", "Beige Ikat Border Palazzo"),
    ImageTarget("palazzos", "mustard-yellow-patchwork-hem-palazzo", "Mustard Yellow Patchwork-Hem Palazzo"),
    ImageTarget("palazzos", "multicolor-patchwork-harem-palazzo", "Multicolor Patchwork Harem Palazzo"),
]

LEGGING_COLOURS = [
    "bright-blue",
    "deep-maroon",
    "red",
    "white",
    "bright-aqua-blue",
    "mustard-yellow",
    "vibrant-purple",
    "true-black",
    "lavender-purple",
]

LEGGINGS = [
    ImageTarget(
        "leggings",
        "lyra-premium-churidar-legging",
        f"Lyra Premium Churidar Legging - {colour.replace('-', ' ').title()}",
        colour,
    )
    for colour in LEGGING_COLOURS
]

KURTI_CATALOG = [
    ImageTarget("one-piece", "magenta-ikat-wrap-dress", "Magenta Ikat Wrap Dress"),
    ImageTarget("one-piece", "purple-lotus-v-yoke-kurti", "Purple Lotus V-Yoke Kurti"),
    ImageTarget("one-piece", "teal-kalamkari-patch-kurti", "Teal Kalamkari-Patch Kurti"),
    ImageTarget("one-piece", "green-embroidered-collar-kurti", "Green Embroidered Collar Kurti"),
    ImageTarget("one-piece", "burnt-orange-patchwork-kurti", "Burnt Orange Patchwork Kurti"),
    ImageTarget("one-piece", "indigo-spiral-kaftan-dress", "Indigo Spiral Kaftan Dress"),
    ImageTarget("two-piece", "cerulean-kalamkari-kurti-set", "Cerulean Kalamkari Kurti Set"),
    ImageTarget("one-piece", "black-embroidered-yoke-kurta", "Black Embroidered Yoke Kurta"),
    ImageTarget("one-piece", "plum-mirror-work-kurta", "Plum Mirror-Work Kurta"),
    ImageTarget("one-piece", "lime-green-applique-kurti", "Lime Green Applique Kurti"),
    ImageTarget("one-piece", "maroon-hand-painted-panel-kurta", "Maroon Hand-Painted Panel Kurta"),
    ImageTarget("two-piece", "modern-folk-kurta-legging-set", "Modern Folk Kurta and Legging Set"),
    ImageTarget("one-piece", "red-check-pleated-kurta", "Red Check Pleated Kurta"),
    ImageTarget("one-piece", "teal-peacock-patchwork-kurti", "Teal Peacock Patchwork Kurti"),
    ImageTarget("one-piece", "ivory-gingham-floral-kurti", "Ivory Gingham Floral Kurti"),
    ImageTarget("one-piece", "teal-floral-center-panel-kurti", "Teal Floral Center-Panel Kurti"),
    ImageTarget("one-piece", "navy-batik-warrior-kaftan", "Navy Batik Warrior Kaftan"),
    ImageTarget("one-piece", "mustard-embroidered-angrakha-kurti", "Mustard Embroidered Angrakha Kurti"),
    ImageTarget("one-piece", "black-maroon-wrap-panel-kurta", "Black Maroon Wrap-Panel Kurta"),
    ImageTarget("one-piece", "green-peacock-fish-print-tunic", "Green Peacock and Fish Print Tunic"),
    ImageTarget("one-piece", "ivory-ikat-wrap-kurti", "Ivory Ikat Wrap Kurti"),
]

THREE_PIECE = [
    ImageTarget("three-piece", "ivory-ajrakh-eyelet-kurta-set", "Ivory Ajrakh Eyelet Kurta Set"),
    ImageTarget("three-piece", "magenta-bandhani-circle-print-kurta-set", "Magenta Bandhani Circle-Print Kurta Set"),
    ImageTarget("three-piece", "teal-zari-embroidered-kurta-set", "Teal Zari-Embroidered Kurta Set"),
    ImageTarget("three-piece", "lilac-floral-embroidered-kurta-set", "Lilac Floral Embroidered Kurta Set"),
    ImageTarget("three-piece", "red-bandhani-print-kurta-set", "Red Bandhani Print Kurta Set"),
    ImageTarget("three-piece", "blue-ikat-chevron-suit-set", "Blue Ikat & Chevron Suit Set"),
    ImageTarget("three-piece", "mauve-bandhani-print-suit-set", "Mauve Bandhani-Print Suit Set"),
    ImageTarget("three-piece", "dusty-rose-embroidered-kaftan-sleeve-kurta-set", "Dusty Rose Embroidered Kaftan-Sleeve Kurta Set"),
    ImageTarget("three-piece", "zoya-royal-blue-embroidered-suit-set", "Zoya Royal Blue Embroidered Suit Set"),
    ImageTarget("three-piece", "red-ajrakh-medallion-yoke-suit-set", "Red Ajrakh Medallion Yoke Suit Set"),
    ImageTarget("three-piece", "sage-green-bird-floral-print-suit-set", "Sage Green Bird & Floral Print Suit Set"),
]

SOURCES = [
    ("Palazzo and Straight and pencil pant.docx", BOTTOM_WEAR),
    ("Leggings(Only Free size).docx", LEGGINGS),
    ("kurti(same as One peice)_catalog.docx", KURTI_CATALOG),
    ("THREE_PIECE_SETS_ALL.docx", THREE_PIECE),
]


def image_paths_in_document_order(archive: ZipFile) -> list[str]:
    document = etree.fromstring(archive.read("word/document.xml"))
    relationships = etree.fromstring(archive.read("word/_rels/document.xml.rels"))
    targets = {
        rel.get("Id"): rel.get("Target")
        for rel in relationships.findall(f"{{{REL_NS}}}Relationship")
    }
    ids = document.xpath(
        ".//a:blip/@r:embed | .//v:imagedata/@r:id",
        namespaces={"a": DRAWING_NS, "r": DOC_REL_NS, "v": VML_NS},
    )
    paths: list[str] = []
    for relationship_id in ids:
        target = targets.get(relationship_id)
        if not target:
            raise ValueError(f"Missing image relationship {relationship_id}")
        paths.append(str(PurePosixPath("word") / PurePosixPath(target)))
    return paths


def extract_source(docx: Path, mappings: list[ImageTarget], output: Path) -> list[dict[str, object]]:
    with ZipFile(docx) as archive:
        image_paths = image_paths_in_document_order(archive)
        if len(image_paths) != len(mappings):
            raise ValueError(
                f"{docx.name}: expected {len(mappings)} linked images, found {len(image_paths)}"
            )

        entries: list[dict[str, object]] = []
        product_orders: dict[str, int] = {}
        for source_index, (image_path, mapping) in enumerate(zip(image_paths, mappings), start=1):
            suffix = Path(image_path).suffix.lower()
            display_order = product_orders.get(mapping.product_slug, 0)
            product_orders[mapping.product_slug] = display_order + 1
            filename = f"{display_order + 1:02d}-{mapping.label}{suffix}"
            relative = Path(mapping.category) / mapping.product_slug / filename
            destination = output / relative
            destination.parent.mkdir(parents=True, exist_ok=True)
            destination.write_bytes(archive.read(image_path))
            entries.append(
                {
                    "sourceDocument": docx.name,
                    "sourceIndex": source_index,
                    "category": mapping.category,
                    "productSlug": mapping.product_slug,
                    "file": relative.as_posix(),
                    "displayOrder": display_order,
                    "altText": mapping.alt_text,
                }
            )
        return entries


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("docx_dir", type=Path)
    parser.add_argument("output_dir", type=Path)
    args = parser.parse_args()

    args.output_dir.mkdir(parents=True, exist_ok=True)
    manifest: list[dict[str, object]] = []
    for filename, mappings in SOURCES:
        source = args.docx_dir / filename
        if not source.is_file():
            raise FileNotFoundError(source)
        manifest.extend(extract_source(source, mappings, args.output_dir))

    manifest_path = args.output_dir / "manifest.json"
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(f"Extracted {len(manifest)} images to {args.output_dir}")
    print(f"Manifest: {manifest_path}")


if __name__ == "__main__":
    main()
