import 'reflect-metadata';
import type { DataSource } from 'typeorm';

import { AppDataSource } from '../data-source';
import { Brand, Category, Product, ProductVariant } from '../entities';
import { buildSizeChart } from './size-charts';
import { FabricType, PrintTechnique } from '../../common/enums/domain.enums';

/**
 * Reference data for local development and fresh environments.
 *
 * Every seed is an upsert keyed on a natural unique column (`slug`, `sku`), so
 * running this repeatedly converges rather than erroring or duplicating. A seed
 * that can only be run once is a seed nobody runs.
 */

/**
 * The band a category is stocked in unless it says otherwise. Applied
 * explicitly to every row below rather than left to the column default,
 * because `upsert` spreads each object into one multi-row statement — a
 * category omitting the key would contribute `undefined` to that statement
 * instead of falling through to the default.
 */
const DEFAULT_SIZE_BAND = [40, 42, 44, 46];

/**
 * Stored on every free-size variant. Meaningless by construction — see the
 * `AddFreeSizeProducts` migration for why the column cannot simply be null.
 */
const FREE_SIZE_PLACEHOLDER = 40;

/** The band a category stocks, for charts and variant generation alike. */
function bandFor(categorySlug: string): number[] {
  const category = CATEGORIES.find((c) => c.slug === categorySlug);
  if (!category) {
    throw new Error(`No category seed for "${categorySlug}"`);
  }
  return category.sizes ?? DEFAULT_SIZE_BAND;
}

interface CategorySeed {
  slug: string;
  name: string;
  displayOrder: number;
  description: string;
  /** Omit to take [DEFAULT_SIZE_BAND]. */
  sizes?: number[];
}

const CATEGORIES: CategorySeed[] = [
  // ---- Bottom wear: filed by garment, as it always was ----
  {
    slug: 'straight-pants',
    name: 'Straight Pant',
    displayOrder: 1,
    description: 'Straight-fit bottoms.',
  },
  {
    slug: 'pencil-pants',
    name: 'Pencil Pant',
    displayOrder: 2,
    description: 'Slim, tapered high-waisted pencil-fit bottoms.',
  },
  {
    slug: 'palazzos',
    name: 'Palazzo',
    displayOrder: 3,
    description: 'Wide-leg, relaxed-fit pants in prints and patchwork.',
  },
  {
    slug: 'leggings',
    name: 'Leggings',
    displayOrder: 4,
    // One category holding both banded and free-size stock; the difference is
    // `isFreeSize` on the product, not a category of its own.
    description: 'Churidar and ankle-length leggings, including free size.',
  },

  // ---- Dress garments: filed by what is in the box ----
  //
  // The craft is NOT a category. It lives on `products.printTechnique` — Ajrak,
  // Kalamkari, Batik, Patchwork, Bandhani, Ikat, Fancy — where it works as a
  // filter that combines with everything else: "Ajrak, three piece, under
  // ₹1,500" is one query. As a category it could only ever be browsed alone.
  {
    slug: 'one-piece',
    name: 'One Piece',
    displayOrder: 5,
    description: 'Single kurti, kurta, tunic, kaftan or dress.',
  },
  {
    slug: 'two-piece',
    name: 'Two Piece',
    displayOrder: 6,
    description: 'Kurta with a matching bottom.',
  },
  {
    slug: 'three-piece',
    name: 'Three Piece',
    displayOrder: 7,
    description: 'Kurta, bottom and dupatta.',
  },
];

/**
 * Empty on purpose.
 *
 * Adorini does not present garments by brand, so the storefront has no supplier
 * names to seed. The table and the relation remain (see `DropBrandFromShop`) so
 * a real supplier list can be added later without a schema change.
 */
const BRANDS: { slug: string; name: string; displayOrder: number }[] = [];

interface ProductSeed {
  slug: string;
  name: string;
  categorySlug: string;
  fabricType: FabricType;
  printTechnique: PrintTechnique;
  /** PLACEHOLDER - see the note on PRODUCTS. */
  pricePaise: number;
  compareAtPricePaise: number | null;
  garmentLengthCm: number;
  colours: string[];
  description: string;
  /** One size, one variant per colour. Omit for banded stock. */
  isFreeSize?: boolean;
  /** 1, 2 or 3 garments in the box. Omit for bottom wear. */
  pieces?: number;
}

