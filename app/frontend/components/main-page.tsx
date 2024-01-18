import * as React from 'react';
import { LandingPage } from './landing-page';
import { Error } from './error';
import { Loader, LoaderViews } from './loader';
import { ViewToggle, ImageViews, ImageView } from './view-toggle';
import { UpdateImagesButton } from './update-images-button';
import { RouterOutput, trpc } from '../utils/trpc';
import {
  createSearchParams,
  useNavigate,
  useSearchParams
} from 'react-router-dom';
import { ArrowBackIcon, ArrowForwardIcon } from './arrows';
import { ImageContainer } from './image-container';
import { useEffect } from 'react';

const imageIsSmallEnoughForSideBySide = async (image: string) => {
  const img = new Image();
  img.src = image;
  await img.decode();

  return 3 * img.naturalWidth < window.innerWidth;
};

const getViewType = async (
  images: RouterOutput['fetchCurrentPage']['images']
) => {
  if (images.length === 1) {
    return ImageViews.SINGLE;
  }
  const diffImage = images[1]?.url;
  if (!diffImage) {
    return ImageViews.SINGLE;
  }

  const shouldViewSideBySide = await imageIsSmallEnoughForSideBySide(diffImage);
  return shouldViewSideBySide ? ImageViews.SIDE_BY_SIDE : ImageViews.SINGLE;
};

export const MainPage = () => {
  const [isMounted, setIsMounted] = React.useState(false);
  const [viewType, setViewType] = React.useState<ImageView>();

  const [searchParams] = useSearchParams();
  const params: Record<string, string | undefined> = Object.fromEntries(
    searchParams.entries()
  );
  const { hash, bucket, page: pageParam } = params;
  if (!hash || !bucket) {
    return <LandingPage />;
  }

  const page = Number(pageParam ?? 1);
  const { isLoading, data, isFetching, refetch, error } =
    trpc.fetchCurrentPage.useQuery({ hash, bucket, page });

  const nextPageExists = Boolean(data?.nextPage);

  const navigate = useNavigate();
  const utils = trpc.useUtils();
  if (nextPageExists) {
    utils.fetchCurrentPage.prefetch({ hash, bucket, page: page + 1 });
  }

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (data?.images) {
      getViewType(data.images).then(newViewType => {
        setViewType(newViewType);
      });
    }
  }, [data?.images]);

  if (error) {
    return <Error error={error} />;
  }

  if (isLoading && !isMounted) {
    return <Loader view="OVERLAY" />;
  }

  const onClickBackArrow = () => {
    navigate({
      pathname: '/',
      search: `?${createSearchParams({ ...params, page: String(page - 1) })}`
    });
    refetch();
  };

  const onClickForwardArrow = () => {
    navigate({
      pathname: '/',
      search: `?${createSearchParams({ ...params, page: String(page + 1) })}`
    });
    refetch();
  };

  const backButtonDisabled = page <= 1 || isFetching;
  const forwardButtonDisabled = !nextPageExists || isFetching;

  return (
    <>
      <div className="mt-10 flex flex-col items-center justify-center">
        <div className="flex w-4/5 items-center justify-between">
          <button
            disabled={backButtonDisabled}
            onClick={onClickBackArrow}
            aria-label="back-arrow"
          >
            <ArrowBackIcon disabled={backButtonDisabled} />
          </button>
          <h1 className="text-center text-4xl font-medium">
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
        {!isFetching && (
          <>
            <div className="mt-8">
              <UpdateImagesButton />
            </div>
            <div className="mt-5">
              <ViewToggle selectedView={viewType} onSelectView={setViewType} />
            </div>
          </>
        )}
      </div>
      {isMounted && data?.images && viewType && (
        <ImageContainer images={data.images} viewType={viewType} />
      )}
    </>
  );
};
