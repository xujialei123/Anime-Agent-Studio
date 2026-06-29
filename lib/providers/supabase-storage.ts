const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const BUCKET_NAME = process.env.SUPABASE_IMAGE_BUCKET || "anime-images";

function encodeStoragePath(path: string) {
  return path.split("/").map(encodeURIComponent).join("/");
}

export async function uploadMediaToSupabase(buffer: Buffer, path: string, contentType: string) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("缺少 Supabase Storage 配置，无法上传媒体文件");
  }

  const encodedPath = encodeStoragePath(path);
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET_NAME}/${encodedPath}`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": contentType,
      "x-upsert": "true"
    },
    body: new Uint8Array(buffer)
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase upload failed ${res.status}: ${text}`);
  }

  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET_NAME}/${encodedPath}`;
}

export function uploadImageToSupabase(buffer: Buffer, path: string, contentType = "image/png") {
  return uploadMediaToSupabase(buffer, path, contentType);
}
