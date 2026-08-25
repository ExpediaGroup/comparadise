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
}

export interface ClassifyParams {
  bucket: string;
  prSha: string;
  repo: { owner: string; repo: string };
  baseRef: string;
}

export async function classifyManifests(
  params: ClassifyParams,
  deps: ClassifyDeps
): Promise<CompareResult> {
  const { bucket, prSha, repo, baseRef } = params;

  const prManifest = await requirePrManifest(deps, bucket, prSha);

  const headSha = await resolveHeadSha(deps, repo, baseRef);
  const headManifest = (await deps.getManifest(bucket, headSha)) ?? {};

  const allPaths = new Set([
    ...Object.keys(prManifest),
    ...Object.keys(headManifest)
  ]);

  const differingPaths = [...allPaths].filter(
    p => prManifest[p] !== headManifest[p]
  );

  if (differingPaths.length === 0) {
    return { outcome: 'match' };
  }

  const ancestorSha = await resolveAncestorSha(deps, repo, headSha, prSha);
  const ancestorManifest = await resolveAncestorManifest(
    deps,
    bucket,
    ancestorSha
  );

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

async function resolveAncestorManifest(
  deps: ClassifyDeps,
  bucket: string,
  sha: string
): Promise<Manifest> {
  const manifest = await deps.getManifest(bucket, sha);
  if (!manifest) {
    deps.core.info(
      `No ancestor manifest found for ${sha} — treating as an empty baseline (first run of manifest mode reachable from this branch's history).`
    );
    return {};
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
