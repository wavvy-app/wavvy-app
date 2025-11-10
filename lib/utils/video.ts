export async function downloadVideoAsAudio(videoUrl: string): Promise<Buffer> {
  try {
    const response = await fetch(videoUrl);
   
    if (!response.ok) {
      throw new Error(`Failed to download video: ${response.statusText}`);
    }
   
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (error: any) {
    throw new Error(`Failed to download video: ${error.message}`);
  }
}

export function isValidVideoUrl(url: string): boolean {
  try {
    new URL(url);
    return url.includes('blob.vercel-storage.com') || url.startsWith('http');
  } catch {
    return false;
  }
}