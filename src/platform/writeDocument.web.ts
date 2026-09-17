/** Web build: a blob URL is the closest thing to a file. */
export async function writeDocument(bytes: Uint8Array, extension: string): Promise<string> {
  const copy = new Uint8Array(bytes);
  const type = extension === 'pdf' ? 'application/pdf' : 'application/octet-stream';
  return URL.createObjectURL(new Blob([copy], { type }));
}
