import { exec } from 'child_process';
import { tool } from 'ai';
import { z } from 'zod';
import { getDiffCommand } from '../../git/getChangedFilesNames';
import type { PlatformProvider } from '../../platform/provider';
import { logger } from '../../utils/logger';
import { exit } from 'process';

export const createReadDiffTool = (platformProvider: PlatformProvider, workSpace: string | undefined) =>
  tool({
    description:
      'Generate a diff for a file. This tool shows changes made to a file which should be reviewed. Use in conjunction with read_file to read the current state of a file.',
    parameters: z.object({
      path: z.string().describe('The absolute path to the file to generate a diff for'),
    }),
    execute: async ({ path }) => {
      try {
        const platformOption = platformProvider.getPlatformOption();
        const diffCommandBase = getDiffCommand(platformOption, workSpace);
        const diffCommand = `${diffCommandBase} -- "${path}"`;

          let rawCombinedDiff = await new Promise<string>((resolve, reject) => {
          // Use exec like other git commands in the codebase
          exec(diffCommand, { maxBuffer: 1024 * 1024 * 10 }, (error, stdout, stderr) => {
            if (error && error.code !== 0 && error.code !== 1) {
              // Git diff can exit with code 1 when there are differences
              logger.warn(`Git diff HEAD error: ${error.message}`);
            }

            if (stderr) {
              logger.warn(`Git diff HEAD stderr: ${stderr}`);
            }

            resolve(stdout);
          });
        });
        if (!rawCombinedDiff.trim()) {
          rawCombinedDiff = await new Promise<string>((resolve, reject) => {
            // Consider increasing maxBuffer for very large diffs
            exec(
                `git -C ${workSpace} diff -- ${path}`,
                { maxBuffer: 1024 * 1024 * 10 }, // 10MB buffer
                (error, stdout, stderr) => {
                  if (error) {
                    return reject(new Error(`Failed to execute git diff. Error: ${error.message}`));
                  }
                  // stderr might contain non-error messages from git
                  if (stderr?.toLowerCase().includes('error')) {
                    logger.error('Git diff command stderr error:', stderr);
                    // Decide if stderr errors should be fatal
                    // return reject(new Error(`Git diff command error: ${stderr}`));
                  } else if (stderr) {
                    logger.debug('Git diff command stderr info:', stderr);
                  }
                  resolve(stdout);
                }
            );
          });
          if (!rawCombinedDiff.trim()) {
              logger.warn(
                  'No changes found between refs. Ensure changes are staged (if local) or refs are correct (if CI).'
              );
              exit(0);
          }
        }
        return rawCombinedDiff;
      } catch (error) {
        logger.error(`Failed to generate diff: ${error}`);
        return `Error generating diff: ${error instanceof Error ? error.message : String(error)}`;
      }
    },
  });
