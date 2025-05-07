import {getGitRoot, getGitRootWorkSpace} from '../../common/git/getChangedFilesNames';
import type { ReviewFile } from '../../common/types';
import { createFileInfo } from './fileInfo';
import { instructionPrompt } from './prompts';
import { getLanguageName } from './utils/fileLanguage';

export const constructPrompt = async (
  files: ReviewFile[],
  reviewLanguage: string,
  workSpace: string | undefined
): Promise<string> => {
  const workspaceRoot = await getGitRootWorkSpace(workSpace);

  const languageName = files.length > 0 ? getLanguageName(files[0].fileName) : 'default';

  const languageToInstructionPrompt = instructionPrompt
    .replace('{ProgrammingLanguage}', languageName)
    .replace('{ReviewLanguage}', reviewLanguage);

  const fileInfo = createFileInfo(files);

  return `${languageToInstructionPrompt}\n${fileInfo}`;
};
