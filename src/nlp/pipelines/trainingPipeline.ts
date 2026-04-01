import { evaluateModel } from '../models/evaluate';
import { trainModel } from '../models/train';

export const runTrainingPipeline = (): Record<string, unknown> => {
  const train = trainModel();
  const evalResult = evaluateModel();

  return {
    train,
    eval: evalResult
  };
};

if (require.main === module) {
  console.log(runTrainingPipeline());
}
