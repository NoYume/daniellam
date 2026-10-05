import sharp from 'sharp';

/** True if the image carries EXIF, XMP or IPTC metadata (which can hold a location). */
export async function hasMetadata(path: string): Promise<boolean> {
  const meta = await sharp(path).metadata();
  return Boolean(meta.exif || meta.xmp || meta.iptc);
}
