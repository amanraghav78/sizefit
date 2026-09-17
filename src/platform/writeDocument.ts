/**
 * Write finished document bytes (a PDF) to a file the share sheet can hand on.
 */
import { Directory, File, Paths } from 'expo-file-system';

const WORK_DIR = 'sizefit-work';

export async function writeDocument(bytes: Uint8Array, extension: string): Promise<string> {
  const dir = new Directory(Paths.cache, WORK_DIR);
  if (!dir.exists) dir.create({ intermediates: true });
  const file = new File(dir, `sizefit-${Date.now()}.${extension}`);
  file.create({ overwrite: true });
  file.write(bytes);
  return file.uri;
}
