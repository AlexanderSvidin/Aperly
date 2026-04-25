export function unimplementedPhase2(featureName: string): never {
  throw new Error(
    `${featureName} is not implemented in Phase 2. This scaffold only defines the module boundary.`
  );
}
