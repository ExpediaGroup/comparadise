import * as React from 'react';
import { useState, useContext } from 'react';
import { Error } from './error';
import { BaseImageStateContext, UpdateBaseImagesText } from '../providers/BaseImageStateProvider';
import { trpc } from '../utils/trpc';
import { useQueryParams } from 'use-query-params';
import { URL_PARAMS } from '../constants';
import { Dialog } from '@headlessui/react';

const UPDATE_TEXT =
  'Doing so will update the base images in S3 and will set visual regression status to passed! You should only do this if you are about to merge your PR.';

export const UpdateImagesButton = () => {
  const [{ hash, bucket, repo, owner, baseImagesDirectory }] = useQueryParams(URL_PARAMS);
  const [dialogIsOpen, setDialogIsOpen] = useState(false);
  const { baseImageState, setBaseImageState } = useContext(BaseImageStateContext);

  const { error: updateBaseImagesError, mutateAsync: updateBaseImages } = trpc.updateBaseImages.useMutation();
  const { error: updateCommitStatusError, mutateAsync: updateCommitStatus } = trpc.updateCommitStatus.useMutation();

  if (!hash || !bucket) {
    return null;
  }

  const handleDialogOpen = () => {
    setDialogIsOpen(true);
  };

  const handleDialogClose = () => {
    setDialogIsOpen(false);
  };

  const handleUpdate = async () => {
    setBaseImageState?.(UpdateBaseImagesText.UPDATING);
    await updateBaseImages({ hash, bucket, baseImagesDirectory });
    if (repo && owner) {
      await updateCommitStatus({ hash, owner, repo });
    }
    setDialogIsOpen(false);
    setBaseImageState?.(UpdateBaseImagesText.UPDATED);
  };

  const error = updateBaseImagesError || updateCommitStatusError;
  if (error) {
    return <Error error={error} />;
  }

  const dialogContentText = baseImagesDirectory
    ? `Custom base image directory in use. This will update the base images in ${baseImagesDirectory}`
    : 'Are you sure you want to update the base images?';

  const baseImageUpdateStarted = baseImageState === UpdateBaseImagesText.UPDATING || baseImageState === UpdateBaseImagesText.UPDATED;

  return (
    <div>
      <button
        disabled={baseImageUpdateStarted}
        onClick={handleDialogOpen}
        className="rounded-md bg-black bg-opacity-20 px-4 py-2 text-sm font-medium text-white hover:bg-opacity-30 focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-opacity-75"
      >
        {baseImageState}
      </button>
      {baseImagesDirectory && <p>Custom base image directory {baseImagesDirectory} in use</p>}
      <Dialog onClose={handleDialogClose} open={dialogIsOpen}>
        <Dialog.Panel>
          <Dialog.Title>{baseImageState === UpdateBaseImagesText.UPDATING ? 'Updating base images...' : dialogContentText}</Dialog.Title>
          <Dialog.Description>{!baseImagesDirectory && UPDATE_TEXT}</Dialog.Description>
          {UpdateBaseImagesText.UPDATING && <div aria-label="loader" />}
          <button autoFocus onClick={handleUpdate}>
            Update
          </button>
          <button onClick={handleDialogClose}>Cancel</button>
        </Dialog.Panel>
      </Dialog>
    </div>
  );
};

export default UpdateImagesButton;
