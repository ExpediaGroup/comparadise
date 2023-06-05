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

export const MainPage = () => {
  const [{ hash, bucket }] = useQueryParams(URL_PARAMS);

  const [specIndex, setSpecIndex] = React.useState(0);
  const [selectedView, setSelectedView] = React.useState<ViewType | undefined>();
  const [singleImageViewIndex, setSingleImageViewIndex] = React.useState(0);

  if (!hash || !bucket) {
    return <LandingPage />;
  }

  const { data: groupedImages, isLoading, error } = trpc.getGroupedImages.useQuery({ hash, bucket });

  if (error) {
    return <Error error={error} />;
  }

  if (isLoading || !groupedImages) {
    return <Loader />;
  }

  const onClickBackArrow = async () => {
    setSpecIndex(specIndex - 1);
    const viewType = await getViewTypeForSpec(groupedImages[specIndex - 1]);
    setSelectedView(viewType);
  };

  const onClickForwardArrow = async () => {
    setSpecIndex(specIndex + 1);
    const viewType = await getViewTypeForSpec(groupedImages[specIndex + 1]);
    setSelectedView(viewType);
  };

  const containers = groupedImages?.map(({ name, entries }) => {
    const imageView =
      selectedView === ViewType.SIDE_BY_SIDE ? (
        <SideBySideImageView responseEntries={entries} />
      ) : (
        <SingleImageView responseEntries={entries} selectedImageIndex={singleImageViewIndex} onSelectImage={setSingleImageViewIndex} />
      );

    const isLastSpec = specIndex >= groupedImages.length - 1;
    return (
      <>
        <div key={name} className="mt-10 flex flex-col items-center justify-center">
          <div className="flex w-4/5 items-center justify-between">
            <button disabled={specIndex <= 0} onClick={onClickBackArrow} aria-label="back-arrow">
              <ArrowBackIcon disabled={specIndex <= 0} />
            </button>
            <h1 className="text-center text-4xl font-medium">{name}</h1>
            <button disabled={isLastSpec} onClick={onClickForwardArrow} aria-label="forward-arrow">
              <ArrowForwardIcon disabled={isLastSpec} />
            </button>
          </div>
          <div className="mt-8">
            <UpdateImagesButton />
          </div>
          <div className="mt-5">
            <ViewToggle selectedView={selectedView} onSelectView={setSelectedView} />
          </div>
        </div>
        <div className="mt-8">{imageView}</div>
      </>
    );
  });

  return (
    <div>
      <BaseImageStateProvider>{containers?.[specIndex]}</BaseImageStateProvider>
    </div>
  );
};

const imageIsSmallEnoughForSideBySide = async (image: string) => {
  const img = new Image();
  img.src = image;
  await img.decode();

  return 3 * img.naturalWidth < window.innerWidth;
};

const getViewTypeForSpec = async (spec: RouterOutput['getGroupedImages'][number]) => {
  if (spec.entries.length === 1) {
    return undefined;
  }
  const { image } = spec.entries[0];
  const shouldViewSideBySide = await imageIsSmallEnoughForSideBySide(image);
  return shouldViewSideBySide ? ViewType.SIDE_BY_SIDE : undefined;
};
