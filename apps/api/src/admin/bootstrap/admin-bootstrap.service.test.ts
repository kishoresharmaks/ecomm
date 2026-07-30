import { ConflictException } from "@nestjs/common";
import { RoleCode } from "@indihub/database";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AdminBootstrapService } from "./admin-bootstrap.service";

vi.mock("../../auth/admin-password", () => ({
  hashAdminPassword: vi.fn().mockResolvedValue({ hash: "password_hash", salt: "password_salt" }),
}));

describe("AdminBootstrapService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("refuses bootstrap after any admin has been assigned", async () => {
    const tx = createBootstrapTx();
    tx.user.findUnique.mockResolvedValue({ id: "existing_admin", adminCredential: { id: "credential_1" } });
    tx.userRole.count.mockResolvedValue(1);
    const service = new AdminBootstrapService(createPrisma(tx));

    await expect(
      service.createFirstAdmin({
        email: "admin@example.com",
        password: "ReplacementPassword123!",
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(tx.userRole.count).toHaveBeenCalledWith({
      where: { roleId: "role_admin" },
    });
    expect(tx.user.update).not.toHaveBeenCalled();
    expect(tx.adminCredential.create).not.toHaveBeenCalled();
  });

  it("does not overwrite an existing back-office credential", async () => {
    const tx = createBootstrapTx();
    tx.user.findUnique.mockResolvedValue({ id: "finance_user", adminCredential: { id: "credential_1" } });
    tx.userRole.count.mockResolvedValue(0);
    const service = new AdminBootstrapService(createPrisma(tx));

    await expect(
      service.createFirstAdmin({
        email: "finance@example.com",
        password: "ReplacementPassword123!",
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(tx.userRole.upsert).not.toHaveBeenCalled();
    expect(tx.adminCredential.create).not.toHaveBeenCalled();
  });
});

function createBootstrapTx() {
  return {
    role: {
      upsert: vi.fn().mockResolvedValue({ id: "role_admin", code: RoleCode.ADMIN }),
    },
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
    },
    userRole: {
      count: vi.fn(),
      upsert: vi.fn(),
    },
    adminCredential: {
      create: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
  };
}

function createPrisma(tx: ReturnType<typeof createBootstrapTx>) {
  return {
    client: {
      $transaction: vi.fn(async (callback: (transactionClient: typeof tx) => Promise<unknown>) =>
        callback(tx),
      ),
    },
  } as never;
}
