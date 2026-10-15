import { authenticated } from '@/lib/session';
import { errorResponse, mutation } from '@/lib/http';
import { object } from '@/domain/validation';
import {
  vaultSnapshot,
  generateVaultPresignedUploadUrl,
  ownedVaultItem,
  confirmVaultUpload,
  deleteVaultObject,
} from '@/services/r2';
export const runtime = 'nodejs';
export async function GET() {
  try {
    return Response.json(await vaultSnapshot(), {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
export async function POST(request: Request) {
  return mutation(
    request,
    async (input) => {
      const { user } = await authenticated();
      const data = object(input);
      return generateVaultPresignedUploadUrl(user.id, data.fileName, data.fileSize, data.mimeType);
    },
    2048,
  );
}
export async function PUT(request: Request) {
  return mutation(
    request,
    async (input) => {
      await confirmVaultUpload(object(input).id);
      return vaultSnapshot();
    },
    512,
  );
}
export async function DELETE(request: Request) {
  return mutation(
    request,
    async (input) => {
      const row = await ownedVaultItem(object(input).id);
      await deleteVaultObject(row.r2_key);
      return vaultSnapshot();
    },
    512,
  );
}
