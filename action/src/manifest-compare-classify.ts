import type { Dependencies } from './dependencies';
import type { Manifest } from './manifest-s3';

export interface PrOwnsEntry {
  path: string;
  type: 'changed' | 'added' | 'deleted';
}

export type CompareResult =
  | { outcome: 'match' }
  | {
      outcome: 'classified';
      headSha: string;
      prSha: string;
      prOwns: PrOwnsEntry[];
      mainOwns: string[];
      conflicts: string[];
    };

export interface ClassifyDeps {
  s3: Dependencies['s3'];
  octokit: Dependencies['octokit'];
  core: Dependencies['core'];
  getManifest: (bucket: string, sha: string) => Promise<Manifest | null>;
  getAncestorManifest: (bucket: string, startSha: string) => Promise<Manifest>;
}

export interface ClassifyParams {
  bucket: string;
  prSha: string;
  repo: { owner: string; repo: string };
  baseRef: string;
  coveredPackagePaths?: string[] | null;
}

export async function classifyManifests(
  params: ClassifyParams,
  deps: ClassifyDeps
): Promise<CompareResult> {
  const { bucket, prSha, repo, baseRef, coveredPackagePaths } = params;

  const prManifest = await requirePrManifest(deps, bucket, prSha);

  const headSha = await resolveHeadSha(deps, repo, baseRef);
  // headSha itself may never have gotten a manifest written (e.g. its push
  // didn't touch a comparadise-relevant path) — walk back to the nearest
  // ancestor that has one rather than treating main as having no baseline.
  const headManifest = await deps.getAncestorManifest(bucket, headSha);

  const allPaths = new Set([
    ...Object.keys(prManifest),
    ...Object.keys(headManifest)
  ]);

  const isCovered = makeCoverageMatcher(coveredPackagePaths);
  const outOfScope: string[] = [];

  const differingPaths = [...allPaths].filter(p => {
    if (prManifest[p] === headManifest[p]) return false;
    if (!(p in prManifest) && !isCovered(p)) {
      outOfScope.push(p);
      return false;
    }
    return true;
  });

  if (outOfScope.length > 0) {
    deps.core.info(
      `${outOfScope.length} baseline path(s) belong to packages this PR did not run visual tests for — leaving them unchanged.`
    );
  }

  if (differingPaths.length === 0) {
    return { outcome: 'match' };
  }

  const ancestorSha = await resolveAncestorSha(deps, repo, headSha, prSha);
  const ancestorManifest = await deps.getAncestorManifest(bucket, ancestorSha);

  const prOwns: PrOwnsEntry[] = [];
  const mainOwns: string[] = [];
  const conflicts: string[] = [];

  for (const path of differingPaths) {
    const ancestorHash = ancestorManifest[path] ?? null;
    const headHash = headManifest[path] ?? null;
    const prHash = prManifest[path] ?? null;

    if (headHash === ancestorHash) {
      // PR introduced the change
      if (ancestorHash === null) {
        prOwns.push({ path, type: 'added' });
      } else if (prHash === null) {
        prOwns.push({ path, type: 'deleted' });
      } else {
        prOwns.push({ path, type: 'changed' });
      }
    } else if (prHash === ancestorHash) {
      // Main changed, PR is clean
      mainOwns.push(path);
    } else {
      // All three differ
      conflicts.push(path);
    }
  }

  return {
    outcome: 'classified',
    headSha,
    prSha,
    prOwns,
    mainOwns,
    conflicts
  };
}

function makeCoverageMatcher(
  coveredPackagePaths: string[] | null | undefined
): (path: string) => boolean {
  if (!coveredPackagePaths) return () => true;
  const prefixes = coveredPackagePaths
    .map(p => p.replace(/^\/+|\/+$/g, ''))
    .filter(Boolean);
  return path =>
    prefixes.some(prefix => path === prefix || path.startsWith(`${prefix}/`));
}

async function requirePrManifest(
  deps: ClassifyDeps,
  bucket: string,
  sha: string
): Promise<Manifest> {
  const manifest = await deps.getManifest(bucket, sha);
  if (!manifest) {
    throw new Error(
      `PR manifest not found for ${sha}. Ensure manifest-generate ran successfully.`
    );
  }
  return manifest;
}

async function resolveHeadSha(
  deps: ClassifyDeps,
  repo: { owner: string; repo: string },
  baseRef: string
): Promise<string> {
  const { data } = await deps.octokit.rest.repos.getBranch({
    ...repo,
    branch: baseRef
  });
  return data.commit.sha;
}

async function resolveAncestorSha(
  deps: ClassifyDeps,
  repo: { owner: string; repo: string },
  headSha: string,
  prSha: string
): Promise<string> {
  const { data } = await deps.octokit.rest.repos.compareCommitsWithBasehead({
    ...repo,
    basehead: `${headSha}...${prSha}`
  });
  return data.merge_base_commit.sha;
}