/**
 * The catalogue, transcribed from the four supplier PDFs.
 *
 * ### Filed by what is in the box
 *
 * `categorySlug` is the piece configuration — One Piece, Two Piece, Three Piece
 * — and the craft rides along on `printTechnique`, where it filters rather than
 * files. The comment banners below group products by craft for reading; the
 * grouping has no effect on the data.
 *
 * `pieces` is kept alongside the category on purpose. It is the same fact in a
 * form code can compare and sort without string-matching a category slug, and
 * it is what the piece categories are derived from in the migration.
 *
 * ### Two fields are still invented
 *
 * **`pricePaise`** — placeholders at the owner's instruction, real prices to
 * follow. The single exception is `blue-ikat-chevron-suit-set`, whose PDF shows
 * a price tag reading Rs. 845 — the only real number in any of the four
 * documents. Grep this file before going live.
 *
 * The source PDFs do not identify a supplier for each garment. The seed keeps
 * `brandId` null instead of assigning an unsupported supplier name.
 */
const PRODUCTS: ProductSeed[] = [
  // ==== Bottom wear (6) — by garment, no piece count ====

  {
    slug: 'payal-premium-pencil-pant',
    name: 'Payal Premium Pencil Pant',
    categorySlug: 'pencil-pants',
    fabricType: FabricType.RIGID,
    printTechnique: PrintTechnique.FANCY,
    pricePaise: 79900,
    compareAtPricePaise: 99900,
    garmentLengthCm: 95,
    colours: ['Mustard Yellow', 'Deep Red', 'Classic Black', 'Crisp White'],
    description:
      'Tailored high-waisted pencil pant in a structured cotton-blend twill, cut slim and tapered to an ankle-length leg. Office-ready silhouette with a clean fitted waistband.',
  },
  {
    slug: 'cobalt-blue-patchwork-hem-palazzo',
    name: 'Cobalt Blue Patchwork-Hem Palazzo',
    categorySlug: 'palazzos',
    fabricType: FabricType.RIGID,
    printTechnique: PrintTechnique.PATCHWORK,
    pricePaise: 69900,
    compareAtPricePaise: null,
    garmentLengthCm: 100,
    colours: ['Cobalt Blue'],
    description:
      'Wide-leg cotton palazzo with an elasticated drawstring waist, finished at the hem with a multicolour Kantha-style patchwork border edged in red triangle trim.',
  },
  {
    slug: 'beige-ikat-border-palazzo',
    name: 'Beige Ikat Border Palazzo',
    categorySlug: 'palazzos',
    fabricType: FabricType.RIGID,
    printTechnique: PrintTechnique.IKAT,
    pricePaise: 69900,
    compareAtPricePaise: null,
    garmentLengthCm: 100,
    colours: ['Beige'],
    description:
      'Beige cotton palazzo in a fine textured weave with a bold navy hand-block border in a geometric diamond and floral motif. Elasticated drawstring waist, relaxed wide-leg fit.',
  },
  {
    slug: 'mustard-yellow-patchwork-hem-palazzo',
    name: 'Mustard Yellow Patchwork-Hem Palazzo',
    categorySlug: 'palazzos',
    fabricType: FabricType.RIGID,
    printTechnique: PrintTechnique.PATCHWORK,
    pricePaise: 69900,
    compareAtPricePaise: null,
    garmentLengthCm: 100,
    colours: ['Mustard Yellow'],
    description:
      'Mustard yellow cotton palazzo with a checkerboard patchwork hem border in maroon, cream and print squares, finished with a black triangle trim.',
  },
  {
    slug: 'multicolor-patchwork-harem-palazzo',
    name: 'Multicolor Patchwork Harem Palazzo',
    categorySlug: 'palazzos',
    fabricType: FabricType.RIGID,
    printTechnique: PrintTechnique.PATCHWORK,
    pricePaise: 74900,
    compareAtPricePaise: 94900,
    garmentLengthCm: 100,
    colours: ['Multicolour'],
    description:
      'Harem-style palazzo pieced from mixed vintage-style prints — ikat, floral, polka dot and animal print in purple, teal, mustard and rust. Gathered balloon leg tapering at the ankle.',
  },
  {
    slug: 'lyra-premium-churidar-legging',
    name: 'Lyra Premium Churidar Legging',
    categorySlug: 'leggings',
    fabricType: FabricType.STRETCH,
    printTechnique: PrintTechnique.FANCY,
    pricePaise: 39900,
    compareAtPricePaise: 49900,
    garmentLengthCm: 95,
    isFreeSize: true,
    colours: [
      'Bright Blue',
      'Deep Maroon',
      'Red',
      'White',
      'Bright Aqua Blue',
      'Mustard Yellow',
      'Vibrant Purple',
      'True Black',
      'Lavender Purple',
    ],
    description:
      'Churidar-style legging in a 4-way stretch cotton blend, fitted through the leg and gathered at the ankle. Soft, breathable and fade-resistant. Free size fits a standard adult range.',
  },

  // ==== Ajrak (2) — printTechnique.AJRAK ====

  {
    slug: 'ivory-ajrakh-eyelet-kurta-set',
    name: 'Ivory Ajrakh Eyelet Kurta Set',
    categorySlug: 'three-piece',
    fabricType: FabricType.RIGID,
    printTechnique: PrintTechnique.AJRAK,
    pricePaise: 169900,
    compareAtPricePaise: 199900,
    garmentLengthCm: 120,
    pieces: 3,
    colours: ['Ivory'],
    description:
      'Ivory cotton kurta in an all-over eyelet weave with a hand-block Ajrakh yoke in maroon and black, set with mirror inlays. Comes with matching Ajrakh-print pants and a mirrored-border dupatta.',
  },
  {
    slug: 'red-ajrakh-medallion-yoke-suit-set',
    name: 'Red Ajrakh Medallion Yoke Suit Set',
    categorySlug: 'three-piece',
    fabricType: FabricType.RIGID,
    printTechnique: PrintTechnique.AJRAK,
    pricePaise: 159900,
    compareAtPricePaise: null,
    garmentLengthCm: 120,
    pieces: 3,
    colours: ['Red'],
    description:
      'Red cotton kurta with an Ajrakh medallion-print yoke in navy and rust bordered in solid navy. Round neck with keyhole slit, matching Ajrakh dupatta and solid red pants.',
  },

  // ==== Kalam Kari (3) — printTechnique.KALANKARI ====

  {
    slug: 'teal-kalamkari-patch-kurti',
    name: 'Teal Kalamkari-Patch Kurti',
    categorySlug: 'one-piece',
    fabricType: FabricType.RIGID,
    printTechnique: PrintTechnique.KALANKARI,
    pricePaise: 109900,
    compareAtPricePaise: 139900,
    garmentLengthCm: 120,
    pieces: 1,
    colours: ['Teal Blue'],
    description:
      'Long teal kurti with four square Kalamkari-print patches running down the front from chest to hem, each in mustard, maroon and cream. V-neck with narrow maroon trim, side slit to the knee.',
  },
  {
    slug: 'cerulean-kalamkari-kurti-set',
    name: 'Cerulean Kalamkari Kurti Set',
    categorySlug: 'two-piece',
    fabricType: FabricType.RIGID,
    printTechnique: PrintTechnique.KALANKARI,
    pricePaise: 159900,
    compareAtPricePaise: 199900,
    garmentLengthCm: 95,
    pieces: 2,
    colours: ['Cerulean Blue'],
    description:
      'Solid cerulean kurti with a hand-painted Kalamkari yoke in maroon, mustard and blue, lined with white cowrie shells. Two patch pockets repeat the print. Includes matching straight-cut pants.',
  },
  {
    slug: 'maroon-hand-painted-panel-kurta',
    name: 'Maroon Hand-Painted Panel Kurta',
    categorySlug: 'one-piece',
    fabricType: FabricType.RIGID,
    printTechnique: PrintTechnique.KALANKARI,
    pricePaise: 119900,
    compareAtPricePaise: 149900,
    garmentLengthCm: 110,
    pieces: 1,
    colours: ['Maroon'],
    description:
      'Straight-cut maroon kurta with a hand-painted white centre panel showing a woman in traditional dress framed by red flowers. White cuffs and pintuck pleats at the yoke.',
  },

  // ==== Batik (3) — printTechnique.BATIK ====

  {
    slug: 'indigo-spiral-kaftan-dress',
    name: 'Indigo Spiral Kaftan Dress',
    categorySlug: 'one-piece',
    fabricType: FabricType.RIGID,
    printTechnique: PrintTechnique.BATIK,
    pricePaise: 124900,
    compareAtPricePaise: null,
    garmentLengthCm: 110,
    pieces: 1,
    colours: ['Indigo Blue'],
    description:
      'Loose-fit kaftan dress with indigo and white checkerboard panels in spiral and circle motifs, framed by hand-painted floral batik side panels. Drawstring ties with tassels at each side seam.',
  },
  {
    slug: 'navy-batik-warrior-kaftan',
    name: 'Navy Batik Warrior Kaftan',
    categorySlug: 'one-piece',
    fabricType: FabricType.RIGID,
    printTechnique: PrintTechnique.BATIK,
    pricePaise: 114900,
    compareAtPricePaise: null,
    garmentLengthCm: 110,
    pieces: 1,
    colours: ['Navy Blue'],
    description:
      'Loose-fit navy kaftan with a hand-painted warrior figure in red, mustard and white at the centre panels. Sleeves and sides carry a wax-resist crackle-line batik print.',
  },
  {
    slug: 'modern-folk-kurta-legging-set',
    name: 'Modern Folk Kurta and Legging Set',
    categorySlug: 'two-piece',
    fabricType: FabricType.RIGID,
    printTechnique: PrintTechnique.BATIK,
    pricePaise: 139900,
    compareAtPricePaise: 174900,
    garmentLengthCm: 95,
    pieces: 2,
    colours: ['Red'],
    description:
      'Red kurta with a batik-print folk dancer motif in red, mustard and black, and contrasting orange sleeves and back panel. Includes matching mustard leggings. Hand wash the pieces separately.',
  },

  // ==== From the original Kurti PDF (7) ====
  //
  // These live only in `KURTI_beautified_v5.pdf`. The later
  // `kurti(same as One peice)` catalogue is not a replacement for it — each
  // file carries items the other does not — so both are transcribed.
  {
    slug: 'maroon-kalamkari-panel-straight-kurti',
    name: 'Maroon Kalamkari Panel Straight Kurti',
    categorySlug: 'one-piece',
    fabricType: FabricType.RIGID,
    printTechnique: PrintTechnique.KALANKARI,
    pricePaise: 119900,
    compareAtPricePaise: 149900,
    garmentLengthCm: 110,
    pieces: 1,
    colours: ['Maroon'],
    description:
      'Rich maroon straight kurta with a hand-crafted Kalamkari-style patch panel down the front, its mustard-and-brown medallion print framed by zigzag borders. Round neck, three-quarter sleeves with contrast cuffs, calf-length straight fit.',
  },
  {
    slug: 'mustard-yellow-floral-printed-kurta',
    name: 'Mustard Yellow Floral Printed Kurta',
    categorySlug: 'one-piece',
    fabricType: FabricType.RIGID,
    printTechnique: PrintTechnique.FANCY,
    pricePaise: 89900,
    compareAtPricePaise: null,
    garmentLengthCm: 120,
    pieces: 1,
    colours: ['Mustard Yellow'],
    description:
      'All-over multicolour floral print in soft pink, mint and lavender on mustard. V-neckline and cuffs trimmed with white lace, full sleeves, flowy ankle-length straight fit with side slits.',
  },
  {
    slug: 'purple-hand-embroidered-kaftan-tunic',
    name: 'Purple Hand-Embroidered Kaftan Tunic',
    categorySlug: 'one-piece',
    fabricType: FabricType.RIGID,
    printTechnique: PrintTechnique.FANCY,
    pricePaise: 129900,
    compareAtPricePaise: 159900,
    garmentLengthCm: 95,
    pieces: 1,
    colours: ['Plum Purple'],
    description:
      'Plum-purple kaftan tunic with hand-embroidered floral motifs in gold, green and white across a diamond-trellis yoke. Rust block-print kimono sleeves and an adjustable waist drawstring shape the flowing silhouette.',
  },
  {
    slug: 'maroon-printed-cotton-kurta-palazzo-set',
    name: 'Maroon Printed Cotton Kurta and Palazzo Set',
    categorySlug: 'two-piece',
    fabricType: FabricType.RIGID,
    printTechnique: PrintTechnique.FANCY,
    pricePaise: 149900,
    compareAtPricePaise: 189900,
    garmentLengthCm: 105,
    pieces: 2,
    colours: ['Maroon'],
    description:
      'All-over white floral print on the kurta with a white wave print on the palazzo. Round neck with a tasseled front slit and lace-trimmed placket. Includes 1 kurta and 1 palazzo pant.',
  },
  {
    slug: 'sage-green-floral-kurta-pant-set',
    name: 'Sage Green Floral Printed Kurta and Pant Set',
    categorySlug: 'two-piece',
    fabricType: FabricType.RIGID,
    printTechnique: PrintTechnique.FANCY,
    pricePaise: 144900,
    compareAtPricePaise: null,
    garmentLengthCm: 95,
    pieces: 2,
    colours: ['Sage Green'],
    description:
      'All-over multicolour floral print in pink, yellow and rust. V-neckline and cuffs trimmed with white crochet lace for a soft, vintage charm. Includes 1 kurta and 1 pant.',
  },
  {
    slug: 'yellow-floral-kurta-pant-set',
    name: 'Yellow Floral Printed Kurta and Pant Set',
    categorySlug: 'two-piece',
    fabricType: FabricType.RIGID,
    printTechnique: PrintTechnique.FANCY,
    pricePaise: 144900,
    compareAtPricePaise: null,
    garmentLengthCm: 95,
    pieces: 2,
    colours: ['Yellow'],
    description:
      'All-over floral print in pink, white and green with white crochet lace at the V-neckline and cuffs. The same design as the sage green set in an alternate colourway. Includes 1 kurta and 1 pant.',
  },
  {
    slug: 'red-handloom-cotton-kurti-pajama-set',
    name: 'Red Handloom Cotton Kurti-Pajama Set',
    categorySlug: 'two-piece',
    fabricType: FabricType.RIGID,
    printTechnique: PrintTechnique.FANCY,
    pricePaise: 134900,
    compareAtPricePaise: null,
    garmentLengthCm: 120,
    pieces: 2,
    colours: ['Red'],
    description:
      'Handloom cotton kurti with an all-over white hand-block floral and stripe print. V-neck and short-sleeve cuffs trimmed in white crochet lace. Includes 1 kurti and 1 striped pajama.',
  },

  // ==== Patchwork (5) — printTechnique.PATCHWORK ====

  {
    slug: 'burnt-orange-patchwork-kurti',
    name: 'Burnt Orange Patchwork Kurti',
    categorySlug: 'one-piece',
    fabricType: FabricType.RIGID,
    printTechnique: PrintTechnique.PATCHWORK,
    pricePaise: 94900,
    compareAtPricePaise: null,
    garmentLengthCm: 95,
    pieces: 1,
    colours: ['Burnt Orange'],
    description:
      'Handloom cotton kurti with a geometric patchwork yoke in green, red, lime and mustard, each patch edged in a triangle-print border. Rounded patch pocket with a round button.',
  },
  {
    slug: 'lime-green-applique-kurti',
    name: 'Lime Green Applique Kurti',
    categorySlug: 'one-piece',
    fabricType: FabricType.RIGID,
    printTechnique: PrintTechnique.APLIK,
    pricePaise: 101900,
    compareAtPricePaise: null,
    garmentLengthCm: 105,
    pieces: 1,
    colours: ['Lime Green'],
    description:
      'Solid lime green kurti with red embroidered Bengali text across the chest and a black-and-red appliqué of an ektara. A column of small print patches runs down the right side.',
  },
  {
    slug: 'teal-peacock-patchwork-kurti',
    name: 'Teal Peacock Patchwork Kurti',
    categorySlug: 'one-piece',
    fabricType: FabricType.RIGID,
    printTechnique: PrintTechnique.PATCHWORK,
    pricePaise: 107900,
    compareAtPricePaise: 134900,
    garmentLengthCm: 120,
    pieces: 1,
    colours: ['Teal Blue'],
    description:
      'Solid teal kurti with a diagonal patchwork panel crossing the front from shoulder to hem, in a maroon and mustard paisley print with a peacock motif and bead trim.',
  },
  {
    slug: 'black-maroon-wrap-panel-kurta',
    name: 'Black Maroon Wrap-Panel Kurta',
    categorySlug: 'one-piece',
    fabricType: FabricType.RIGID,
    printTechnique: PrintTechnique.PATCHWORK,
    pricePaise: 104900,
    compareAtPricePaise: null,
    garmentLengthCm: 120,
    pieces: 1,
    colours: ['Black'],
    description:
      'Black kurta with a small white dot print and a maroon diagonal panel across the upper front. A white block-print vine motif runs down the centre; maroon cuffs repeat the print.',
  },
  {
    slug: 'green-peacock-fish-print-tunic',
    name: 'Green Peacock and Fish Print Tunic',
    categorySlug: 'one-piece',
    fabricType: FabricType.RIGID,
    printTechnique: PrintTechnique.PATCHWORK,
    pricePaise: 97900,
    compareAtPricePaise: null,
    garmentLengthCm: 105,
    pieces: 1,
    colours: ['Green'],
    description:
      'Green tunic with a cream centre panel in a fine stripe and fish-motif print. A black circular patch at the chest is embroidered with two red and gold peacocks.',
  },

  // ==== Bandhani (3) — printTechnique.BANDHANI ====

  {
    slug: 'magenta-bandhani-circle-print-kurta-set',
    name: 'Magenta Bandhani Circle-Print Kurta Set',
    categorySlug: 'three-piece',
    fabricType: FabricType.RIGID,
    printTechnique: PrintTechnique.BANDHANI,
    pricePaise: 134900,
    compareAtPricePaise: null,
    garmentLengthCm: 120,
    pieces: 3,
    colours: ['Magenta'],
    description:
      'Magenta cotton kurta scattered with white and orange bandhani tie-dye circles framed by dotted zigzag borders. Comes with a matching bandhani dupatta and magenta churidar leggings.',
  },
  {
    slug: 'red-bandhani-print-kurta-set',
    name: 'Red Bandhani Print Kurta Set',
    categorySlug: 'three-piece',
    fabricType: FabricType.RIGID,
    printTechnique: PrintTechnique.BANDHANI,
    pricePaise: 139900,
    compareAtPricePaise: 169900,
    garmentLengthCm: 120,
    pieces: 3,
    colours: ['Red'],
    description:
      'Red and orange bandhani kurta in an all-over tie-dye medallion pattern with a gold-embroidered, mirror-set neckline. Includes a gold-bordered bandhani dupatta and red churidar pants.',
  },
  {
    slug: 'mauve-bandhani-print-suit-set',
    name: 'Mauve Bandhani-Print Suit Set',
    categorySlug: 'three-piece',
    fabricType: FabricType.RIGID,
    printTechnique: PrintTechnique.BANDHANI,
    pricePaise: 132900,
    compareAtPricePaise: null,
    garmentLengthCm: 120,
    pieces: 3,
    colours: ['Mauve'],
    description:
      'Mauve cotton kurta in an all-over white bandhani print with an asymmetric medallion yoke. Comes with a matching dupatta draped over one shoulder and solid mauve palazzo pants.',
  },

  // ==== Ikat (3) — printTechnique.IKAT ====

  {
    slug: 'magenta-ikat-wrap-dress',
    name: 'Magenta Ikat Wrap Dress',
    categorySlug: 'one-piece',
    fabricType: FabricType.RIGID,
    printTechnique: PrintTechnique.IKAT,
    pricePaise: 99900,
    compareAtPricePaise: null,
    garmentLengthCm: 95,
    pieces: 1,
    colours: ['Magenta'],
    description:
      'Sleeveless wrap dress in a magenta and pink zigzag ikat weave. White loops and disc buttons line the V-neckline, and a white tasselled cord ties the wrap closed.',
  },
  {
    slug: 'ivory-ikat-wrap-kurti',
    name: 'Ivory Ikat Wrap Kurti',
    categorySlug: 'one-piece',
    fabricType: FabricType.RIGID,
    printTechnique: PrintTechnique.IKAT,
    pricePaise: 112900,
    compareAtPricePaise: 139900,
    garmentLengthCm: 120,
    pieces: 1,
    colours: ['Ivory'],
    description:
      'Long wrap-style kurti in an ivory tone-on-tone zigzag ikat with small embroidered dots. A beige mirror-work band runs along the wrap edge, tied at the side with a tasselled cord.',
  },
  {
    slug: 'blue-ikat-chevron-suit-set',
    name: 'Blue Ikat & Chevron Suit Set',
    categorySlug: 'three-piece',
    fabricType: FabricType.RIGID,
    printTechnique: PrintTechnique.IKAT,
    pricePaise: 84500,
    compareAtPricePaise: null,
    garmentLengthCm: 120,
    pieces: 3,
    colours: ['Powder Blue'],
    description:
      'Powder blue cotton kurta in an all-over ikat damask print with a teal chevron-embroidered yoke set with small mirrors. Comes with a matching ikat dupatta and pants in solid blue borders.',
  },

  // ==== Fancy (13) — printTechnique.FANCY: zari, mirror work, embroidery ====

  {
    slug: 'purple-lotus-v-yoke-kurti',
    name: 'Purple Lotus V-Yoke Kurti',
    categorySlug: 'one-piece',
    fabricType: FabricType.RIGID,
    printTechnique: PrintTechnique.FANCY,
    pricePaise: 104900,
    compareAtPricePaise: null,
    garmentLengthCm: 120,
    pieces: 1,
    colours: ['Cream'],
    description:
      'Long kurti on a cream base with a purple vine and golden lotus print. A crimson perforated V-yoke with gold dot embroidery is trimmed in white lace, with red cuffs and hem band.',
  },
  {
    slug: 'green-embroidered-collar-kurti',
    name: 'Green Embroidered Collar Kurti',
    categorySlug: 'one-piece',
    fabricType: FabricType.RIGID,
    printTechnique: PrintTechnique.FANCY,
    pricePaise: 99900,
    compareAtPricePaise: null,
    garmentLengthCm: 105,
    pieces: 1,
    colours: ['Dark Green'],
    description:
      'Straight-cut dark green kurti with a small white diamond print and a white Peter Pan collar carrying multicolour floral embroidery and a scalloped edge.',
  },
  {
    slug: 'black-embroidered-yoke-kurta',
    name: 'Black Embroidered Yoke Kurta',
    categorySlug: 'one-piece',
    fabricType: FabricType.RIGID,
    printTechnique: PrintTechnique.FANCY,
    pricePaise: 129900,
    compareAtPricePaise: 159900,
    garmentLengthCm: 130,
    pieces: 1,
    colours: ['Black'],
    description:
      'Sleeveless floor-length kurta in solid black silk blend. A rust-red mirror-work band lines the round neckline and ends in a beaded, tasselled cord; a matching border runs along the hem.',
  },
  {
    slug: 'plum-mirror-work-kurta',
    name: 'Plum Mirror-Work Kurta',
    categorySlug: 'one-piece',
    fabricType: FabricType.RIGID,
    printTechnique: PrintTechnique.FANCY,
    pricePaise: 124900,
    compareAtPricePaise: null,
    garmentLengthCm: 130,
    pieces: 1,
    colours: ['Plum Purple'],
    description:
      'Sleeveless floor-length kurta in solid plum purple with a black mirror-work placket and two tassel ties at the neckline. A matching embroidered border runs along the hem.',
  },
  {
    slug: 'red-check-pleated-kurta',
    name: 'Red Check Pleated Kurta',
    categorySlug: 'one-piece',
    fabricType: FabricType.RIGID,
    printTechnique: PrintTechnique.FANCY,
    pricePaise: 109900,
    compareAtPricePaise: null,
    garmentLengthCm: 110,
    pieces: 1,
    colours: ['Red'],
    description:
      'Fit-and-flare kurta in a red and white check print with a white scalloped bib panel set with three black mirror-work discs. Box pleats release from the waist yoke into a flared skirt.',
  },
  {
    slug: 'ivory-gingham-floral-kurti',
    name: 'Ivory Gingham Floral Kurti',
    categorySlug: 'one-piece',
    fabricType: FabricType.RIGID,
    printTechnique: PrintTechnique.FANCY,
    pricePaise: 102900,
    compareAtPricePaise: null,
    garmentLengthCm: 105,
    pieces: 1,
    colours: ['Ivory'],
    description:
      'Straight-cut ivory kurti with a red and white gingham panel down the centre back and side seams. Red fabric flower appliqués and cross-stitch dots run down the front and back.',
  },
  {
    slug: 'teal-floral-center-panel-kurti',
    name: 'Teal Floral Center-Panel Kurti',
    categorySlug: 'one-piece',
    fabricType: FabricType.RIGID,
    printTechnique: PrintTechnique.FANCY,
    pricePaise: 92900,
    compareAtPricePaise: 119900,
    garmentLengthCm: 105,
    pieces: 1,
    colours: ['Teal Blue'],
    description:
      'Straight-cut teal kurti with a small white leaf print and a cream centre panel printed with a blue and green lotus vine. Dark green trim borders the cuffs.',
  },
  {
    slug: 'mustard-embroidered-angrakha-kurti',
    name: 'Mustard Embroidered Angrakha Kurti',
    categorySlug: 'one-piece',
    fabricType: FabricType.RIGID,
    printTechnique: PrintTechnique.FANCY,
    pricePaise: 99900,
    compareAtPricePaise: 129900,
    garmentLengthCm: 120,
    pieces: 1,
    colours: ['Mustard Yellow'],
    description:
      'Long wrap-style angrakha kurti in solid mustard with white medallion embroidery spaced across the fabric. White lace trims the wrap edge and cuffs, tied with a tasselled cord.',
  },
  {
    slug: 'teal-zari-embroidered-kurta-set',
    name: 'Teal Zari-Embroidered Kurta Set',
    categorySlug: 'three-piece',
    fabricType: FabricType.RIGID,
    printTechnique: PrintTechnique.FANCY,
    pricePaise: 189900,
    compareAtPricePaise: 229900,
    garmentLengthCm: 120,
    pieces: 3,
    colours: ['Teal'],
    description:
      'Teal silk-blend kurta with a gold zari and stone embroidered yoke in a chevron and paisley motif. Comes with teal embroidered pants and a magenta net dupatta in a gold woven border.',
  },
  {
    slug: 'lilac-floral-embroidered-kurta-set',
    name: 'Lilac Floral Embroidered Kurta Set',
    categorySlug: 'three-piece',
    fabricType: FabricType.RIGID,
    printTechnique: PrintTechnique.FANCY,
    pricePaise: 164900,
    compareAtPricePaise: null,
    garmentLengthCm: 120,
    pieces: 3,
    colours: ['Lilac'],
    description:
      'Lilac cotton-silk kurta with pastel floral embroidery down the front placket and a gold-trimmed round neck. Comes with matching pants and a gold-striped dupatta with tasselled ends.',
  },
  {
    slug: 'dusty-rose-embroidered-kaftan-sleeve-kurta-set',
    name: 'Dusty Rose Embroidered Kaftan-Sleeve Kurta Set',
    categorySlug: 'three-piece',
    fabricType: FabricType.RIGID,
    printTechnique: PrintTechnique.FANCY,
    pricePaise: 174900,
    compareAtPricePaise: 209900,
    garmentLengthCm: 120,
    pieces: 3,
    colours: ['Dusty Rose'],
    description:
      'Dusty rose kurta with white thread and mirror-work embroidery at the yoke and booti motifs across the body. Wide kaftan-style sleeves, with a matching dupatta and solid pants.',
  },
  {
    slug: 'zoya-royal-blue-embroidered-suit-set',
    name: 'Zoya Royal Blue Embroidered Suit Set',
    categorySlug: 'three-piece',
    fabricType: FabricType.RIGID,
    printTechnique: PrintTechnique.FANCY,
    pricePaise: 199900,
    compareAtPricePaise: 249900,
    garmentLengthCm: 120,
    pieces: 3,
    colours: ['Royal Blue'],
    description:
      'Royal blue silk-blend kurta with gold zari floral and paisley embroidery trailing down the front and a matching border along the V-neck. Comes with a booti-scattered dupatta and straight pants.',
  },
  {
    slug: 'sage-green-bird-floral-print-suit-set',
    name: 'Sage Green Bird & Floral Print Suit Set',
    categorySlug: 'three-piece',
    fabricType: FabricType.RIGID,
    printTechnique: PrintTechnique.FANCY,
    pricePaise: 149900,
    compareAtPricePaise: null,
    garmentLengthCm: 120,
    pieces: 3,
    colours: ['Sage Green'],
    description:
      'Sage green cotton kurta with a white vine-and-floral print climbing the front, dotted with a colourful bird motif. Gold-and-blue striped cuffs, matching dupatta and straight pants.',
  },
];

