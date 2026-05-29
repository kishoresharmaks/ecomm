import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  ServiceUnavailableException,
} from "@nestjs/common";
import { createHash, createHmac, randomBytes } from "node:crypto";
import { Prisma, RoleCode, SettingValueType } from "@indihub/database";
import type { RequestUser } from "../auth/types/indihub-request";
import { PrismaService } from "../prisma/prisma.service";
import { readBooleanSetting } from "../settings/setting-value-utils";
import { safeStorageFolderSegment } from "./storage-image";
import { PublicImageUploadPurpose } from "./dto/public-image-upload.dto";
import {
  PrivateDocumentUploadRequestDto,
  PublicImageUploadRequestDto,
  UpsertStorageConfigurationDto,
} from "./dto/storage-config.dto";

const adminUploadPurposes: PublicImageUploadPurpose[] = [
  PublicImageUploadPurpose.ADMIN_BANNER,
  PublicImageUploadPurpose.CATEGORY_IMAGE,
];
const sellerUploadPurposes: PublicImageUploadPurpose[] = [
  PublicImageUploadPurpose.SELLER_LOGO,
  PublicImageUploadPurpose.SELLER_BANNER,
  PublicImageUploadPurpose.SELLER_PRODUCT_IMAGE,
];

const STORAGE_SETTING_KEYS = {
  publicImageProvider: "storage.public_images.provider",
  publicImageBaseUrl: "storage.public_images.base_url",
  publicImageKitPublicKey: "storage.public_images.imagekit.public_key",
  publicImageKitPrivateKey: "storage.public_images.imagekit.private_key",
  publicS3Endpoint: "storage.public_images.s3.endpoint",
  publicS3Region: "storage.public_images.s3.region",
  publicS3Bucket: "storage.public_images.s3.bucket",
  publicS3AccessKeyId: "storage.public_images.s3.access_key_id",
  publicS3SecretAccessKey: "storage.public_images.s3.secret_access_key",
  privateEnabled: "storage.private.enabled",
  privateEndpoint: "storage.private.endpoint",
  privateRegion: "storage.private.region",
  privateBucket: "storage.private.bucket",
  privateAccessKeyId: "storage.private.access_key_id",
  privateSecretAccessKey: "storage.private.secret_access_key",
} as const;

const storageConfigKeys = Object.values(STORAGE_SETTING_KEYS);

type StorageSettingMap = Map<string, Prisma.JsonValue>;
type StorageSettingWrite = {
  key: string;
  group: string;
  valueType: SettingValueType;
  value: Prisma.InputJsonValue;
};
type StorageSettingClient = Prisma.TransactionClient | PrismaService["client"];
type ImageKitConfig = {
  publicKey: string;
  privateKey: string;
  configured: boolean;
};

type PublicImageProvider = "IMAGEKIT" | "S3";
type PublicS3Config = {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  configured: boolean;
};

type PublicImageConfig = {
  provider: PublicImageProvider;
  baseUrl: string;
  configured: boolean;
  imageKit: ImageKitConfig;
  s3: PublicS3Config;
};
type PrivateStorageConfig = PublicS3Config & {
  enabled: boolean;
};

@Injectable()
export class StorageService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async getReadiness() {
    const settingMap = await this.storageSettingMap();
    const publicImages = this.publicImageConfigFromSettings(settingMap);
    const privateStorage = this.privateStorageConfigFromSettings(settingMap);

