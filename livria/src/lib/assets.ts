import { useQuery } from "@tanstack/react-query";
import { signedFile } from "./db";
export function useAsset(bucket: string, path?: string | null) {
  return (
    useQuery({
      queryKey: ["asset", bucket, path],
      enabled: !!path,
      staleTime: 10 * 60 * 1000,
      queryFn: () =>
        path!.startsWith("https://")
          ? Promise.resolve(path!)
          : signedFile(bucket, path!),
    }).data || ""
  );
}
