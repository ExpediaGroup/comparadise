import * as React from 'react';
import { Fragment, useContext, useState } from 'react';
import { Error } from './error';
import {
  BaseImageStateContext,
  UpdateBaseImagesTexts,
  UpdateBaseImagesText,
} from '../providers/base-image-state-provider';
import { trpc } from '../utils/trpc';
import { Dialog, Transition } from '@headlessui/react';
import { PrimaryButton, TertiaryButton } from './buttons';
import { useSearchParams } from 'react-router-dom';

export const UpdateImagesButton = () => {
  const [dialogIsOpen, setDialogIsOpen] = useState(false);
  const { baseImageState, setBaseImageState } = useContext(
    BaseImageStateContext,
  );

  const { error: updateBaseImagesError, mutateAsync: updateBaseImages } =
    trpc.updateBaseImages.useMutation();
  const { error: updateCommitStatusError, mutateAsync: updateCommitStatus } =
    trpc.updateCommitStatus.useMutation();

  const [searchParams] = useSearchParams();
  const params: Record<string, string | undefined> = Object.fromEntries(
    searchParams.entries(),
  );
  const { hash, bucket, repo, owner } = params;
  if (!hash || !bucket || !owner || !repo) {
    return null;
  }

  const handleDialogOpen = () => {
    setDialogIsOpen(true);
  };

  const handleDialogClose = () => {
    setDialogIsOpen(false);
  };

  const handleUpdate = async () => {
    setBaseImageState?.(UpdateBaseImagesTexts.UPDATING);
    await updateBaseImages({ hash, bucket, owner, repo });
    await updateCommitStatus({ hash, owner, repo });
    setDialogIsOpen(false);
    setBaseImageState?.(UpdateBaseImagesTexts.UPDATED);
  };

  const error = updateBaseImagesError || updateCommitStatusError;
  if (error) {
    setBaseImageState?.(UpdateBaseImagesTexts.ERROR);
  }

  const dialogTitleText = 'Are you sure you want to update the base images?';
  const updateText =
    'WARNING: This will update the base images in S3 and will set the visual regression status to passed. You can only do this if you are about to merge your PR and all other checks have passed.';
  const dialogContent = (
    <>
      <Dialog.Title as="h3" className="mt-2 text-xl font-semibold leading-6">
        {dialogTitleText}
      </Dialog.Title>
      <Dialog.Description className="mt-5 text-lg font-semibold text-slate-500">
        {updateText}
      </Dialog.Description>

      <div className="mt-5 flex justify-end">
        <PrimaryButton autoFocus onClick={handleUpdate}>
          Update
        </PrimaryButton>
        <TertiaryButton className="ml-3" onClick={handleDialogClose}>
          Cancel
        </TertiaryButton>
      </div>
    </>
  );
  const dialogLoadingContent = (
    <div className="flex" aria-label="loader">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 20 20"
        fill="currentColor"
        className="mr-2.5 h-5 w-5 animate-spin"
      >
        <path
          fillRule="evenodd"
          d="M15.312 11.424a5.5 5.5 0 01-9.201 2.466l-.312-.311h2.433a.75.75 0 000-1.5H3.989a.75.75 0 00-.75.75v4.242a.75.75 0 001.5 0v-2.43l.31.31a7 7 0 0011.712-3.138.75.75 0 00-1.449-.39zm1.23-3.723a.75.75 0 00.219-.53V2.929a.75.75 0 00-1.5 0V5.36l-.31-.31A7 7 0 003.239 8.188a.75.75 0 101.448.389A5.5 5.5 0 0113.89 6.11l.311.31h-2.432a.75.75 0 000 1.5h4.243a.75.75 0 00.53-.219z"
          clipRule="evenodd"
        />
      </svg>
      <Dialog.Title
        as="h3"
        className="text-lg font-medium leading-6 text-gray-900"
      >
        Updating base images...
      </Dialog.Title>
    </div>
  );
  const dialogErrorContent = error && <Error error={error} />;
  const getDialogContent = (state?: UpdateBaseImagesText) => {
    switch (state) {
      case UpdateBaseImagesTexts.NOT_UPDATED:
        return dialogContent;
      case UpdateBaseImagesTexts.ERROR:
        return dialogErrorContent;
      default:
        return dialogLoadingContent;
    }
  };

  const shouldDisableBaseImageButton =
    baseImageState !== UpdateBaseImagesTexts.NOT_UPDATED;

  return (
    <>
      <PrimaryButton
        disabled={shouldDisableBaseImageButton}
        onClick={handleDialogOpen}
      >
        {baseImageState}
      </PrimaryButton>
      <Transition appear show={dialogIsOpen} as={Fragment}>
        <Dialog as="div" className="relative z-10" onClose={handleDialogClose}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black bg-opacity-25" />
          </Transition.Child>

          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4 text-center">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-lg transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
                  {getDialogContent(baseImageState)}
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>
    </>
  );
};
