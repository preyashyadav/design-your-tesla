declare module '@react-native-async-storage/async-storage' {
  type AsyncStorageShape = {
    getItem: (key: string) => Promise<string | null>;
    removeItem: (key: string) => Promise<void>;
    setItem: (key: string, value: string) => Promise<void>;
  };

  const AsyncStorage: AsyncStorageShape;
  export default AsyncStorage;
}
