import * as ImagePicker from "expo-image-picker";

type ImageLibraryOptions = NonNullable<Parameters<typeof ImagePicker.launchImageLibraryAsync>[0]>;
type AndroidImageLibraryOptions = Omit<ImageLibraryOptions, "mediaTypes"> & { mediaTypes: string[] };

export function launchSellerImageLibraryAsync(options: Omit<ImageLibraryOptions, "mediaTypes"> = {}) {
  const nativeOptions: AndroidImageLibraryOptions = {
    ...options,
    mediaTypes: ["images"],
  };

  return ImagePicker.launchImageLibraryAsync(nativeOptions as unknown as ImageLibraryOptions);
}
