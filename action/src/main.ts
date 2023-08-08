import {info} from "@actions/core";

info('The current run number:');
info(process.env.GITHUB_RUN_ATTEMPT ?? 'No run attempt');
