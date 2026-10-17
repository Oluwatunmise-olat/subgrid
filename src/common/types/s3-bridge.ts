export type S3Spec = {
  name?: string;
  endpoint: string;
  region?: string;
  accessKeyId: string;
  secretAccessKey: string;
};

export type S3Result = {
  ok: boolean;
  status: number;
  body: string;
  contentType: string | null;
};
