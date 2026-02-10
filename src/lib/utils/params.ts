export async function resolveParams<T>(params: T | Promise<T>): Promise<T> {
  if (params && typeof (params as Promise<T>).then === "function") {
    return (params as Promise<T>);
  }
  return params as T;
}
