import { createClient } from "@supabase/supabase-js";
import { SUPABASE_KEY, SUPABASE_URL } from "./config";
export const db = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: "implicit",
  },
});
export type Row = Record<string, any>;
export async function result<T>(
  request: PromiseLike<{ data: T | null; error: any }>,
) {
  const { data, error } = await request;
  if (error) throw error;
  return data as NonNullable<T>;
}
export async function rows(
  table: string,
  query?: (q: any) => any,
): Promise<Row[]> {
  let q = db.from(table).select("*");
  return result(query ? query(q) : q);
}
export async function signedFile(bucket: string, path: string) {
  const d = await result(db.storage.from(bucket).createSignedUrl(path, 900));
  return d.signedUrl;
}
export async function uploadFile(
  bucket: string,
  path: string,
  file: File,
  onProgress?: (n: number) => void,
) {
  const {
    data: { session },
  } = await db.auth.getSession();
  if (!session) throw Error("Entre na sua conta para enviar arquivos.");
  return new Promise<void>((resolve, reject) => {
    const x = new XMLHttpRequest();
    x.open(
      "POST",
      `${SUPABASE_URL}/storage/v1/object/${bucket}/${path.split("/").map(encodeURIComponent).join("/")}`,
    );
    x.setRequestHeader("apikey", SUPABASE_KEY);
    x.setRequestHeader("Authorization", `Bearer ${session.access_token}`);
    x.setRequestHeader("Content-Type", file.type || "application/octet-stream");
    x.upload.onprogress = (e) =>
      e.lengthComputable &&
      onProgress?.(Math.round((e.loaded / e.total) * 100));
    x.onerror = () => reject(Error("Falha de conexão durante o envio."));
    x.onload = () =>
      x.status < 300
        ? resolve()
        : reject(
            Error(
              "O arquivo não pôde ser enviado. Confira o tamanho e o formato.",
            ),
          );
    x.send(file);
  });
}
export async function uploadImage(user: string, file: File, kind = "avatar") {
  if (
    !["image/png", "image/jpeg", "image/webp"].includes(file.type) ||
    file.size > 5 * 1024 * 1024
  )
    throw Error("Use uma imagem PNG, JPG ou WebP de até 5 MB.");
  const path = `${user}/${kind}-${crypto.randomUUID()}.${file.type.split("/")[1]}`;
  await uploadFile("profile-images", path, file);
  return path;
}
