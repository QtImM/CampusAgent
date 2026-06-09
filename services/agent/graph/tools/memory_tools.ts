import { getAllUserFacts, saveMemoryFact } from '../../memory';

export const readMemoryFactsTool = (userId: string) => getAllUserFacts(userId);
export const writeMemoryFactTool = (userId: string, key: string, value: string) =>
    saveMemoryFact(userId, key, value);
