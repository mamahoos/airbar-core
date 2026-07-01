/** Nominal brand tag — prevents mixing raw strings with domain IDs at compile time. */
declare const brand: unique symbol;

export type Brand<TBase, TBrand extends string> = TBase & { readonly [brand]: TBrand };

export function brandValue<TBase extends string, TBrand extends string>(
  value: TBase,
): Brand<TBase, TBrand> {
  return value as Brand<TBase, TBrand>;
}

export function isNonEmptyString(value: string): boolean {
  return value.trim().length > 0;
}
