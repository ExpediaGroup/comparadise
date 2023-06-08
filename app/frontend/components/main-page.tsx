import * as React from 'react';
import { useEffect } from 'react';
import { LandingPage } from './landing-page';
import { Error } from './error';
import { Loader, LoaderViews } from './loader';
import { ViewToggle, ViewType } from './view-toggle';
import { UpdateImagesButton } from './update-images-button';
import { SideBySideImageView, SingleImageView } from './image-views';
import { RouterOutput, trpc } from '../utils/trpc';
import { useQueryParams } from 'use-query-params';
import { URL_PARAMS } from '../constants';
import { ArrowBackIcon, ArrowForwardIcon } from './arrows';

export const MainPage = () => {
  const [{ hash, bucket }] = useQueryParams(URL_PARAMS);

  const [specIndex, setSpecIndex] = React.useState(0);
  const [viewType, setViewType] = React.useState<ViewType | undefined>();
  const [singleImageViewIndex, setSingleImageViewIndex] = React.useState(0);

  if (!hash || !bucket) {
    return <LandingPage />;
  }

  const { isLoading, data, fetchNextPage, fetchPreviousPage, isFetching, error } = trpc.fetchCurrentPage.useInfiniteQuery(
    { hash, bucket },
    {
      initialCursor: 1,
      getNextPageParam: currentPage => currentPage.nextPage,
      keepPreviousData: true,
      refetchOnWindowFocus: false
    }
  );

  const currentPage = data?.pages[specIndex];

  useEffect(() => {
    if (currentPage) {
      getViewType(currentPage.images).then(newViewType => {
        setViewType(newViewType);
      });
    }
  }, [currentPage]);

  if (error) {
    return <Error error={error} />;
  }

  if (isLoading) {
    return <Loader view={LoaderViews.FULL_SCREEN} />;
  }

  const onClickBackArrow = async () => {
    await fetchPreviousPage();
    setSpecIndex(specIndex - 1);
  };

  const onClickForwardArrow = async () => {
    await fetchNextPage();
    setSpecIndex(specIndex + 1);
  };

  const getImageBody = () => {
    if (isFetching || !currentPage) {
      return <Loader view={LoaderViews.PARTIAL} />;
    }
    const imageView =
      viewType === ViewType.SIDE_BY_SIDE ? (
        <SideBySideImageView images={currentPage.images} />
      ) : (
        <SingleImageView images={currentPage.images} selectedImageIndex={singleImageViewIndex} onSelectImage={setSingleImageViewIndex} />
      );
    return <div className="mt-8">{imageView}</div>;
  };

  const nextPageExists = Boolean(currentPage?.nextPage);

  return (
    <>
      <div className="mt-10 flex flex-col items-center justify-center">
        <div className="flex w-4/5 items-center justify-between">
          <button disabled={specIndex <= 0} onClick={onClickBackArrow} aria-label="back-arrow">
            <ArrowBackIcon disabled={specIndex <= 0} />
          </button>
          <h1 className="text-center text-4xl font-medium">{currentPage?.title}</h1>
          <button disabled={!nextPageExists} onClick={onClickForwardArrow} aria-label="forward-arrow">
            <ArrowForwardIcon disabled={!nextPageExists} />
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
      {getImageBody()}
    </>
  );
};

const imageIsSmallEnoughForSideBySide = async (image: string) => {
  const img = new Image();
  img.src = image;
  await img.decode();

  return 3 * img.naturalWidth < window.innerWidth;
};

const getViewType = async (images: RouterOutput['fetchCurrentPage']['images']) => {
  if (images.length === 1) {
    return undefined;
  }
  const firstImage = images[0].base64;
  const shouldViewSideBySide = await imageIsSmallEnoughForSideBySide(firstImage);
  return shouldViewSideBySide ? ViewType.SIDE_BY_SIDE : undefined;
};
