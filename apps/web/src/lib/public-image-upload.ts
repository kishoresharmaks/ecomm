import { indihubFetch, type IndihubAuthHeaders } from "./api";

export type PublicImageUploadPurpose =
  | "SELLER_LOGO"
  | "SELLER_BANNER"
  | "SELLER_PRODUCT_IMAGE"
  | "ADMIN_BANNER"
  | "CATEGORY_IMAGE";

export type PublicImageUploadResult = {
  secureUrl: string;
  assetKey: string;
  publicId: string;
  width?: number;
  height?: number;
  bytes?: number;
  format?: string;
};

type ImageKitUploadRequest = {
  provider: "imagekit";
  urlEndpoint: string;
  publicKey: string;
  token: string;
  expire: number;
  signature: string;
  assetKey: string;
  folder: string;
  fileName: string;
};

type S3UploadRequest = {
  provider: "s3";
  method: "PUT";
  uploadUrl: string;
  assetKey: string;
  headers?: Record<string, string>;
};

type PublicImageUploadRequest = ImageKitUploadRequest | S3UploadRequest;

type UploadOptions = {
  publicId?: string;
  onProgress?: (progress: number) => void;
};

const maxImageBytes = 5 * 1024 * 1024;
const allowedImageTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

// Recommended image dimensions for consistent display
const RECOMMENDED_PRODUCT_IMAGE_WIDTH = 800;
const RECOMMENDED_PRODUCT_IMAGE_HEIGHT = 600;
const MIN_PRODUCT_IMAGE_WIDTH = 400;
const MIN_PRODUCT_IMAGE_HEIGHT = 300;
const MAX_PRODUCT_IMAGE_WIDTH = 2000;
const MAX_PRODUCT_IMAGE_HEIGHT = 1500;

export function validatePublicImageFile(file: File) {
  if (!allowedImageTypes.has(file.type)) {
    throw new Error("Upload a JPG, PNG, WebP, or GIF image.");
  }

  if (file.size > maxImageBytes) {
    throw new Error("Image must be 5 MB or smaller.");
  }
}

export async function validateImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.width, height: img.height });
    };
    
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Unable to read image dimensions."));
    };
    
    img.src = url;
  });
}

export function validateProductImageDimensions(width: number, height: number): void {
  if (width < MIN_PRODUCT_IMAGE_WIDTH || height < MIN_PRODUCT_IMAGE_HEIGHT) {
    throw new Error(
      `Image too small. Minimum dimensions: ${MIN_PRODUCT_IMAGE_WIDTH}x${MIN_PRODUCT_IMAGE_HEIGHT}px. ` +
      `Recommended: ${RECOMMENDED_PRODUCT_IMAGE_WIDTH}x${RECOMMENDED_PRODUCT_IMAGE_HEIGHT}px.`
    );
  }
  
  if (width > MAX_PRODUCT_IMAGE_WIDTH || height > MAX_PRODUCT_IMAGE_HEIGHT) {
    throw new Error(
      `Image too large. Maximum dimensions: ${MAX_PRODUCT_IMAGE_WIDTH}x${MAX_PRODUCT_IMAGE_HEIGHT}px. ` +
      `Recommended: ${RECOMMENDED_PRODUCT_IMAGE_WIDTH}x${RECOMMENDED_PRODUCT_IMAGE_HEIGHT}px.`
    );
  }
  
  // Check aspect ratio (should be close to 4:3 for product images)
  const aspectRatio = width / height;
  const targetAspectRatio = RECOMMENDED_PRODUCT_IMAGE_WIDTH / RECOMMENDED_PRODUCT_IMAGE_HEIGHT;
  const aspectRatioTolerance = 0.3;
  
  if (Math.abs(aspectRatio - targetAspectRatio) > aspectRatioTolerance) {
    console.warn(
      `Image aspect ratio (${width}:${height}) differs from recommended ratio ` +
      `(${RECOMMENDED_PRODUCT_IMAGE_WIDTH}:${RECOMMENDED_PRODUCT_IMAGE_HEIGHT}). ` +
      `Images may appear cropped or distorted.`
    );
  }
}

export async function uploadPublicImage(
  auth: IndihubAuthHeaders,
  file: File,
  purpose: PublicImageUploadPurpose,
  options: UploadOptions = {},
) {
  validatePublicImageFile(file);

  // Validate dimensions for product images
  if (purpose === "SELLER_PRODUCT_IMAGE") {
    const dimensions = await validateImageDimensions(file);
    validateProductImageDimensions(dimensions.width, dimensions.height);
  }

  const uploadRequest = await indihubFetch<PublicImageUploadRequest>(
    "/api/storage/public-image/upload-request",
    {
      method: "POST",
      body: JSON.stringify({
        purpose,
        fileName: file.name,
        contentType: file.type,
        sizeBytes: file.size,
        ...(options.publicId ? { publicId: options.publicId } : {}),
      }),
    },
    auth,
  );

  if (uploadRequest.provider === "s3") {
    return uploadS3Image(file, uploadRequest, options.onProgress);
  }

  return uploadImageKitImage(file, uploadRequest, options.onProgress);
}

function uploadImageKitImage(
  file: File,
  request: ImageKitUploadRequest,
  onProgress?: (progress: number) => void,
) {
  const body = new FormData();
  body.set("file", file);
  body.set("fileName", request.fileName);
  body.set("publicKey", request.publicKey);
  body.set("signature", request.signature);
  body.set("expire", String(request.expire));
  body.set("token", request.token);
  body.set("folder", request.folder);
  body.set("useUniqueFileName", "false");

  return new Promise<PublicImageUploadResult>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "https://upload.imagekit.io/api/v1/files/upload");

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };

    xhr.onload = () => {
      const payload = parseImageKitResponse(xhr.responseText);
      if (xhr.status < 200 || xhr.status >= 300) {
        reject(new Error(payload.message ?? "Image upload failed."));
        return;
      }

      resolve({
        secureUrl: payload.url ?? `${request.urlEndpoint.replace(/\/+$/, "")}/${request.assetKey}`,
        assetKey: request.assetKey,
        publicId: request.assetKey,
        ...(payload.width !== undefined ? { width: payload.width } : {}),
        ...(payload.height !== undefined ? { height: payload.height } : {}),
        ...(payload.size !== undefined ? { bytes: payload.size } : {}),
        ...(payload.fileType ? { format: payload.fileType.toLowerCase() } : {}),
      });
    };

    xhr.onerror = () => reject(new Error("Unable to reach the image upload service."));
    xhr.send(body);
  });
}

function uploadS3Image(file: File, uploadRequest: S3UploadRequest, onProgress?: (progress: number) => void) {
  return new Promise<PublicImageUploadResult>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open(uploadRequest.method, uploadRequest.uploadUrl);

    Object.entries(uploadRequest.headers ?? {}).forEach(([key, value]) => {
      request.setRequestHeader(key, value);
    });

    request.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };

    request.onload = () => {
      if (request.status < 200 || request.status >= 300) {
        reject(new Error("Image upload failed."));
        return;
      }

      const format = file.type.split("/").at(1);

      resolve({
        secureUrl: "",
        assetKey: uploadRequest.assetKey,
        publicId: uploadRequest.assetKey,
        bytes: file.size,
        ...(format ? { format } : {}),
      });
    };

    request.onerror = () => reject(new Error("Unable to reach the image upload service."));
    request.send(file);
  });
}

function parseImageKitResponse(value: string) {
  try {
    return JSON.parse(value) as {
      url?: string;
      width?: number;
      height?: number;
      size?: number;
      fileType?: string;
      message?: string;
    };
  } catch {
    return {};
  }
}
