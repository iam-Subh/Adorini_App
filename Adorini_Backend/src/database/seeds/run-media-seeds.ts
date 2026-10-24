import 'reflect-metadata';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { NodeHttpHandler } from '@smithy/node-http-handler';
import { In } from 'typeorm';

import { MediaProvenance, MediaType } from '../../common/enums/domain.enums';
import { AppDataSource } from '../data-source';
import { MediaAsset, Product } from '../entities';

interface MediaManifestEntry {
  category: string;
  productSlug: string;
  file: string;
  displayOrder: number;
  altText: string;
}

const MEDIA_ROOT = resolve(process.cwd(), 'assets', 'product-images');
const MANIFEST_PATH = resolve(MEDIA_ROOT, 'manifest.json');
const UPLOAD_CONCURRENCY = 4;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required for the catalog media seed`);
  }
  return value;
}

function contentType(path: string): string {
  if (path.endsWith('.png')) return 'image/png';
  if (path.endsWith('.jpg') || path.endsWith('.jpeg')) return 'image/jpeg';
  throw new Error(`Unsupported catalog image type: ${path}`);
}

async function inBatches<T>(values: T[], action: (value: T) => Promise<void>): Promise<void> {
  for (let index = 0; index < values.length; index += UPLOAD_CONCURRENCY) {
    await Promise.all(values.slice(index, index + UPLOAD_CONCURRENCY).map(action));
  }
}

export async function runMediaSeeds(): Promise<void> {
  const manifest = JSON.parse(await readFile(MANIFEST_PATH, 'utf8')) as MediaManifestEntry[];
  const productSlugs = [...new Set(manifest.map((entry) => entry.productSlug))];

  await AppDataSource.initialize();
  try {
    const productRepo = AppDataSource.getRepository(Product);
    const mediaRepo = AppDataSource.getRepository(MediaAsset);
    const products = await productRepo.findBy({ slug: In(productSlugs) });
    const productsBySlug = new Map(products.map((product) => [product.slug, product]));
    const missing = productSlugs.filter((slug) => !productsBySlug.has(slug));
    if (missing.length > 0) {
      throw new Error(`Catalog products are missing from the database: ${missing.join(', ')}`);
    }

    const accountId = requireEnv('R2_ACCOUNT_ID');
    const bucketName = requireEnv('R2_BUCKET_NAME');
    const client = new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: requireEnv('R2_ACCESS_KEY_ID'),
        secretAccessKey: requireEnv('R2_SECRET_ACCESS_KEY'),
      },
      requestHandler: new NodeHttpHandler({
        connectionTimeout: 5_000,
        requestTimeout: 30_000,
      }),
      maxAttempts: 2,
    });

    let uploaded = 0;
    await inBatches(manifest, async (entry) => {
      const localPath = resolve(MEDIA_ROOT, ...entry.file.split('/'));
      const objectKey = `products/${entry.file}`;
      await client.send(
        new PutObjectCommand({
          Bucket: bucketName,
          Key: objectKey,
          Body: await readFile(localPath),
          ContentType: contentType(localPath),
          CacheControl: 'public, max-age=31536000, immutable',
        }),
      );

      const product = productsBySlug.get(entry.productSlug)!;
      let media = await mediaRepo.findOneBy({
        productId: product.id,
        objectKey,
        provenance: MediaProvenance.ADMIN,
      });
      media ??= mediaRepo.create({
        productId: product.id,
        objectKey,
        type: MediaType.IMAGE,
        provenance: MediaProvenance.ADMIN,
        uploadedByUserId: null,
        reviewId: null,
      });
      media.displayOrder = entry.displayOrder;
      media.altText = entry.altText;
      await mediaRepo.save(media);
      uploaded += 1;
      console.log(`  ${uploaded}/${manifest.length} ${entry.productSlug}`);
    });

    console.log(`Catalog media seed complete: ${uploaded} images.`);
  } finally {
    await AppDataSource.destroy();
  }
}

if (require.main === module) {
  runMediaSeeds().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
