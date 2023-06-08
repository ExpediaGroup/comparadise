import * as React from 'react';
import { LandingPage } from './landing-page';
import { Error } from './error';
import { Loader } from './loader';
import { ViewToggle, ViewType } from './view-toggle';
import { UpdateImagesButton } from './update-images-button';
import { SideBySideImageView, SingleImageView } from './image-views';
import { BaseImageStateProvider } from '../providers/base-image-state-provider';
import { RouterOutput, trpc } from '../utils/trpc';
import { useQueryParams } from 'use-query-params';
import { URL_PARAMS } from '../constants';
import { ArrowBackIcon, ArrowForwardIcon } from './arrows';
import {useEffect} from "react";

export const MainPage = () => {
  const [{ hash, bucket }] = useQueryParams(URL_PARAMS);

  const [specIndex, setSpecIndex] = React.useState(0);
  const [viewType, setViewType] = React.useState<ViewType | undefined>();
  const [singleImageViewIndex, setSingleImageViewIndex] = React.useState(0);

  if (!hash || !bucket) {
    return <LandingPage />;
  }

  const { data: groupedKeys, isLoading: isLoadingKeys, error: keysError } = trpc.getGroupedKeys.useQuery({ hash, bucket });

  const currentKeys = groupedKeys?.[specIndex].keys ?? [];
  const { data: images, isLoading, error: imageError } = trpc.getImages.useQuery({ keys: currentKeys, bucket }, { enabled: !isLoadingKeys });

  const utils = trpc.useContext();
  useEffect(() => {
    if (images) {
      getViewType(images).then(viewType => {
        setViewType(viewType);
      });
    }
  }, [images]);

  const error = keysError || imageError;
  if (error) {
    return <Error error={error} />;
  }

  if (isLoading || !groupedKeys || !images) {
    return <Loader />;
  }

  const onClickBackArrow = async () => {
    setSpecIndex(specIndex - 1);
    utils.getImages.invalidate({ bucket, keys: currentKeys });
  };

  const onClickForwardArrow = async () => {
    setSpecIndex(specIndex + 1);
  };

  const imageView =
    viewType === ViewType.SIDE_BY_SIDE ? (
      <SideBySideImageView images={images} />
    ) : (
      <SingleImageView images={images} selectedImageIndex={singleImageViewIndex} onSelectImage={setSingleImageViewIndex} />
    );

  const { title } = groupedKeys[specIndex];

  const isLastSpec = specIndex >= images.length - 1;

  return (
    <BaseImageStateProvider>
      <>
        <div className="mt-10 flex flex-col items-center justify-center">
          <div className="flex w-4/5 items-center justify-between">
            <button disabled={specIndex <= 0} onClick={onClickBackArrow} aria-label="back-arrow">
              <ArrowBackIcon disabled={specIndex <= 0} />
            </button>
            <h1 className="text-center text-4xl font-medium">{title}</h1>
            <button disabled={isLastSpec} onClick={onClickForwardArrow} aria-label="forward-arrow">
              <ArrowForwardIcon disabled={isLastSpec} />
            </button>
          </div>
          <div className="mt-8">
            <UpdateImagesButton />
          </div>
          <div className="mt-5">
            <ViewToggle selectedView={viewType} onSelectView={setViewType} />
          </div>
        </div>
        <div className="mt-8">{imageView}</div>
      </>
    </BaseImageStateProvider>
  );
};

const imageIsSmallEnoughForSideBySide = async (image: string) => {
  const img = new Image();
  img.src = image;
  await img.decode();

  return 3 * img.naturalWidth < window.innerWidth;
};

const getViewType = async (images: RouterOutput['getImages']) => {
  if (images.length === 1) {
    return undefined;
  }
  const firstImage = images[0].base64;
  const shouldViewSideBySide = await imageIsSmallEnoughForSideBySide(firstImage);
  return shouldViewSideBySide ? ViewType.SIDE_BY_SIDE : undefined;
};
