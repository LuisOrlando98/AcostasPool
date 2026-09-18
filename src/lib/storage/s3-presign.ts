import { createHash, createHmac } from "crypto";

/**
 * Firma SigV4 por query string para GET de objetos S3.
 *
 * El proyecto no tiene `@aws-sdk/s3-request-presigner` instalado y esta revisión
 * no puede añadir dependencias, así que la firma se calcula aquí con `crypto`.
 * Es el mismo algoritmo que usa el presigner oficial (headers firmados: solo
 * `host`, payload `UNSIGNED-PAYLOAD`), en unas 80 líneas y sin dependencias
 * transitivas nuevas.
 */

const ALGORITHM = "AWS4-HMAC-SHA256";
const UNSIGNED_PAYLOAD = "UNSIGNED-PAYLOAD";
const SIGNED_HEADERS = "host";
const SERVICE_NAME = "s3";
const REQUEST_TYPE = "aws4_request";
const HTTP_METHOD = "GET";
const DATE_STAMP_LENGTH = 8;
const RFC3986_EXTRA_PATTERN = /[!'()*]/g;

export type PresignS3GetInput = {
  bucket: string;
  region: string;
  key: string;
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string | null;
  expiresInSeconds: number;
  /** Inyectable para hacer la firma determinista en los tests. */
  now?: Date;
  responseContentType?: string | null;
  responseContentDisposition?: string | null;
};

function encodeRfc3986(value: string) {
  return encodeURIComponent(value).replace(
    RFC3986_EXTRA_PATTERN,
    (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`
  );
}

function encodeCanonicalUri(key: string) {
  const encoded = key
    .split("/")
    .filter(Boolean)
    .map(encodeRfc3986)
    .join("/");
  return `/${encoded}`;
}

function toAmzDate(date: Date) {
  return date.toISOString().replace(/[:-]/g, "").replace(/\.\d{3}/, "");
}

function hmacSha256(key: Buffer | string, data: string) {
  return createHmac("sha256", key).update(data, "utf8").digest();
}

function sha256Hex(data: string) {
  return createHash("sha256").update(data, "utf8").digest("hex");
}

function buildCanonicalQuery(params: ReadonlyArray<readonly [string, string]>) {
  return [...params]
    .map(([name, value]) => [encodeRfc3986(name), encodeRfc3986(value)] as const)
    .sort((left, right) =>
      left[0] === right[0] ? left[1].localeCompare(right[1]) : left[0].localeCompare(right[0])
    )
    .map(([name, value]) => `${name}=${value}`)
    .join("&");
}

function buildSigningKey(secretAccessKey: string, dateStamp: string, region: string) {
  const dateKey = hmacSha256(`AWS4${secretAccessKey}`, dateStamp);
  const regionKey = hmacSha256(dateKey, region);
  const serviceKey = hmacSha256(regionKey, SERVICE_NAME);
  return hmacSha256(serviceKey, REQUEST_TYPE);
}

/** URL virtual-hosted firmada; caduca a los `expiresInSeconds` segundos. */
export function presignS3GetUrl(input: PresignS3GetInput) {
  const now = input.now ?? new Date();
  const amzDate = toAmzDate(now);
  const dateStamp = amzDate.slice(0, DATE_STAMP_LENGTH);
  const host = `${input.bucket}.s3.${input.region}.amazonaws.com`;
  const canonicalUri = encodeCanonicalUri(input.key);
  const scope = `${dateStamp}/${input.region}/${SERVICE_NAME}/${REQUEST_TYPE}`;

  const baseParams: ReadonlyArray<readonly [string, string]> = [
    ["X-Amz-Algorithm", ALGORITHM],
    ["X-Amz-Credential", `${input.accessKeyId}/${scope}`],
    ["X-Amz-Date", amzDate],
    ["X-Amz-Expires", String(input.expiresInSeconds)],
    ["X-Amz-SignedHeaders", SIGNED_HEADERS],
  ];
  const optionalParams: ReadonlyArray<readonly [string, string]> = [
    ...(input.sessionToken ? ([["X-Amz-Security-Token", input.sessionToken]] as const) : []),
    ...(input.responseContentType
      ? ([["response-content-type", input.responseContentType]] as const)
      : []),
    ...(input.responseContentDisposition
      ? ([["response-content-disposition", input.responseContentDisposition]] as const)
      : []),
  ];

  const canonicalQuery = buildCanonicalQuery([...baseParams, ...optionalParams]);
  const canonicalRequest = [
    HTTP_METHOD,
    canonicalUri,
    canonicalQuery,
    `host:${host}`,
    "",
    SIGNED_HEADERS,
    UNSIGNED_PAYLOAD,
  ].join("\n");

  const stringToSign = [ALGORITHM, amzDate, scope, sha256Hex(canonicalRequest)].join("\n");
  const signature = hmacSha256(
    buildSigningKey(input.secretAccessKey, dateStamp, input.region),
    stringToSign
  ).toString("hex");

  return `https://${host}${canonicalUri}?${canonicalQuery}&X-Amz-Signature=${signature}`;
}