async function seedCategories(ds: DataSource): Promise<Map<string, string>> {
  const repo = ds.getRepository(Category);
  await repo.upsert(
    CATEGORIES.map((c) => ({ ...c, sizes: c.sizes ?? DEFAULT_SIZE_BAND, isActive: true })),
    ['slug'],
  );

  const rows = await repo.find();
  return new Map(rows.map((r) => [r.slug, r.id]));
}

async function seedBrands(ds: DataSource): Promise<Map<string, string>> {
  const repo = ds.getRepository(Brand);
  await repo.upsert(
    BRANDS.map((b) => ({ ...b, isActive: true })),
    ['slug'],
  );

  const rows = await repo.find();
  return new Map(rows.map((r) => [r.slug, r.id]));
}

async function seedProducts(ds: DataSource, categoryIds: Map<string, string>): Promise<number> {
  const productRepo = ds.getRepository(Product);
  const variantRepo = ds.getRepository(ProductVariant);

  await productRepo.upsert(
    PRODUCTS.map((p) => {
      const categoryId = categoryIds.get(p.categorySlug);
      if (!categoryId) {
        throw new Error(`Product "${p.slug}" references unknown category "${p.categorySlug}"`);
      }

      return {
        slug: p.slug,
        name: p.name,
        description: p.description,
        categoryId,
        brandId: null,
        pricePaise: p.pricePaise,
        compareAtPricePaise: p.compareAtPricePaise,
        fabricType: p.fabricType,
        printTechnique: p.printTechnique,
        // The chart is derived from the fabric, never hand-written per product —
        // that is what keeps stretch and rigid guidance consistent catalogue-wide.
        isFreeSize: p.isFreeSize ?? false,
        pieces: p.pieces ?? null,
        // Null for free size: a measurement chart implies a choice between
        // sizes, and there is none. Otherwise charted over the *category's*
        // band, so a Blouse gets 32-36 rather than the garment default.
        sizeRules: p.isFreeSize
          ? null
          : buildSizeChart(p.fabricType, p.garmentLengthCm, bandFor(p.categorySlug)),
        isActive: true,
      };
    }),
    ['slug'],
  );

  const products = await productRepo.find();
  const productIdBySlug = new Map(products.map((p) => [p.slug, p.id]));

  const variants = PRODUCTS.flatMap((p) => {
    const productId = productIdBySlug.get(p.slug);
    if (!productId) {
      throw new Error(`Product "${p.slug}" was not persisted`);
    }

    // Free size is one variant per colour. The stored `nominalSize` is the
    // placeholder documented in `AddFreeSizeProducts` — a NOT NULL artefact,
    // never shown, and the trigger rejects a second one.
    const sizes = p.isFreeSize ? [FREE_SIZE_PLACEHOLDER] : bandFor(p.categorySlug);

    return p.colours.flatMap((colour) =>
      sizes.map((nominalSize) => ({
        productId,
        sku: `${p.slug}-${colour}-${nominalSize}`.toUpperCase().replace(/ /g, ''),
        nominalSize,
        colour,
        pricePaise: null,
        stockQuantity: 25,
        isActive: true,
      })),
    );
  });

  await variantRepo.upsert(variants, ['sku']);

  return variants.length;
}

export async function runSeeds(ds: DataSource): Promise<void> {
  const categoryIds = await seedCategories(ds);
  console.log(`  categories: ${categoryIds.size}`);

  const brandIds = await seedBrands(ds);
  console.log(`  brands:     ${brandIds.size}`);

  const variantCount = await seedProducts(ds, categoryIds);
  console.log(`  products:   ${PRODUCTS.length}`);
  console.log(`  variants:   ${variantCount}`);
}

async function main(): Promise<void> {
  const ds = await AppDataSource.initialize();
  console.log('Seeding Adorini reference data...');

  try {
    await runSeeds(ds);
    console.log('Seeding complete.');
  } finally {
    await ds.destroy();
  }
}

// Only self-execute when invoked directly (`npm run seed`), so tests can import
// `runSeeds` without the process tearing down the connection underneath them.
if (require.main === module) {
  main().catch((error: unknown) => {
    console.error('Seeding failed:', error);
    process.exit(1);
  });
}
