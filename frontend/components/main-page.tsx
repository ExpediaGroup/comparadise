import * as React from 'react';
import { LandingPage } from './landing-page';
import { Error } from './error';
import { Loader } from './loader';
import { ViewToggle, ViewType } from './view-toggle';
import { UpdateImagesButton } from './update-images-button';
import { SideBySideImageView, SingleImageView } from './image-views';
import { BaseImageStateProvider } from '../providers/BaseImageStateProvider';
import { RouterOutput, trpc } from '../utils/trpc';
import { useQueryParams } from 'use-query-params';
import { URL_PARAMS } from '../constants';
import { ArrowBackButton, ArrowForwardButton } from './arrows';

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
      <div key={name} style={{ width: '100%', display: 'flex', justifyContent: 'center', flexDirection: 'column' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '80%' }}>
            <button disabled={specIndex <= 0} onClick={onClickBackArrow}>
              <ArrowBackButton />
            </button>
            <h1 style={{ textAlign: 'center' }}>{name}</h1>
            <button disabled={isLastSpec} onClick={onClickForwardArrow}>
              <ArrowForwardButton />
            </button>
          </div>
          <UpdateImagesButton />
          <ViewToggle selectedView={selectedView} onSelectView={setSelectedView} />
        </div>
        {imageView}
      </div>
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
