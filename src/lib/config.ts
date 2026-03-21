import { config as loadDotEnv } from 'dotenv';

export type AppConfig = {
  tflAppKey: string | undefined;
};

export const loadConfig = (): AppConfig => {
  loadDotEnv({
    quiet: true,
  });

  const tflAppKey = firstDefinedValue([
    process.env['TFL_APP_KEY'],
  ]);

  return {
    tflAppKey,
  };
};

const firstDefinedValue = (values: Array<string | undefined>): string | undefined =>
  values.map((value) => value?.trim()).find((value) => Boolean(value));
