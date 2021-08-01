export {};

declare global {
  let prettierPlugins: {
    [key: string]: {
      parsers: {
        [key: string]: any;
      };
    };
  };
}
