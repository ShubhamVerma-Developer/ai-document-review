import { BlobItem } from '@azure/storage-blob'
import { containerClient } from '../main'

export async function getBlob(name: string): Promise<Blob> {
  const blobClient = containerClient.getBlobClient(name)
  const downloadBlockBlobResponse = await blobClient.download()
  const downloadBlockBlobResponseBlob = await downloadBlockBlobResponse.blobBody
  if (!downloadBlockBlobResponseBlob) {
    throw new Error('Failed to download blob')
  }
  return downloadBlockBlobResponseBlob
}

export async function listBlobs(): Promise<BlobItem[]> {
  const iter = containerClient.listBlobsFlat()
  const files: BlobItem[] = []
  for await (const blob of iter) {
    files.push(blob)
  }
  return files
}

export async function uploadBlob(file: File): Promise<void> {
  const blobClient = containerClient.getBlockBlobClient(file.name)
  await blobClient.uploadData(file)
}
