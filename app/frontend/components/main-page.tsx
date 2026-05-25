import * as React from 'react';
import { Error } from './error';
import { Loader } from './loader';
import {
  ViewToggle,
  ImageViews,
  ImageView,
  AvailableView
} from './view-toggle';
import { UpdateImagesButton } from './update-images-button';
import { trpc } from '../utils/trpc';
import {
  createSearchParams,
  useNavigate,
  useSearchParams
} from 'react-router-dom';
import { ArrowBackIcon, ArrowForwardIcon } from './arrows';
import { ImagesContainer } from './images-container';
import { getViewType, preloadAllImages, preloadImage } from './utils/image';
import { Images } from './types';

const preloadNextPage = async (images?: Images) => {
  if (!images) {
    return;
  }

  const newViewType = await getViewType(images);
  if (newViewType === ImageViews.SIDE_BY_SIDE) {
    await preloadAllImages(images.map(image => image.url));
  } else if (newViewType === ImageViews.SINGLE && images[0]?.url) {
    await preloadImage(images[0].url);
  }

  return newViewType;
};

export const MainPage = ({
  hash,
  bucket
}: {
  hash: string;
  bucket: string;
}) => {
  const [viewType, setViewType] = React.useState<ImageView>();
  const [availableView, setAvailableView] = React.useState<AvailableView>();
  const [isNextPageReady, setIsNextPageReady] = React.useState(false);
  const [visitedPages, setVisitedPages] = React.useState<Set<number>>(
    new Set()
  );
  const [hasViewedAllPages, setHasViewedAllPages] = React.useState(false);

  const [searchParams] = useSearchParams();
  const params: Record<string, string | undefined> = Object.fromEntries(
    searchParams.entries()
  );
  const {
    page: pageParam,
    forceUpdate,
    commitHash,
    owner,
    repo,
    prNumber
  } = params;

  const page = Number(pageParam ?? 1);
  const { data: visualRegressionStatusData } =
    trpc.getVisualRegressionStatus.useQuery(
      { commitHash: commitHash ?? '', owner: owner ?? '', repo: repo ?? '' },
      { enabled: Boolean(commitHash && owner && repo) }
    );
  const isAlreadyUpdated = visualRegressionStatusData?.isAlreadyUpdated;

  const { isLoading, data, isFetching, error } = trpc.fetchCurrentPage.useQuery(
    { hash, bucket, page }
  );

  const nextPageExists = Boolean(data?.nextPage);
  const previousPageExists = page - 1 > 0;

  const navigate = useNavigate();
  const utils = trpc.useUtils();

  if (previousPageExists) {
    utils.fetchCurrentPage.prefetch({ hash, bucket, page: page - 1 });
  }
  if (nextPageExists) {
    utils.fetchCurrentPage.prefetch({ hash, bucket, page: page + 1 });
  }

  React.useEffect(() => {
    if (data) {
      const newVisitedPages = new Set([...visitedPages, page]);
      setVisitedPages(newVisitedPages);
      if (!data.nextPage && newVisitedPages.size >= page) {
        setHasViewedAllPages(true);
      }
    }
  }, [data, page]);

  React.useEffect(() => {
    preloadNextPage(data?.images).then(newViewType => {
      if (newViewType) {
        setIsNextPageReady(true);
        setViewType(newViewType);
        if (newViewType === ImageViews.SIDE_BY_SIDE) {
          setAvailableView('BOTH');
        } else {
          setAvailableView('SINGLE');
        }
      }
    });
  }, [data?.images]);

  if (error) {
    return <Error error={error} />;
  }

  if (isLoading) {
    return <Loader />;
  }

  const onClickBackArrow = () => {
    navigate({
      pathname: '/',
      search: `?${createSearchParams({ ...params, page: String(page - 1) })}`
    });
    setIsNextPageReady(false);
  };

  const onClickForwardArrow = () => {
    navigate({
      pathname: '/',
      search: `?${createSearchParams({ ...params, page: String(page + 1) })}`
    });
    setIsNextPageReady(false);
  };

  const backButtonDisabled = page <= 1 || isFetching;
  const forwardButtonDisabled = !nextPageExists || isFetching;

  const prUrl =
    prNumber && owner && repo
      ? `https://github.com/${owner}/${repo}/pull/${prNumber}`
      : undefined;

  return (
    <>
      {prUrl && (
        <div className="fixed top-4 left-4 z-50">
          <a
            href={prUrl}
            className="inline-flex items-center rounded-md bg-white/90 px-3 py-1.5 font-medium text-sky-600 shadow-sm backdrop-blur hover:text-sky-800"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="mr-1 h-5 w-5"
            >
              <path
                fillRule="evenodd"
                d="M17 10a.75.75 0 0 1-.75.75H5.612l4.158 3.96a.75.75 0 1 1-1.04 1.08l-5.5-5.25a.75.75 0 0 1 0-1.08l5.5-5.25a.75.75 0 1 1 1.04 1.08L5.612 9.25H16.25A.75.75 0 0 1 17 10Z"
                clipRule="evenodd"
              />
            </svg>
            Back to PR
          </a>
        </div>
      )}
      <div className="mt-10 flex flex-col items-center justify-center">
        <div className="flex w-4/5 items-center justify-between">
          <button
            disabled={backButtonDisabled}
            onClick={onClickBackArrow}
            aria-label="back-arrow"
          >
            <ArrowBackIcon disabled={backButtonDisabled} />
          </button>
          <h1 className="max-w-4xl text-center text-4xl font-medium break-words">
            {data?.title || 'Loading images...'}
          </h1>
          <button
            disabled={forwardButtonDisabled}
            onClick={onClickForwardArrow}
            aria-label="forward-arrow"
          >
            <ArrowForwardIcon disabled={forwardButtonDisabled} />
          </button>
        </div>

        {data?.totalPages && (
          <p className="mt-4 text-xl font-semibold text-gray-500">
            Change {page} of {data.totalPages}
          </p>
        )}
        <div className="mt-8">
          {isAlreadyUpdated ? (
            <div className="rounded-lg bg-green-100 px-4 py-3 text-sm text-green-800">
              Base images have already been updated for these diffs.
            </div>
          ) : (
            <UpdateImagesButton
              disabled={
                isFetching || (!hasViewedAllPages && forceUpdate !== 'true')
              }
              hasViewedAllPages={hasViewedAllPages}
            />
          )}
        </div>
        <div className="mt-5">
          <ViewToggle
            selectedView={viewType}
            availableView={availableView}
            onSelectView={setViewType}
          />
        </div>
      </div>
      <div className="relative mt-8">
        {data?.images && (
          <ImagesContainer
            images={data.images}
            viewType={viewType}
            isNextPageReady={isNextPageReady}
          />
        )}
        {!isNextPageReady && <Loader />}
      </div>
    </>
  );
};
