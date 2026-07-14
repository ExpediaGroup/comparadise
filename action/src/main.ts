import { setFailed } from '@actions/core';
import { run } from './run';

// A thrown error is the sole failure signal for the manifest workflows (e.g. a
// missing ancestor manifest or a stale-changeset conflict); route it to
// setFailed here so it is reported exactly once rather than surfacing as an
// unhandled promise rejection.
run().catch(setFailed);
