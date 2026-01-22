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
  } else if (images[0]?.url) {
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

  const [searchParams] = useSearchParams();
  const params: Record<string, string | undefined> = Object.fromEntries(
    searchParams.entries()
  );
  const { page: pageParam } = params;

  const page = Number(pageParam ?? 1);
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
  }, [isNextPageReady, data?.images]);

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

        <div className="mt-8">
          <UpdateImagesButton disabled={isFetching} />
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
