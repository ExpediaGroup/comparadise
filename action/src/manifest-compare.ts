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

export interface ManifestCompareDeps {
  s3: Dependencies['s3'];
  octokit: Dependencies['octokit'];
  core: Dependencies['core'];
}

export interface CompareParams {
  bucket: string;
  prSha: string;
  repo: { owner: string; repo: string };
  baseRef: string;
}

export async function manifestCompare(
  params: CompareParams,
  deps: ManifestCompareDeps
): Promise<CompareResult> {
  const { bucket, prSha, repo, baseRef } = params;

  const prManifest = await requirePrManifest(deps, bucket, prSha);

  const headSha = await resolveHeadSha(deps, repo, baseRef);
  const headManifest = (await getManifestFromS3(deps, bucket, headSha)) ?? {};

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
  const ancestorManifest = await requireAncestorManifest(
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

function isNoSuchKey(error: unknown): boolean {
  return error instanceof Error && error.name === 'NoSuchKey';
}

async function getManifestFromS3(
  deps: ManifestCompareDeps,
  bucket: string,
  sha: string
): Promise<Manifest | null> {
  try {
    const response = await deps.s3.getObject({
      Bucket: bucket,
      Key: `manifests/${sha}.json`
    });
    const body = await response.Body!.transformToString();
    return JSON.parse(body) as Manifest;
  } catch (error: unknown) {
    if (isNoSuchKey(error)) return null;
    throw error;
  }
}

async function requirePrManifest(
  deps: ManifestCompareDeps,
  bucket: string,
  sha: string
): Promise<Manifest> {
  const manifest = await getManifestFromS3(deps, bucket, sha);
  if (!manifest) {
    throw new Error(
      `PR manifest not found for ${sha}. Ensure manifest-generate ran successfully.`
    );
  }
  return manifest;
}

async function requireAncestorManifest(
  deps: ManifestCompareDeps,
  bucket: string,
  sha: string
): Promise<Manifest> {
  const manifest = await getManifestFromS3(deps, bucket, sha);
  if (!manifest) {
    throw new Error(
      `Ancestor manifest not found for ${sha}. Please rebase your branch to generate the missing manifest.`
    );
  }
  return manifest;
}

async function resolveHeadSha(
  deps: ManifestCompareDeps,
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
  deps: ManifestCompareDeps,
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
