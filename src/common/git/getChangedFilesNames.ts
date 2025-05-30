import { exec } from 'child_process';
import { join } from 'path';

import { getGitHubEnvVariables, getGitLabEnvVariables, gitAzdevEnvVariables } from '../../config';
import { PlatformOptions } from '../types';
import { logger } from '../utils/logger';

export const getDiffCommand = (isCi: string | undefined,workSpace: string | undefined): string => {
  const diffOptions = '--diff-filter=AMRT -U0';

  if (isCi === PlatformOptions.GITHUB) {
    const { githubSha, baseSha } = getGitHubEnvVariables();
    return `git diff ${diffOptions} ${baseSha} ${githubSha}`;
  }

  if (isCi === PlatformOptions.GITLAB) {
    const { gitlabSha, mergeRequestBaseSha } = getGitLabEnvVariables();
    return `git diff ${diffOptions} ${mergeRequestBaseSha} ${gitlabSha}`;
  }

  if (isCi === PlatformOptions.AZDEV) {
    const { azdevSha, baseSha } = gitAzdevEnvVariables();
    return `git diff ${diffOptions} ${baseSha} ${azdevSha}`;
  }
  if (isCi === PlatformOptions.LOCAL) {
    return `git -C ${workSpace} diff HEAD`;
  }

  throw new Error('Invalid CI platform');
};

export const getGitRootWorkSpace = (workSpace: string | undefined): Promise<string> => {
  return new Promise((resolve, reject) => {
    if (!workSpace) {
      return reject(new Error('Workspace path is undefined'));
    }

    // Combine both commands into one shell execution
    const command = `git -C "${workSpace}" rev-parse --show-toplevel`;

    logger.debug('Executing command:', command);

    exec(command, (error, stdout, stderr) => {
      if (error) {
        const errorMsg = `Failed to find git root in ${workSpace}. ` +
            `Make sure the directory exists and is a Git repository. ` +
            `Error: ${stderr || error.message}`;
        return reject(new Error(errorMsg));
      }

      const gitRoot = stdout.trim();
      if (!gitRoot) {
        return reject(new Error('Git root path is empty'));
      }

      resolve(gitRoot);
    });
  });
};

export const getGitRoot = (): Promise<string> => {
  return new Promise((resolve, reject) => {
      exec('git rev-parse --show-toplevel', (error, stdout) => {
        if (error) {
          reject(new Error(`Failed to find git root. Error: ${error.message}`));
        } else {
          resolve(stdout.trim());
        }
      });
    });
};

export const getChangedFilesNames = async (isCi: string | undefined, workSpace:string|undefined): Promise<string[]> => {
  const gitRoot = await getGitRoot();
  logger.debug('gitRoot', gitRoot);
  const nameOnlyCommand = getDiffCommand(isCi,workSpace).replace('-U0', '--name-only');
  logger.debug('nameOnlyCommand', nameOnlyCommand);
  return new Promise((resolve, reject) => {
    exec(nameOnlyCommand, { cwd: gitRoot }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(`Failed to execute command. Error: ${error.message}`));
      } else if (stderr) {
        reject(new Error(`Command execution error: ${stderr}`));
      } else {
        const files = stdout
          .split('\n')
          .filter((fileName) => fileName.trim() !== '')
          .map((fileName) => join(gitRoot, fileName.trim()));
        resolve(files);
      }
    });
  });
};