    return {
      publicImages: {
        provider: publicImages.provider,
        configured: publicImages.configured,
        baseUrl: publicImages.baseUrl || null,
        imageKitPublicKeyPreview: this.maskValue(publicImages.imageKit.publicKey),
        s3Bucket: publicImages.s3.bucket || null,
        s3Endpoint: publicImages.s3.endpoint || null,
        s3AccessKeyPreview: this.maskValue(publicImages.s3.accessKeyId),
      },
      privateStorage: {
        enabled: privateStorage.enabled,
        configured: privateStorage.configured,
        endpoint: privateStorage.endpoint || null,
        region: privateStorage.region || null,
        bucket: privateStorage.bucket || null,
        accessKeyPreview: this.maskValue(privateStorage.accessKeyId),
      },
    };
  }

  async adminStorageConfiguration() {
    const settingMap = await this.storageSettingMap();
    const publicImages = this.publicImageConfigFromSettings(settingMap);
    const privateStorage = this.privateStorageConfigFromSettings(settingMap);

    return {
      publicImages: {
        provider: publicImages.provider,
        configured: publicImages.configured,
        baseUrl: publicImages.baseUrl,
        imageKit: {
          configured: publicImages.imageKit.configured,
          publicKey: publicImages.imageKit.publicKey,
          publicKeyConfigured: Boolean(publicImages.imageKit.publicKey),
          publicKeyPreview: this.maskValue(publicImages.imageKit.publicKey),
          privateKeyConfigured: Boolean(publicImages.imageKit.privateKey),
        },
        s3: {
          configured: publicImages.s3.configured,
          endpoint: publicImages.s3.endpoint,
          region: publicImages.s3.region,
          bucket: publicImages.s3.bucket,
          accessKeyId: publicImages.s3.accessKeyId,
          accessKeyIdConfigured: Boolean(publicImages.s3.accessKeyId),
          accessKeyPreview: this.maskValue(publicImages.s3.accessKeyId),
          secretAccessKeyConfigured: Boolean(publicImages.s3.secretAccessKey),
        },
      },
      privateStorage: {
        enabled: privateStorage.enabled,
        configured: privateStorage.configured,
        endpoint: privateStorage.endpoint,
        region: privateStorage.region,
        bucket: privateStorage.bucket,
        accessKeyId: privateStorage.accessKeyId,
        accessKeyIdConfigured: Boolean(privateStorage.accessKeyId),
        accessKeyPreview: this.maskValue(privateStorage.accessKeyId),
        secretAccessKeyConfigured: Boolean(privateStorage.secretAccessKey),
      },
    };
  }

  async updateStorageConfiguration(actor: RequestUser, dto: UpsertStorageConfigurationDto) {
    const before = await this.adminStorageConfiguration();
    const writes: StorageSettingWrite[] = [];

    if (dto.publicImages) {
      if (dto.publicImages.provider !== undefined) {
        writes.push(
          this.storageSettingWrite(
            STORAGE_SETTING_KEYS.publicImageProvider,
            "storage",
            SettingValueType.STRING,
            dto.publicImages.provider,
          ),
        );
      }
      if (dto.publicImages.baseUrl !== undefined) {
        writes.push(
          this.storageSettingWrite(
            STORAGE_SETTING_KEYS.publicImageBaseUrl,
            "storage",
            SettingValueType.STRING,
            this.normalizePublicBaseUrl(dto.publicImages.baseUrl),
          ),
        );
      }
      if (dto.publicImages.imageKit) {
        if (dto.publicImages.imageKit.publicKey !== undefined) {
          writes.push(
            this.storageSettingWrite(
              STORAGE_SETTING_KEYS.publicImageKitPublicKey,
              "storage",
              SettingValueType.STRING,
              dto.publicImages.imageKit.publicKey.trim(),
            ),
          );
        }
        if (dto.publicImages.imageKit.clearPrivateKey) {
          writes.push(
            this.storageSettingWrite(
              STORAGE_SETTING_KEYS.publicImageKitPrivateKey,
              "storage",
              SettingValueType.STRING,
              "",
            ),
          );
        } else if (dto.publicImages.imageKit.privateKey?.trim()) {
          writes.push(
            this.storageSettingWrite(
              STORAGE_SETTING_KEYS.publicImageKitPrivateKey,
              "storage",
              SettingValueType.STRING,
              dto.publicImages.imageKit.privateKey.trim(),
            ),
          );
        }
      }
      if (dto.publicImages.s3) {
        if (dto.publicImages.s3.endpoint !== undefined) {
          writes.push(
            this.storageSettingWrite(
              STORAGE_SETTING_KEYS.publicS3Endpoint,
              "storage",
              SettingValueType.STRING,
              this.normalizeStorageEndpoint(dto.publicImages.s3.endpoint),
            ),
          );
        }
        if (dto.publicImages.s3.region !== undefined) {
          writes.push(
            this.storageSettingWrite(
              STORAGE_SETTING_KEYS.publicS3Region,
              "storage",
              SettingValueType.STRING,
              dto.publicImages.s3.region.trim(),
            ),
          );
        }
        if (dto.publicImages.s3.bucket !== undefined) {
          writes.push(
            this.storageSettingWrite(
              STORAGE_SETTING_KEYS.publicS3Bucket,
              "storage",
              SettingValueType.STRING,
              dto.publicImages.s3.bucket.trim(),
            ),
          );
        }
        if (dto.publicImages.s3.accessKeyId !== undefined) {
          writes.push(
            this.storageSettingWrite(
              STORAGE_SETTING_KEYS.publicS3AccessKeyId,
              "storage",
              SettingValueType.STRING,
              dto.publicImages.s3.accessKeyId.trim(),
            ),
          );
        }
        if (dto.publicImages.s3.clearSecretAccessKey) {
          writes.push(
            this.storageSettingWrite(
              STORAGE_SETTING_KEYS.publicS3SecretAccessKey,
              "storage",
              SettingValueType.STRING,
              "",
            ),
          );
        } else if (dto.publicImages.s3.secretAccessKey?.trim()) {
          writes.push(
            this.storageSettingWrite(
              STORAGE_SETTING_KEYS.publicS3SecretAccessKey,
              "storage",
              SettingValueType.STRING,
              dto.publicImages.s3.secretAccessKey.trim(),
            ),
          );
        }
      }
    }

    if (dto.privateStorage) {
      if (dto.privateStorage.enabled !== undefined) {
        writes.push(
          this.storageSettingWrite(
            STORAGE_SETTING_KEYS.privateEnabled,
            "storage",
            SettingValueType.BOOLEAN,
            dto.privateStorage.enabled,
          ),
        );
      }
      if (dto.privateStorage.endpoint !== undefined) {
        writes.push(
          this.storageSettingWrite(
            STORAGE_SETTING_KEYS.privateEndpoint,
            "storage",
            SettingValueType.STRING,
            dto.privateStorage.endpoint.trim(),
          ),
        );
      }
      if (dto.privateStorage.region !== undefined) {
        writes.push(
          this.storageSettingWrite(
            STORAGE_SETTING_KEYS.privateRegion,
            "storage",
            SettingValueType.STRING,
            dto.privateStorage.region.trim(),
          ),
        );
      }
      if (dto.privateStorage.bucket !== undefined) {
        writes.push(
          this.storageSettingWrite(
            STORAGE_SETTING_KEYS.privateBucket,
            "storage",
            SettingValueType.STRING,
            dto.privateStorage.bucket.trim(),
          ),
        );
      }
      if (dto.privateStorage.accessKeyId !== undefined) {
        writes.push(
          this.storageSettingWrite(
            STORAGE_SETTING_KEYS.privateAccessKeyId,
            "storage",
            SettingValueType.STRING,
            dto.privateStorage.accessKeyId.trim(),
          ),
        );
      }
      if (dto.privateStorage.clearSecretAccessKey) {
        writes.push(
          this.storageSettingWrite(
            STORAGE_SETTING_KEYS.privateSecretAccessKey,
            "storage",
            SettingValueType.STRING,
            "",
          ),
        );
      } else if (dto.privateStorage.secretAccessKey?.trim()) {
        writes.push(
          this.storageSettingWrite(
            STORAGE_SETTING_KEYS.privateSecretAccessKey,
            "storage",
            SettingValueType.STRING,
            dto.privateStorage.secretAccessKey.trim(),
          ),
        );
      }
    }

    if (writes.length) {
      await this.prisma.client.$transaction(async (tx) => {
        for (const write of writes) {
          await tx.setting.upsert({
            where: { key: write.key },
            update: {
              value: write.value,
              valueType: write.valueType,
              group: write.group,
            },
            create: write,
          });
        }
      });

      const after = await this.adminStorageConfiguration();
      await this.prisma.client.auditLog.create({
        data: {
          actorUserId: actor.id,
          action: "storage.configuration.updated",
          entityType: "storage_configuration",
          oldValue: before as Prisma.InputJsonValue,
          newValue: after as Prisma.InputJsonValue,
        },
      });
    }

    return this.adminStorageConfiguration();
  }

  async createPublicImageUploadRequest(actor: RequestUser, dto: PublicImageUploadRequestDto) {
    const settingMap = await this.storageSettingMap();
    const publicImages = this.publicImageConfigFromSettings(settingMap);

    if (publicImages.provider === "S3") {
      return this.createS3PublicImageUploadRequest(actor, dto, publicImages);
    }

    if (!publicImages.imageKit.configured) {
      throw new ServiceUnavailableException(
        "ImageKit settings are required before public image uploads can be used.",
      );
    }

    return this.createImageKitUploadRequest(actor, dto, publicImages);
  }

  async createPrivateDocumentUploadRequest(
    actor: RequestUser,
    dto: PrivateDocumentUploadRequestDto,
  ) {
    const settingMap = await this.storageSettingMap();
    const privateStorage = this.privateStorageConfigFromSettings(settingMap);

    if (!privateStorage.configured) {
      throw new ServiceUnavailableException(
        "Private S3 document storage must be enabled before seller document uploads can be used.",
      );
    }

    const assetKey = this.createPrivateDocumentAssetKey(actor, dto);
    const presigned = this.presignS3Object(privateStorage, "PUT", assetKey);

    return {
      provider: "s3" as const,
      method: "PUT" as const,
      uploadUrl: presigned.url,
      assetKey,
      headers: {
        "Content-Type": dto.contentType.toLowerCase(),
      },
    };
  }

  async privateDocumentUrl(actor: RequestUser, key: string | undefined) {
    const normalizedKey = this.normalizePrivateDocumentKeyForActor(actor, key);
    const settingMap = await this.storageSettingMap();
    const privateStorage = this.privateStorageConfigFromSettings(settingMap);

    if (!privateStorage.configured) {
      throw new ServiceUnavailableException("Private S3 document storage is not configured.");
    }

    return this.presignS3Object(privateStorage, "GET", normalizedKey).url;
  }

  private createImageKitUploadRequest(
    actor: RequestUser,
    dto: PublicImageUploadRequestDto,
    publicImages: PublicImageConfig,
  ) {
    const folder = this.folderForPurpose(actor, dto.purpose);
    const assetKey = this.createPublicImageAssetKey(folder, dto);
    const fileName = assetKey.split("/").at(-1) ?? "image";
    const expire = Math.floor(Date.now() / 1000) + 900;
    const token = randomBytes(16).toString("hex");
    const signature = createHmac("sha1", publicImages.imageKit.privateKey)
      .update(`${token}${expire}`)
      .digest("hex");

    return {
      provider: "imagekit" as const,
      urlEndpoint: publicImages.baseUrl,
      publicKey: publicImages.imageKit.publicKey,
      token,
      expire,
      assetKey,
      folder,
      fileName,
      signature,
    };
  }

  async publicImageUrl(key: string | undefined) {
    const normalizedKey = this.normalizePublicImageKey(key);
    const settingMap = await this.storageSettingMap();
    const baseUrl = this.publicImageConfigFromSettings(settingMap).baseUrl;

    if (!baseUrl) {
      throw new ServiceUnavailableException("Public image base URL is not configured.");
    }

    return `${baseUrl}/${normalizedKey
      .split("/")
      .map((part) => encodeURIComponent(part))
      .join("/")}`;
  }

  private createS3PublicImageUploadRequest(
    actor: RequestUser,
    dto: PublicImageUploadRequestDto,
    publicImages: PublicImageConfig,
  ) {
    if (!publicImages.s3.configured) {
      throw new ServiceUnavailableException(
        "Public S3 image settings are required before image uploads can be used.",
      );
    }

    const folder = this.folderForPurpose(actor, dto.purpose);
    const assetKey = this.createPublicImageAssetKey(folder, dto);
    const presigned = this.presignS3Object(publicImages.s3, "PUT", assetKey);

    return {
      provider: "s3" as const,
      method: "PUT" as const,
      uploadUrl: presigned.url,
      assetKey,
      headers: {
        "Content-Type": dto.contentType.toLowerCase(),
      },
    };
  }

  private createPublicImageAssetKey(folder: string, dto: PublicImageUploadRequestDto) {
    const extension = this.imageExtension(dto.fileName, dto.contentType);
    const baseName = dto.publicId ?? this.fileNameWithoutExtension(dto.fileName);
    const safeBaseName = this.safeSegment(baseName) || "image";
    const suffix = dto.publicId ? "" : `-${Date.now()}-${randomBytes(4).toString("hex")}`;

    return this.normalizePublicImageKey(`${folder}/${safeBaseName}${suffix}${extension}`);
  }

  private createPrivateDocumentAssetKey(actor: RequestUser, dto: PrivateDocumentUploadRequestDto) {
    const folder = `indihub/sellers/${this.safeSegment(actor.id)}/documents`;
    const extension = this.documentExtension(dto.fileName, dto.contentType);
    const typeSegment = this.safeSegment(dto.documentType.toLowerCase());
    const baseName = this.safeSegment(this.fileNameWithoutExtension(dto.fileName)) || typeSegment;

    return this.normalizePublicImageKey(
      `${folder}/${typeSegment}-${baseName}-${Date.now()}-${randomBytes(4).toString("hex")}${extension}`,
    );
  }

  private presignS3Object(s3: PublicS3Config, method: "GET" | "PUT", assetKey: string) {
    const endpoint = new URL(s3.endpoint);
    const now = new Date();
    const amzDate = this.amzDate(now);
    const dateStamp = amzDate.slice(0, 8);
    const credentialScope = `${dateStamp}/${s3.region}/s3/aws4_request`;
    const credential = `${s3.accessKeyId}/${credentialScope}`;
    const signedHeaders = "host";
    const canonicalUri = this.s3CanonicalUri(endpoint.pathname, s3.bucket, assetKey);
    const queryParams: Array<[string, string]> = [
      ["X-Amz-Algorithm", "AWS4-HMAC-SHA256"],
      ["X-Amz-Credential", credential],
      ["X-Amz-Date", amzDate],
      ["X-Amz-Expires", "900"],
      ["X-Amz-SignedHeaders", signedHeaders],
    ];
    const canonicalQuery = this.canonicalQueryString(queryParams);
    const canonicalHeaders = `host:${endpoint.host}\n`;
    const canonicalRequest = [
      method,
      canonicalUri,
      canonicalQuery,
      canonicalHeaders,
      signedHeaders,
      "UNSIGNED-PAYLOAD",
    ].join("\n");
    const stringToSign = [
      "AWS4-HMAC-SHA256",
      amzDate,
      credentialScope,
      createHash("sha256").update(canonicalRequest).digest("hex"),
    ].join("\n");
    const signature = createHmac(
      "sha256",
      this.awsSigningKey(s3.secretAccessKey, dateStamp, s3.region),
    )
      .update(stringToSign)
      .digest("hex");
    const url = `${endpoint.origin}${canonicalUri}?${canonicalQuery}&X-Amz-Signature=${signature}`;

    return { url };
  }

  private folderForPurpose(actor: RequestUser, purpose: PublicImageUploadPurpose) {
    const isAdmin = actor.roles.includes(RoleCode.ADMIN);
    const isSeller = actor.roles.includes(RoleCode.SELLER);
    const actorSegment = this.safeSegment(actor.id);

    if (adminUploadPurposes.includes(purpose) && !isAdmin) {
      throw new ForbiddenException("Admin upload permission is required for this image type.");
    }

    if (sellerUploadPurposes.includes(purpose) && !isSeller && !isAdmin) {
      throw new ForbiddenException("Seller upload permission is required for this image type.");
    }

    switch (purpose) {
      case PublicImageUploadPurpose.SELLER_LOGO:
        return `indihub/sellers/${actorSegment}/profile/logo`;
      case PublicImageUploadPurpose.SELLER_BANNER:
        return `indihub/sellers/${actorSegment}/profile/banner`;
      case PublicImageUploadPurpose.SELLER_PRODUCT_IMAGE:
        return `indihub/sellers/${actorSegment}/products`;
      case PublicImageUploadPurpose.ADMIN_BANNER:
        return `indihub/admin/${actorSegment}/banners`;
      case PublicImageUploadPurpose.CATEGORY_IMAGE:
        return `indihub/admin/${actorSegment}/categories`;
    }
  }

  private safeSegment(value: string) {
    return safeStorageFolderSegment(value);
  }

  private async storageSettingMap(client: StorageSettingClient = this.prisma.client) {
    const settings = await client.setting.findMany({
      where: {
        key: {
          in: storageConfigKeys,
        },
      },
    });

    return new Map(settings.map((setting) => [setting.key, setting.value]));
  }

  private imageKitConfigFromSettings(settingMap: StorageSettingMap): ImageKitConfig {
    const publicKey = this.stringSetting(
      settingMap,
      STORAGE_SETTING_KEYS.publicImageKitPublicKey,
      process.env.IMAGEKIT_PUBLIC_KEY ?? "",
    );
    const privateKey = this.stringSetting(
      settingMap,
      STORAGE_SETTING_KEYS.publicImageKitPrivateKey,
      process.env.IMAGEKIT_PRIVATE_KEY ?? "",
    );

    return {
      publicKey,
      privateKey,
      configured: Boolean(publicKey && privateKey),
    };
  }

  private publicImageConfigFromSettings(settingMap: StorageSettingMap): PublicImageConfig {
    const provider = this.publicImageProviderFromSettings(settingMap);
    const imageKit = this.imageKitConfigFromSettings(settingMap);
    const s3 = this.publicS3ConfigFromSettings(settingMap);
    const savedBaseUrl = this.stringSetting(
      settingMap,
      STORAGE_SETTING_KEYS.publicImageBaseUrl,
      process.env.PUBLIC_IMAGE_BASE_URL ?? process.env.IMAGEKIT_URL_ENDPOINT ?? "",
    );
    const baseUrl = savedBaseUrl
      ? this.normalizePublicBaseUrl(savedBaseUrl)
      : this.defaultPublicImageBaseUrl(provider, s3);

    return {
      provider,
      baseUrl,
      imageKit,
      s3,
      configured: provider === "S3" ? Boolean(s3.configured && baseUrl) : Boolean(imageKit.configured && baseUrl),
    };
  }

  private publicImageProviderFromSettings(settingMap: StorageSettingMap): PublicImageProvider {
    const value = this.stringSetting(
      settingMap,
      STORAGE_SETTING_KEYS.publicImageProvider,
      process.env.PUBLIC_IMAGE_PROVIDER ?? "IMAGEKIT",
    ).toUpperCase();
    return value === "S3" ? "S3" : "IMAGEKIT";
  }

  private publicS3ConfigFromSettings(settingMap: StorageSettingMap): PublicS3Config {
    const endpoint = this.stringSetting(settingMap, STORAGE_SETTING_KEYS.publicS3Endpoint, "");
    const region = this.stringSetting(settingMap, STORAGE_SETTING_KEYS.publicS3Region, "");
    const bucket = this.stringSetting(settingMap, STORAGE_SETTING_KEYS.publicS3Bucket, "");
    const accessKeyId = this.stringSetting(
      settingMap,
      STORAGE_SETTING_KEYS.publicS3AccessKeyId,
      "",
    );
    const secretAccessKey = this.stringSetting(
      settingMap,
      STORAGE_SETTING_KEYS.publicS3SecretAccessKey,
      "",
    );

    return {
      endpoint,
      region,
      bucket,
      accessKeyId,
      secretAccessKey,
      configured: Boolean(endpoint && region && bucket && accessKeyId && secretAccessKey),
    };
  }

  private defaultPublicImageBaseUrl(provider: PublicImageProvider, s3: PublicS3Config) {
    if (provider === "S3" && s3.endpoint && s3.bucket) {
      return `${this.normalizeStorageEndpoint(s3.endpoint)}/${encodeURIComponent(s3.bucket)}`;
    }

    return "";
  }

  private normalizePublicBaseUrl(value: string) {
    const trimmed = value.trim().replace(/\/+$/, "");
    if (!trimmed) {
      return "";
    }

    let parsed: URL;
    try {
      parsed = new URL(trimmed);
    } catch {
      throw new BadRequestException("Public image base URL must be a valid HTTPS URL.");
    }

    if (parsed.protocol !== "https:" && parsed.hostname !== "localhost") {
      throw new BadRequestException("Public image base URL must use HTTPS.");
    }

    return trimmed;
  }

  private normalizePublicImageKey(key: string | undefined) {
    const normalized = (key ?? "").trim().replaceAll("\\", "/").replace(/^\/+/, "");

    if (
      !normalized ||
      normalized.includes("..") ||
      normalized.includes("://") ||
      normalized.split("/").some((part) => !part || !/^[a-zA-Z0-9._-]+$/.test(part))
    ) {
      throw new BadRequestException("Image key is invalid.");
    }

    return normalized;
  }

  private normalizeStorageEndpoint(value: string) {
    const trimmed = value.trim().replace(/\/+$/, "");
    if (!trimmed) {
      return "";
    }

    let parsed: URL;
    try {
      parsed = new URL(trimmed);
    } catch {
      throw new BadRequestException("Storage endpoint must be a valid HTTPS URL.");
    }

    if (parsed.protocol !== "https:" && parsed.hostname !== "localhost") {
      throw new BadRequestException("Storage endpoint must use HTTPS.");
    }

    return trimmed;
  }

  private imageExtension(fileName: string, contentType: string) {
    const fromName = fileName
      .trim()
      .toLowerCase()
      .match(/\.([a-z0-9]+)$/)?.[1];
    const extension = fromName ? `.${fromName}` : this.extensionForContentType(contentType);

    if (![".jpg", ".jpeg", ".png", ".webp", ".gif"].includes(extension)) {
      throw new BadRequestException("Image file type is not supported.");
    }

    return extension === ".jpeg" ? ".jpg" : extension;
  }

  private documentExtension(fileName: string, contentType: string) {
    const fromName = fileName
      .trim()
      .toLowerCase()
      .match(/\.([a-z0-9]+)$/)?.[1];
    const extension = fromName ? `.${fromName}` : this.extensionForDocumentContentType(contentType);

    if (![".pdf", ".jpg", ".jpeg", ".png", ".webp"].includes(extension)) {
      throw new BadRequestException("Document file type is not supported.");
    }

    return extension === ".jpeg" ? ".jpg" : extension;
  }

  private extensionForContentType(contentType: string) {
    switch (contentType.toLowerCase()) {
      case "image/jpeg":
        return ".jpg";
      case "image/png":
        return ".png";
      case "image/webp":
        return ".webp";
      case "image/gif":
        return ".gif";
      default:
        throw new BadRequestException("Image file type is not supported.");
    }
  }

  private extensionForDocumentContentType(contentType: string) {
    switch (contentType.toLowerCase()) {
      case "application/pdf":
        return ".pdf";
      case "image/jpeg":
        return ".jpg";
      case "image/png":
        return ".png";
      case "image/webp":
        return ".webp";
      default:
        throw new BadRequestException("Document file type is not supported.");
    }
  }

  private fileNameWithoutExtension(fileName: string) {
    const normalized = fileName.trim().replaceAll("\\", "/").split("/").at(-1) ?? "image";
    return normalized.replace(/\.[a-zA-Z0-9]+$/, "") || "image";
  }

  private normalizePrivateDocumentKeyForActor(actor: RequestUser, key: string | undefined) {
    const normalized = this.normalizePublicImageKey(key);
    const isAdmin = actor.roles.includes(RoleCode.ADMIN);
    const sellerPrefix = `indihub/sellers/${this.safeSegment(actor.id)}/documents/`;

    if (!isAdmin && !normalized.startsWith(sellerPrefix)) {
      throw new ForbiddenException("You can only access your own seller documents.");
    }

    return normalized;
  }

  private s3CanonicalUri(endpointPath: string, bucket: string, assetKey: string) {
    const basePath = endpointPath.replace(/\/+$/, "");
    const segments = [...basePath.split("/").filter(Boolean), bucket, ...assetKey.split("/")];

    return `/${segments.map((segment) => this.encodeRfc3986(segment)).join("/")}`;
  }

  private canonicalQueryString(params: Array<[string, string]>) {
    return [...params]
      .sort(
        ([leftKey, leftValue], [rightKey, rightValue]) =>
          leftKey.localeCompare(rightKey) || leftValue.localeCompare(rightValue),
      )
      .map(([key, value]) => `${this.encodeRfc3986(key)}=${this.encodeRfc3986(value)}`)
      .join("&");
  }

  private amzDate(value: Date) {
    return value.toISOString().replace(/[:-]|\.\d{3}/g, "");
  }

  private awsSigningKey(secret: string, dateStamp: string, region: string) {
    const dateKey = createHmac("sha256", `AWS4${secret}`).update(dateStamp).digest();
    const regionKey = createHmac("sha256", dateKey).update(region).digest();
    const serviceKey = createHmac("sha256", regionKey).update("s3").digest();
    return createHmac("sha256", serviceKey).update("aws4_request").digest();
  }

  private encodeRfc3986(value: string) {
    return encodeURIComponent(value).replace(
      /[!'()*]/g,
      (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
    );
  }

  private privateStorageConfigFromSettings(settingMap: StorageSettingMap): PrivateStorageConfig {
    const endpoint = this.stringSetting(
      settingMap,
      STORAGE_SETTING_KEYS.privateEndpoint,
      process.env.S3_ENDPOINT ?? "",
    );
    const region = this.stringSetting(
      settingMap,
      STORAGE_SETTING_KEYS.privateRegion,
      process.env.S3_REGION ?? "",
    );
    const bucket = this.stringSetting(
      settingMap,
      STORAGE_SETTING_KEYS.privateBucket,
      process.env.S3_BUCKET ?? "",
    );
    const accessKeyId = this.stringSetting(
      settingMap,
      STORAGE_SETTING_KEYS.privateAccessKeyId,
      process.env.S3_ACCESS_KEY_ID ?? "",
    );
    const secretAccessKey = this.stringSetting(
      settingMap,
      STORAGE_SETTING_KEYS.privateSecretAccessKey,
      process.env.S3_SECRET_ACCESS_KEY ?? "",
    );
    const envConfigured = Boolean(endpoint && bucket && accessKeyId && secretAccessKey);
    const enabled = readBooleanSetting(
      settingMap.get(STORAGE_SETTING_KEYS.privateEnabled),
      envConfigured,
    );

    return {
      enabled,
      endpoint,
      region,
      bucket,
      accessKeyId,
      secretAccessKey,
      configured: Boolean(enabled && endpoint && bucket && accessKeyId && secretAccessKey),
    };
  }

  private storageSettingWrite(
    key: string,
    group: string,
    valueType: SettingValueType,
    value: Prisma.InputJsonValue,
  ): StorageSettingWrite {
    return { key, group, valueType, value };
  }

  private stringSetting(settingMap: StorageSettingMap, key: string, fallback: string) {
    const value = settingMap.get(key);
    return typeof value === "string" && value.trim() ? value.trim() : fallback;
  }

  private maskValue(value: string | undefined) {
    if (!value) {
      return null;
    }

    if (value.length <= 8) {
      return `${value.slice(0, 2)}****`;
    }

    return `${value.slice(0, 6)}...${value.slice(-4)}`;
  }
}
